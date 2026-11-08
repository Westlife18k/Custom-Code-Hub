import { Router, type IRouter, type Request, type Response } from "express";

import {
  DEPOSIT_REFERENCE_PATTERN,
  PaystackNotConfiguredError,
  PaystackRequestError,
  createDepositReference,
  getPaystackKeyMode,
  hasPaystackPublicKey,
  initializeDeposit,
  isPaystackConfigured,
  verifyTransaction,
} from "../lib/paystack";
import { creditVerifiedDeposit } from "../lib/payment-events";
import { handlePaystackWebhook } from "../lib/paystack-webhook";
import { getStore } from "../lib/store";
import { logger } from "../lib/logger";

const router: IRouter = Router();

/** Wallet deposits are limited to test mode: GH₵1.00 – GH₵10,000.00. */
const MIN_DEPOSIT_PESEWAS = 100;
const MAX_DEPOSIT_PESEWAS = 1_000_000;
const HISTORY_LIMIT = 25;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

function publicBaseUrl(req: Request): string {
  const configured = process.env["PUBLIC_BASE_URL"]?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return `${req.protocol}://${req.get("host") ?? "localhost"}`;
}

function normaliseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 5 || email.length > 254) return null;
  return EMAIL_PATTERN.test(email) ? email : null;
}

/**
 * Accepts either `amountPesewas` (integer) or `amountGhs` (cedis) and returns
 * the authoritative integer amount in pesewas.
 */
function parseAmount(body: Record<string, unknown>): { pesewas: number } | { error: string } {
  let pesewas: number | null = null;

  const rawPesewas = body["amountPesewas"];
  const rawGhs = body["amountGhs"];

  if (typeof rawPesewas === "number" && Number.isInteger(rawPesewas)) {
    pesewas = rawPesewas;
  } else if (typeof rawPesewas === "string" && /^\d+$/.test(rawPesewas.trim())) {
    pesewas = Number(rawPesewas.trim());
  } else if (typeof rawGhs === "number" || (typeof rawGhs === "string" && rawGhs.trim() !== "")) {
    const ghs = typeof rawGhs === "number" ? rawGhs : Number(rawGhs.trim());
    if (Number.isFinite(ghs)) pesewas = Math.round(ghs * 100);
  }

  if (pesewas === null || !Number.isFinite(pesewas)) {
    return { error: "Enter a deposit amount in Ghana cedis, for example 20." };
  }
  if (pesewas < MIN_DEPOSIT_PESEWAS) {
    return { error: `The minimum deposit is GH₵${MIN_DEPOSIT_PESEWAS / 100}.` };
  }
  if (pesewas > MAX_DEPOSIT_PESEWAS) {
    return { error: `The maximum deposit is GH₵${MAX_DEPOSIT_PESEWAS / 100}.` };
  }

  return { pesewas };
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

/** Tells the storefront whether deposits can open, without exposing any key. */
router.get("/deposits/config", (_req, res) => {
  const mode = getPaystackKeyMode();

  res.json({
    currency: "GHS",
    configured: isPaystackConfigured(),
    publicKeyConfigured: hasPaystackPublicKey(),
    keyMode: mode,
    testModeOnly: true,
    liveEnabled: false,
    withdrawalsEnabled: false,
    minPesewas: MIN_DEPOSIT_PESEWAS,
    maxPesewas: MAX_DEPOSIT_PESEWAS,
  });
});

/**
 * Creates a pending deposit row, then opens a Paystack Checkout session in
 * GHS. The amount always comes from the request, but the record of truth is
 * the server-created deposit — the browser cannot mark it paid.
 */
router.post("/deposits/initialize", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const email = normaliseEmail(body["email"]);

  if (!email) {
    res.status(400).json({ error: "Enter a valid email address for the deposit." });
    return;
  }

  const amount = parseAmount(body);
  if ("error" in amount) {
    res.status(400).json({ error: amount.error });
    return;
  }

  if (!isPaystackConfigured()) {
    res.status(503).json({
      error:
        "Deposits are not configured yet. Set PAYSTACK_SECRET_KEY on the server to enable test-mode deposits.",
    });
    return;
  }

  const mode = getPaystackKeyMode();
  if (mode !== "test") {
    logger.warn({ mode }, "Blocked deposit initialization outside Paystack test mode");
    res.status(503).json({
      error:
        "Wallet deposits are limited to Paystack test mode. Replace PAYSTACK_SECRET_KEY with a test key (sk_test_…) to enable deposits.",
    });
    return;
  }

  const store = getStore();
  const reference = createDepositReference();

  await store.createDeposit({
    reference,
    email,
    amountPesewas: amount.pesewas,
    channel: null,
  });

  try {
    const initialized = await initializeDeposit({
      email,
      amountPesewas: amount.pesewas,
      reference,
      callbackUrl: `${publicBaseUrl(req)}/wallet?reference=${encodeURIComponent(reference)}&email=${encodeURIComponent(email)}`,
    });

    res.json({
      reference: initialized.reference || reference,
      authorization_url: initialized.authorization_url,
      amountPesewas: amount.pesewas,
      currency: "GHS",
      testMode: true,
    });
  } catch (error) {
    await store.updateDepositStatus(reference, "failed");
    sendPaystackError(res, error);
  }
});

