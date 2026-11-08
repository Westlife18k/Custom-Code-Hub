import type { Request, Response } from "express";

import { logger } from "./logger";
import { creditVerifiedDeposit, releaseOrder } from "./payment-events";
import { isPaystackConfigured, isValidWebhookSignature } from "./paystack";

type PaystackEvent = {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    id?: number;
    amount?: number;
    currency?: string;
    channel?: string;
  };
};

/**
 * Single Paystack webhook handler, mounted for both order and deposit events.
 *
 * The signature is an HMAC-SHA512 digest of the RAW request body keyed with
 * PAYSTACK_SECRET_KEY, so app.ts parses these paths with express.raw().
 * Every branch below is idempotent: Paystack retries deliveries, and a
 * duplicate must never move money twice.
 */
export async function handlePaystackWebhook(req: Request, res: Response): Promise<void> {
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

  let event: PaystackEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as PaystackEvent;
  } catch {
    res.status(400).json({ error: "Webhook body is not valid JSON." });
    return;
  }

  const reference = event.data?.reference;
  const succeeded =
    event.event === "charge.success" && event.data?.status === "success" && typeof reference === "string";

  if (succeeded && typeof reference === "string") {
    const amount = typeof event.data?.amount === "number" ? event.data.amount : null;
    const transactionId = event.data?.id ?? null;

    if (reference.startsWith("DEP-")) {
      await creditVerifiedDeposit({ reference, transactionId, amountPesewas: amount });
    } else if (reference.startsWith("BCH-")) {
      await releaseOrder({ reference, transactionId, amountKobo: amount });
    } else {
      logger.warn({ reference }, "Ignoring webhook for an unrecognised reference prefix");
    }
  }

  // 200 for every accepted event so Paystack stops retrying; unknown or
  // duplicate references are already safe no-ops.
  res.json({ received: true });
}
