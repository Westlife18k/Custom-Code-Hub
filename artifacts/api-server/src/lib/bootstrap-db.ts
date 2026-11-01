import { sql } from "drizzle-orm";

import { db, packagesTable } from "@workspace/db";
import { logger } from "./logger";

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

type SeedPackage = {
  id: string;
  title: string;
  description: string;
  priceKobo: number;
  totalOdds: string;
  matchCount: number;
  bettingCode: string;
};

const SEED_PACKAGES: SeedPackage[] = [
  {
    id: "6b1f5a70-0d7e-4a3b-9a51-1a3d6f0c8b11",
    title: "Weekend watchlist",
    description: "A considered selection across a busy weekend of European fixtures.",
    priceKobo: 4200,
    totalOdds: "8.64",
    matchCount: 5,
    bettingCode: "WKND-8641-5527",
  },
  {
    id: "9c2e7d41-5b6a-4f0d-8c37-2f9b1d4e6a22",
    title: "Midweek edition",
    description: "A compact collection built around midweek league matchups.",
    priceKobo: 2800,
    totalOdds: "5.18",
    matchCount: 3,
    bettingCode: "MDWK-5182-3391",
  },
  {
    id: "d4a8b3e2-7c15-49f8-b6d2-3e5a0c7b9f33",
    title: "Continental notes",
    description: "A longer-form example spanning selected continental fixtures.",
    priceKobo: 6700,
    totalOdds: "12.42",
    matchCount: 7,
    bettingCode: "CNTL-1242-7714",
  },
];

/**
 * Creates the tables if missing and inserts the starter packages exactly once.
 * Existing rows are never overwritten, so operators can edit packages in place.
 */
export async function bootstrapDatabase(): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await db.execute(statement);
  }

  const inserted = await db
    .insert(packagesTable)
    .values(SEED_PACKAGES)
    .onConflictDoNothing({ target: packagesTable.id })
    .returning({ id: packagesTable.id });

  logger.info({ seeded: inserted.length }, "Database ready");
}
