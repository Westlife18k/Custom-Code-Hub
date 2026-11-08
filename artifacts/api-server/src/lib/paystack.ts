import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const DEFAULT_API_BASE = "https://api.paystack.co";

export type PaystackChannel = "bank_transfer" | "mobile_money";

export type PaystackInitializeResult = {
  authorization_url: string;
  access_code?: string;
  reference: string;
};

export type PaystackVerifyResult = {
  status: string;
  reference: string;
  amount: number;
  id?: number;
  currency?: string;
  paid_at?: string;
};

export class PaystackNotConfiguredError extends Error {
  constructor() {
    super("Paystack is not configured. Set PAYSTACK_SECRET_KEY to enable checkout.");
    this.name = "PaystackNotConfiguredError";
  }
}

export class PaystackRequestError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "PaystackRequestError";
    this.status = status;
  }
}

export function getPaystackSecretKey(): string | null {
  const key = process.env["PAYSTACK_SECRET_KEY"]?.trim();
  return key ? key : null;
}

export function isPaystackConfigured(): boolean {
  return getPaystackSecretKey() !== null;
}

function apiBase(): string {
  return (process.env["PAYSTACK_API_BASE"]?.trim() || DEFAULT_API_BASE).replace(/\/+$/, "");
}

/**
 * Order references use the `BCH-` prefix plus 32 hex characters so they match
 * the `^BCH-[a-f0-9]{32}$` pattern declared in lib/api-spec/openapi.yaml.
 */
export function createOrderReference(): string {
  return `BCH-${randomBytes(16).toString("hex")}`;
}

export const ORDER_REFERENCE_PATTERN = /^BCH-[a-f0-9]{32}$/;

/**
 * Wallet deposit references use the `DEP-` prefix plus 32 hex characters.
 * They are generated server-side for every deposit, so each attempt is unique
 * and can never collide with an order reference.
 */
export function createDepositReference(): string {
  return `DEP-${randomBytes(16).toString("hex")}`;
}

export const DEPOSIT_REFERENCE_PATTERN = /^DEP-[a-f0-9]{32}$/;

export type PaystackKeyMode = "test" | "live" | "unknown";

/**
 * Paystack secret keys are prefixed `sk_test_` or `sk_live_`. Deposits are
 * hard-limited to test mode, so this decides whether checkout may open.
 */
export function getPaystackKeyMode(): PaystackKeyMode {
  const key = getPaystackSecretKey();
  if (!key) return "unknown";
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  return "unknown";
}

/** Presence check only — the public key is never sent to the browser. */
export function hasPaystackPublicKey(): boolean {
  const key = process.env["PAYSTACK_PUBLIC_KEY"]?.trim();
  return Boolean(key);
}

type PaystackEnvelope<T> = {
  status?: boolean;
  message?: string;
  data?: T;
};

async function paystackRequest<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const secret = getPaystackSecretKey();
  if (!secret) throw new PaystackNotConfiguredError();

  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new PaystackRequestError(
      `Could not reach Paystack: ${error instanceof Error ? error.message : "unknown network error"}`,
    );
  }

  let payload: PaystackEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as PaystackEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.status || payload.data === undefined) {
    const message = payload?.message || `Paystack request failed with status ${response.status}`;
    // 4xx from Paystack is a caller error, not an upstream outage.
    throw new PaystackRequestError(message, response.status >= 500 ? 502 : 400);
  }

  return payload.data;
}

export async function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  channel: PaystackChannel;
  callbackUrl: string;
}): Promise<PaystackInitializeResult> {
  const data = await paystackRequest<PaystackInitializeResult>("/transaction/initialize", {
    method: "POST",
    body: {
      email: input.email,
      amount: input.amountKobo,
      currency: "GHS",
      reference: input.reference,
      channels: [input.channel],
      callback_url: input.callbackUrl,
    },
  });

  if (!data?.authorization_url || !data?.reference) {
    throw new PaystackRequestError("Paystack did not return a checkout URL");
  }

  return data;
}

export async function verifyTransaction(reference: string): Promise<PaystackVerifyResult> {
  const data = await paystackRequest<PaystackVerifyResult>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    { method: "GET" },
  );

  if (!data || typeof data.status !== "string") {
    throw new PaystackRequestError("Paystack returned an unexpected verification payload");
  }

  return data;
}

/**
 * Paystack signs the raw webhook body with HMAC-SHA512 using the secret key.
 */
export function isValidWebhookSignature(rawBody: Buffer, signature: unknown): boolean {
  const secret = getPaystackSecretKey();
  if (!secret || typeof signature !== "string" || signature.length === 0) return false;

  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const provided = signature.trim().toLowerCase();
  if (provided.length !== expected.length) return false;

  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"));
  } catch {
    return false;
  }
}