/**
 * Confirms a deposit directly with Paystack and credits the wallet only when
 * Paystack itself reports a successful charge for the stored amount.
 */
router.post("/deposits/verify", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const email = normaliseEmail(body["email"]);
  const reference = typeof body["reference"] === "string" ? body["reference"].trim() : "";

  if (!email) {
    res.status(400).json({ error: "Enter the email address used for the deposit." });
    return;
  }
  if (!DEPOSIT_REFERENCE_PATTERN.test(reference)) {
    res.status(400).json({ error: "That deposit reference is not valid." });
    return;
  }
  if (!isPaystackConfigured()) {
    res.status(503).json({ error: "Deposits are not configured on this deployment yet." });
    return;
  }

  const store = getStore();
  const deposit = await store.getDeposit(reference);

  // Same 404 for "unknown" and "someone else's", so references cannot be probed.
  if (!deposit || deposit.email !== email) {
    res.status(404).json({ error: "We could not find that deposit for this email address." });
    return;
  }

  if (deposit.status === "success") {
    const wallet = await store.getWallet(email);
    res.json({
      reference,
      status: "success",
      success: true,
      alreadyCredited: true,
      amountPesewas: deposit.amountPesewas,
      balancePesewas: wallet.balancePesewas,
      currency: "GHS",
    });
    return;
  }

  try {
    const result = await verifyTransaction(reference);
    const paid = result.status === "success" && result.reference === reference;

    if (!paid) {
      const terminal = result.status === "failed" || result.status === "reversed";
      if (terminal) await store.updateDepositStatus(reference, "failed", "pending");
      const wallet = await store.getWallet(email);

      res.json({
        reference,
        status: terminal ? "failed" : "pending",
        success: false,
        amountPesewas: deposit.amountPesewas,
        balancePesewas: wallet.balancePesewas,
        currency: "GHS",
        message: "Paystack has not confirmed this payment yet.",
      });
      return;
    }

    const outcome = await creditVerifiedDeposit({
      reference,
      transactionId: result.id ?? null,
      amountPesewas: typeof result.amount === "number" ? result.amount : null,
    });
    const wallet = await store.getWallet(email);

    if (outcome === "amount_mismatch") {
      res.status(409).json({
        error: "The amount Paystack reported does not match this deposit, so the wallet was not credited.",
        reference,
        status: "pending",
        balancePesewas: wallet.balancePesewas,
      });
      return;
    }

    if (outcome === "not_found") {
      res.status(404).json({ error: "We could not find that deposit." });
      return;
    }

    res.json({
      reference,
      status: "success",
      success: true,
      alreadyCredited: outcome === "already_credited",
      amountPesewas: deposit.amountPesewas,
      balancePesewas: wallet.balancePesewas,
      currency: "GHS",
    });
  } catch (error) {
    sendPaystackError(res, error);
  }
});

/** Deposit history plus the current wallet balance for one email address. */
router.get("/deposits", async (req, res) => {
  const email = normaliseEmail(req.query["email"]);

  if (!email) {
    res.status(400).json({ error: "Enter a valid email address to see deposit history." });
    return;
  }

  const store = getStore();
  const [deposits, wallet] = await Promise.all([
    store.listDeposits(email, HISTORY_LIMIT),
    store.getWallet(email),
  ]);

  res.json({
    email,
    currency: "GHS",
    balancePesewas: wallet.balancePesewas,
    deposits,
  });
});

/**
 * Paystack webhook for deposits and orders. Mounted with express.raw() in
 * app.ts so the HMAC-SHA512 signature can be checked against the raw body.
 */
router.post("/deposits/webhook", (req, res) => {
  void handlePaystackWebhook(req, res);
});

export default router;
