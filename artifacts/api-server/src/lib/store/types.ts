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
}
