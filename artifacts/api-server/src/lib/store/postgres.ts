import { and, asc, desc, eq, sql } from "drizzle-orm";

import {
  db,
  depositsTable,
  ordersTable,
  packagesTable,
  walletCreditsTable,
  walletsTable,
} from "@workspace/db";
import { logger } from "../logger";
import { SEED_PACKAGES } from "./seed-data";
import type {
  CreateDepositInput,
  CreateOrderInput,
  CreditDepositInput,
  CreditOutcome,
  DepositRecord,
  DepositStatus,
  OrderLookup,
  OrderStatus,
  OrderSummary,
  Store,
  StorePackage,
  StorePackagePrice,
  WalletSummary,
} from "./types";

/**
 * Idempotent DDL mirroring supabase/schema.sql so the API can run against a
 * plain Postgres instance (local, container or Supabase) without a manual
 * migration step. gen_random_uuid() ships with Postgres 13+, so no extension
 * is required.
 */
const SCHEMA_STATEMENTS = [
  sql`create table if not exists packages (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    price_kobo bigint not null check (price_kobo > 0),
    total_odds text,
    match_count integer,
    betting_code text not null,
    active boolean not null default true,
    created_at timestamptz not null default now()
  )`,
  sql`create table if not exists orders (
    id uuid primary key default gen_random_uuid(),
    reference text unique not null,
    package_id uuid not null references packages(id),
    customer_email text not null,
    amount_kobo bigint not null,
    status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
    paystack_transaction_id text,
    paid_at timestamptz,
    created_at timestamptz not null default now()
  )`,
  sql`create index if not exists orders_customer_email_idx on orders (customer_email)`,
];

/** Postgres/Drizzle implementation, used whenever DATABASE_URL is set. */
export function createPostgresStore(): Store {
  return {
    kind: "postgres",

    async bootstrap(): Promise<void> {
      for (const statement of SCHEMA_STATEMENTS) {
        await db.execute(statement);
      }

      const inserted = await db
        .insert(packagesTable)
        .values(SEED_PACKAGES)
        .onConflictDoNothing({ target: packagesTable.id })
        .returning({ id: packagesTable.id });

      logger.info({ backend: "postgres", seeded: inserted.length }, "Database ready");
    },

    async listActivePackages(): Promise<StorePackage[]> {
      const rows = await db
        .select({
          id: packagesTable.id,
          title: packagesTable.title,
          description: packagesTable.description,
          price_kobo: packagesTable.priceKobo,
          total_odds: packagesTable.totalOdds,
          match_count: packagesTable.matchCount,
        })
        .from(packagesTable)
        .where(eq(packagesTable.active, true))
        .orderBy(asc(packagesTable.priceKobo));

      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description ?? null,
        price_kobo: Number(row.price_kobo),
        total_odds: row.total_odds ?? null,
        match_count: row.match_count === null || row.match_count === undefined ? null : Number(row.match_count),
      }));
    },

    async findActivePackage(id: string): Promise<StorePackagePrice | null> {
      const [pkg] = await db
        .select({ id: packagesTable.id, priceKobo: packagesTable.priceKobo })
        .from(packagesTable)
        .where(and(eq(packagesTable.id, id), eq(packagesTable.active, true)))
        .limit(1);

      if (!pkg) return null;
      return { id: pkg.id, priceKobo: Number(pkg.priceKobo) };
    },

    async createOrder(input: CreateOrderInput): Promise<void> {
      await db.insert(ordersTable).values({
        reference: input.reference,
        packageId: input.packageId,
        customerEmail: input.customerEmail.trim().toLowerCase(),
        amountKobo: input.amountKobo,
        status: "pending",
      });
    },

    async updateOrderStatus(
      reference: string,
      status: OrderStatus,
      currentStatus?: OrderStatus,
    ): Promise<void> {
      const where = currentStatus
        ? and(eq(ordersTable.reference, reference), eq(ordersTable.status, currentStatus))
        : eq(ordersTable.reference, reference);

      await db.update(ordersTable).set({ status }).where(where);
    },

    async getOrderSummary(reference: string): Promise<OrderSummary | null> {
      const [row] = await db
        .select({
          id: ordersTable.id,
          amountKobo: ordersTable.amountKobo,
          status: ordersTable.status,
        })
        .from(ordersTable)
        .where(eq(ordersTable.reference, reference))
        .limit(1);

      if (!row) return null;
      return {
        id: row.id,
        amountKobo: Number(row.amountKobo),
        status: row.status as OrderStatus,
      };
    },

    async markOrderPaid(input: {
      reference: string;
      transactionId?: string | number | null;
    }): Promise<boolean> {
      const updated = await db
        .update(ordersTable)
        .set({
          status: "paid",
          paidAt: new Date(),
          paystackTransactionId:
            input.transactionId === undefined || input.transactionId === null
              ? null
              : String(input.transactionId),
        })
        .where(and(eq(ordersTable.reference, input.reference), sql`${ordersTable.status} <> 'paid'`))
        .returning({ id: ordersTable.id });

      return updated.length > 0;
    },

    async lookupOrder(input: { reference: string; email: string }): Promise<OrderLookup | null> {
      const [order] = await db
        .select({
          status: ordersTable.status,
          title: packagesTable.title,
          code: packagesTable.bettingCode,
        })
        .from(ordersTable)
        .innerJoin(packagesTable, eq(ordersTable.packageId, packagesTable.id))
        .where(
          and(
            eq(ordersTable.reference, input.reference),
            sql`lower(${ordersTable.customerEmail}) = ${input.email.trim().toLowerCase()}`,
          ),
        )
        .limit(1);

      if (!order) return null;
      return { status: order.status as OrderStatus, title: order.title, code: order.code };
    },
  };
}
