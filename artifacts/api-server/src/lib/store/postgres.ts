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
  AdminPackage,
  CreateDepositInput,
  CreateOrderInput,
  CreatePackageInput,
  CreditDepositInput,
  CreditOutcome,
  DeletePackageOutcome,
  DepositRecord,
  DepositStatus,
  OrderLookup,
  OrderStatus,
  OrderSummary,
  Store,
  StorePackage,
  StorePackagePrice,
  UpdatePackageInput,
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
  sql`create table if not exists deposits (
    id uuid primary key default gen_random_uuid(),
    reference text unique not null,
    email text not null,
    amount_pesewas bigint not null check (amount_pesewas > 0),
    currency text not null default 'GHS',
    status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
    channel text,
    paystack_transaction_id text,
    paid_at timestamptz,
    created_at timestamptz not null default now()
  )`,
  sql`create index if not exists deposits_email_idx on deposits (email, created_at desc)`,
  sql`create table if not exists wallets (
    email text primary key,
    balance_pesewas bigint not null default 0,
    updated_at timestamptz not null default now()
  )`,
  // deposit_reference is UNIQUE so a deposit can never be credited twice,
  // whichever path (webhook or verify) gets there first.
  sql`create table if not exists wallet_credits (
    id uuid primary key default gen_random_uuid(),
    deposit_reference text unique not null,
    email text not null,
    amount_pesewas integer not null,
    created_at timestamptz not null default now()
  )`,
];

function mapDeposit(row: {
  reference: string;
  email: string;
  amountPesewas: number | string | bigint;
  status: string;
  channel: string | null;
  paystackTransactionId: string | null;
  paidAt: Date | string | null;
  createdAt: Date | string | null;
}): DepositRecord {
  return {
    reference: row.reference,
    email: row.email,
    amountPesewas: Number(row.amountPesewas),
    status: row.status as DepositStatus,
    channel: row.channel ?? null,
    paystackTransactionId: row.paystackTransactionId ?? null,
    paidAt: row.paidAt === null ? null : new Date(row.paidAt).toISOString(),
    createdAt: row.createdAt === null ? "" : new Date(row.createdAt).toISOString(),
  };
}

const DEPOSIT_COLUMNS = {
  reference: depositsTable.reference,
  email: depositsTable.email,
  amountPesewas: depositsTable.amountPesewas,
  status: depositsTable.status,
  channel: depositsTable.channel,
  paystackTransactionId: depositsTable.paystackTransactionId,
  paidAt: depositsTable.paidAt,
  createdAt: depositsTable.createdAt,
};

const ADMIN_PACKAGE_COLUMNS = {
  id: packagesTable.id,
  title: packagesTable.title,
  description: packagesTable.description,
  priceKobo: packagesTable.priceKobo,
  totalOdds: packagesTable.totalOdds,
  matchCount: packagesTable.matchCount,
  bettingCode: packagesTable.bettingCode,
  active: packagesTable.active,
  createdAt: packagesTable.createdAt,
};

type AdminPackageRow = {
  id: string;
  title: string;
  description: string | null;
  priceKobo: number | bigint;
  totalOdds: string | null;
  matchCount: number | null;
  bettingCode: string;
  active: boolean;
  createdAt: Date | string | null;
};

function mapAdminPackage(row: AdminPackageRow): AdminPackage {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    pricePesewas: Number(row.priceKobo),
    totalOdds: row.totalOdds ?? null,
    matchCount: row.matchCount === null || row.matchCount === undefined ? null : Number(row.matchCount),
    bettingCode: row.bettingCode,
    active: Boolean(row.active),
    createdAt: row.createdAt === null ? "" : new Date(row.createdAt).toISOString(),
  };
}

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

    async createDeposit(input: CreateDepositInput): Promise<void> {
      await db.insert(depositsTable).values({
        reference: input.reference,
        email: input.email.trim().toLowerCase(),
        amountPesewas: input.amountPesewas,
        status: "pending",
        channel: input.channel,
      });
    },

    async getDeposit(reference: string): Promise<DepositRecord | null> {
      const [row] = await db
        .select(DEPOSIT_COLUMNS)
        .from(depositsTable)
        .where(eq(depositsTable.reference, reference))
        .limit(1);

      return row ? mapDeposit(row) : null;
    },

    async updateDepositStatus(
      reference: string,
      status: DepositStatus,
      currentStatus?: DepositStatus,
    ): Promise<void> {
      const where = currentStatus
        ? and(eq(depositsTable.reference, reference), eq(depositsTable.status, currentStatus))
        : eq(depositsTable.reference, reference);

      await db.update(depositsTable).set({ status }).where(where);
    },

    async creditDeposit(input: CreditDepositInput): Promise<CreditOutcome> {
      return await db.transaction(async (tx): Promise<CreditOutcome> => {
        // Row lock: concurrent webhook + verify calls serialise here.
        const [row] = await tx
          .select({
            email: depositsTable.email,
            amountPesewas: depositsTable.amountPesewas,
            status: depositsTable.status,
          })
          .from(depositsTable)
          .where(eq(depositsTable.reference, input.reference))
          .limit(1)
          .for("update");

        if (!row) return "not_found";

        const amountPesewas = Number(row.amountPesewas);

        if (row.status === "success") return "already_credited";

        if (
          typeof input.amountPesewas === "number" &&
          Number.isFinite(input.amountPesewas) &&
          input.amountPesewas !== amountPesewas
        ) {
          return "amount_mismatch";
        }

        const inserted = await tx
          .insert(walletCreditsTable)
          .values({
            depositReference: input.reference,
            email: row.email,
            amountPesewas,
          })
          .onConflictDoNothing({ target: walletCreditsTable.depositReference })
          .returning({ id: walletCreditsTable.id });

        if (inserted.length === 0) return "already_credited";

        await tx
          .update(depositsTable)
          .set({
            status: "success",
            paidAt: new Date(),
            paystackTransactionId:
              input.transactionId === undefined || input.transactionId === null
                ? null
                : String(input.transactionId),
          })
          .where(eq(depositsTable.reference, input.reference));

        await tx
          .insert(walletsTable)
          .values({ email: row.email, balancePesewas: amountPesewas })
          .onConflictDoUpdate({
            target: walletsTable.email,
            set: {
              balancePesewas: sql`${walletsTable.balancePesewas} + ${amountPesewas}`,
              updatedAt: new Date(),
            },
          });

        return "credited";
      });
    },

    async listDeposits(email: string, limit: number): Promise<DepositRecord[]> {
      const rows = await db
        .select(DEPOSIT_COLUMNS)
        .from(depositsTable)
        .where(eq(depositsTable.email, email.trim().toLowerCase()))
        .orderBy(desc(depositsTable.createdAt), desc(depositsTable.reference))
        .limit(limit);

      return rows.map(mapDeposit);
    },

    async getWallet(email: string): Promise<WalletSummary> {
      const normalised = email.trim().toLowerCase();
      const [row] = await db
        .select({ balancePesewas: walletsTable.balancePesewas })
        .from(walletsTable)
        .where(eq(walletsTable.email, normalised))
        .limit(1);

      return {
        email: normalised,
        balancePesewas: row ? Number(row.balancePesewas) : 0,
      };
    },
  };
}
