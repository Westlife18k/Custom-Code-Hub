import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq, sql } from "drizzle-orm";

import { db, ordersTable, packagesTable } from "@workspace/db";
import {
  InitializePaymentBody,
  InitializePaymentResponse,
  ReceivePaystackWebhookResponse,
  VerifyPaymentBody,
  VerifyPaymentResponse,
} from "@workspace/api-zod";
import {
  PaystackNotConfiguredError,
  PaystackRequestError,
  createOrderReference,
  initializeTransaction,
  isPaystackConfigured,
  isValidWebhookSignature,
  verifyTransaction,
} from "../lib/paystack";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function publicBaseUrl(req: Request): string {
  const configured = process.env["PUBLIC_BASE_URL"]?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return `${req.protocol}://${req.get("host") ?? "localhost"}`;
}

function sendPaystackError(res: Response, error: unknown): void {
  if (error instanceof PaystackNotConfiguredError) {
    res.status(503).json({ error: error.message });
    return;
  }
  if (error instanceof PaystackRequestError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  throw error;
}

/**
 * Marks an order paid, but only once. Repeated webhooks/verifications are safe.
 */
async function markOrderPaid(input: {
  reference: string;
  transactionId?: string | number | null;
  amountKobo?: number | null;
}): Promise<void> {
  const [existing] = await db
    .select({
      id: ordersTable.id,
      amountKobo: ordersTable.amountKobo,
      status: ordersTable.status,
    })
    .from(ordersTable)
    .where(eq(ordersTable.reference, input.reference))
    .limit(1);

  if (!existing) {
    logger.warn({ reference: input.reference }, "Paid event for unknown order reference");
    return;
  }

  if (existing.status === "paid") return;

  if (
    typeof input.amountKobo === "number" &&
    Number.isFinite(input.amountKobo) &&
    input.amountKobo !== Number(existing.amountKobo)
  ) {
    logger.warn(
      { reference: input.reference, expected: existing.amountKobo, received: input.amountKobo },
      "Paystack amount mismatch, refusing to release code",
    );
    return;
  }

  await db
    .update(ordersTable)
    .set({
      status: "paid",
      paidAt: new Date(),
      paystackTransactionId:
        input.transactionId === undefined || input.transactionId === null
          ? null
          : String(input.transactionId),
    })
    .where(and(eq(ordersTable.reference, input.reference), sql`${ordersTable.status} <> 'paid'`));
}

/**
 * Creates a pending order for an active package and returns a Paystack
 * checkout URL. Requires PAYSTACK_SECRET_KEY.
 */
router.post("/payments/initialize", async (req, res) => {
  const { packageId, email, channel } = InitializePaymentBody.parse(req.body);

  if (!isPaystackConfigured()) {
    res.status(503).json({
      error:
        "Card and mobile money checkout is not configured yet. Set PAYSTACK_SECRET_KEY on the server to enable it.",
    });
    return;
  }

  const [pkg] = await db
    .select({
      id: packagesTable.id,
      priceKobo: packagesTable.priceKobo,
    })
    .from(packagesTable)
    .where(and(eq(packagesTable.id, packageId), eq(packagesTable.active, true)))
    .limit(1);

  if (!pkg) {
    res.status(404).json({ error: "That package is not available." });
    return;
  }

  const reference = createOrderReference();

  await db.insert(ordersTable).values({
    reference,
    packageId: pkg.id,
    customerEmail: email.trim().toLowerCase(),
    amountKobo: Number(pkg.priceKobo),
    status: "pending",
  });

  try {
    const initialized = await initializeTransaction({
      email: email.trim(),
      amountKobo: Number(pkg.priceKobo),
      reference,
      channel,
      callbackUrl: `${publicBaseUrl(req)}/my-codes?reference=${encodeURIComponent(reference)}&email=${encodeURIComponent(email.trim())}`,
    });

    res.json(
      InitializePaymentResponse.parse({
        authorization_url: initialized.authorization_url,
        reference: initialized.reference,
      }),
    );
  } catch (error) {
    await db.update(ordersTable).set({ status: "failed" }).where(eq(ordersTable.reference, reference));
    sendPaystackError(res, error);
  }
});

/**
 * Confirms a payment directly with Paystack and releases the order if Paystack
 * reports a successful charge.
 */
router.post("/payments/verify", async (req, res) => {
  const { reference } = VerifyPaymentBody.parse(req.body);

  if (!isPaystackConfigured()) {
    res.status(503).json({ error: "Payments are not configured on this deployment yet." });
    return;
  }

  try {
    const result = await verifyTransaction(reference);
    const success = result.status === "success";

    if (success) {
      await markOrderPaid({
        reference,
        transactionId: result.id,
        amountKobo: typeof result.amount === "number" ? result.amount : null,
      });
    } else {
      await db
        .update(ordersTable)
        .set({ status: "failed" })
        .where(and(eq(ordersTable.reference, reference), eq(ordersTable.status, "pending")));
    }

    res.json(VerifyPaymentResponse.parse({ success, reference }));
  } catch (error) {
    sendPaystackError(res, error);
  }
});

/**
 * Paystack webhook. The raw body is required for the HMAC-SHA512 signature
 * check, so it is mounted with express.raw() in app.ts.
 */
router.post("/payments/webhook", async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");

  if (!isPaystackConfigured()) {
    res.status(503).json({ error: "Payments are not configured on this deployment yet." });
    return;
  }

  if (!isValidWebhookSignature(rawBody, req.get("x-paystack-signature"))) {
    logger.warn("Rejected Paystack webhook with an invalid signature");
    res.status(401).json({ error: "Invalid webhook signature." });
    return;
  }

  let event: { event?: string; data?: { reference?: string; status?: string; id?: number; amount?: number } };
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Webhook body is not valid JSON." });
    return;
  }

  if (event.event === "charge.success" && event.data?.reference && event.data.status === "success") {
    await markOrderPaid({
      reference: event.data.reference,
      transactionId: event.data.id,
      amountKobo: typeof event.data.amount === "number" ? event.data.amount : null,
    });
  }

  res.json(ReceivePaystackWebhookResponse.parse({ received: true }));
});

export default router;
