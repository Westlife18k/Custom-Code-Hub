import { logger } from "./logger";
import { getStore } from "./store";
import type { CreditOutcome } from "./store/types";

/**
 * Marks a package order paid, but only once, and only when the amount Paystack
 * reports matches what the order was created for. Repeated webhooks and
 * verifications are safe.
 */
export async function releaseOrder(input: {
  reference: string;
  transactionId?: string | number | null;
  amountKobo?: number | null;
}): Promise<void> {
  const store = getStore();
  const order = await store.getOrderSummary(input.reference);

  if (!order) {
    logger.warn({ reference: input.reference }, "Paid event for unknown order reference");
    return;
  }

  if (order.status === "paid") return;

  if (
    typeof input.amountKobo === "number" &&
    Number.isFinite(input.amountKobo) &&
    input.amountKobo !== order.amountKobo
  ) {
    logger.warn(
      { reference: input.reference, expected: order.amountKobo, received: input.amountKobo },
      "Paystack amount mismatch, refusing to release code",
    );
    return;
  }

  await store.markOrderPaid({ reference: input.reference, transactionId: input.transactionId });
}

/**
 * Credits a wallet deposit. The store guarantees exactly-once behaviour:
 * a replayed webhook or a repeated verification returns `already_credited`
 * instead of moving money twice, and an amount that does not match the stored
 * deposit is never credited.
 */
export async function creditVerifiedDeposit(input: {
  reference: string;
  transactionId?: string | number | null;
  amountPesewas?: number | null;
}): Promise<CreditOutcome> {
  const outcome = await getStore().creditDeposit({
    reference: input.reference,
    transactionId: input.transactionId ?? null,
    amountPesewas:
      typeof input.amountPesewas === "number" && Number.isFinite(input.amountPesewas)
        ? input.amountPesewas
        : null,
  });

  if (outcome === "credited") {
    logger.info({ reference: input.reference }, "Wallet deposit credited");
  } else if (outcome === "already_credited") {
    logger.info({ reference: input.reference }, "Deposit already credited, ignoring duplicate event");
  } else if (outcome === "amount_mismatch") {
    logger.warn(
      { reference: input.reference, received: input.amountPesewas },
      "Deposit amount mismatch, refusing to credit wallet",
    );
  } else {
    logger.warn({ reference: input.reference }, "Unknown deposit reference, refusing to credit wallet");
  }

  return outcome;
}
