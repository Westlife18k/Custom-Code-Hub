export type OrderStatus = "pending" | "paid" | "failed";

/** Shape returned by the public catalogue endpoint (never includes the code). */
export type StorePackage = {
  id: string;
  title: string;
  description: string | null;
  price_kobo: number;
  total_odds: string | null;
  match_count: number | null;
};

export type StorePackagePrice = {
  id: string;
  priceKobo: number;
};

/**
 * A package as the owner sees it in the admin panel: unlike the public
 * catalogue it includes the betting code and whether it is on sale.
 */
export type AdminPackage = {
  id: string;
  title: string;
  description: string | null;
  pricePesewas: number;
  totalOdds: string | null;
  matchCount: number | null;
  bettingCode: string;
  active: boolean;
  createdAt: string;
};

export type CreatePackageInput = {
  title: string;
  description: string | null;
  pricePesewas: number;
  totalOdds: string | null;
  matchCount: number | null;
  bettingCode: string;
  active: boolean;
};

export type UpdatePackageInput = Partial<CreatePackageInput>;

/** Outcome of a delete attempt, so the route can answer 404 vs 409 precisely. */
export type DeletePackageOutcome = "deleted" | "not_found" | "has_orders";

export type OrderSummary = {
  id: string;
  amountKobo: number;
  status: OrderStatus;
};

export type OrderLookup = {
  status: OrderStatus;
  title: string;
  code: string;
};

export type CreateOrderInput = {
  reference: string;
  packageId: string;
  customerEmail: string;
  amountKobo: number;
};

export type DepositStatus = "pending" | "success" | "failed";

/** A wallet deposit row as exposed to the API (never contains secrets). */
export type DepositRecord = {
  reference: string;
  email: string;
  amountPesewas: number;
  status: DepositStatus;
  channel: string | null;
  paystackTransactionId: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type CreateDepositInput = {
  reference: string;
  email: string;
  amountPesewas: number;
  channel: string | null;
};

export type WalletSummary = {
  email: string;
  balancePesewas: number;
};

/**
 * Result of trying to credit a verified deposit.
 *
 * `already_credited` is a success, not an error: it is what a replayed webhook
 * or a repeated verification returns once the ledger row exists. `not_found`
 * and `amount_mismatch` must never move money.
 */
export type CreditOutcome =
  | "credited"
  | "already_credited"
  | "not_found"
  | "amount_mismatch";

export type CreditDepositInput = {
  reference: string;
  transactionId?: string | number | null;
  /** Amount reported by Paystack; when present it must match the deposit. */
  amountPesewas?: number | null;
};

/**
 * Minimal persistence surface used by the HTTP routes. Two implementations
 * exist so the API works with a provisioned Postgres database and, when none
 * is configured, with an embedded SQLite file that is created and seeded on
 * boot.
 */
export interface Store {
  readonly kind: "postgres" | "sqlite";
  /** Creates the schema if needed and inserts starter packages once. */
  bootstrap(): Promise<void>;
  listActivePackages(): Promise<StorePackage[]>;
  findActivePackage(id: string): Promise<StorePackagePrice | null>;

  // --- Owner catalogue management (admin panel) ---------------------------
  /** Every package, active or not, including the betting code. */
  listAllPackages(): Promise<AdminPackage[]>;
  createPackage(input: CreatePackageInput): Promise<AdminPackage>;
  updatePackage(id: string, patch: UpdatePackageInput): Promise<AdminPackage | null>;
  deletePackage(id: string): Promise<DeletePackageOutcome>;
  createOrder(input: CreateOrderInput): Promise<void>;
  /** Updates a status, optionally only when the row still has `currentStatus`. */
  updateOrderStatus(
    reference: string,
    status: OrderStatus,
    currentStatus?: OrderStatus,
  ): Promise<void>;
  getOrderSummary(reference: string): Promise<OrderSummary | null>;
  /** Flips a pending/failed order to paid. Returns true when it changed. */
  markOrderPaid(input: { reference: string; transactionId?: string | number | null }): Promise<boolean>;
  lookupOrder(input: { reference: string; email: string }): Promise<OrderLookup | null>;

  // --- Wallet deposits (Paystack test mode) -------------------------------
  createDeposit(input: CreateDepositInput): Promise<void>;
  getDeposit(reference: string): Promise<DepositRecord | null>;
  /** Only updates when the row still has `currentStatus`, when provided. */
  updateDepositStatus(
    reference: string,
    status: DepositStatus,
    currentStatus?: DepositStatus,
  ): Promise<void>;
  listDeposits(email: string, limit: number): Promise<DepositRecord[]>;
  getWallet(email: string): Promise<WalletSummary>;
  /**
   * Credits a verified deposit exactly once. Implementations must be atomic so
   * a webhook and a verify call racing on the same reference cannot double
   * credit; the second caller receives `already_credited`.
   */
  creditDeposit(input: CreditDepositInput): Promise<CreditOutcome>;
}
