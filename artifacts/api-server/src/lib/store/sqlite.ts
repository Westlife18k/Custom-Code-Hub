import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

import { logger } from "../logger";
import { SEED_PACKAGES } from "./seed-data";
import type {
  CreateOrderInput,
  OrderLookup,
  OrderStatus,
  OrderSummary,
  Store,
  StorePackage,
  StorePackagePrice,
} from "./types";

type SqliteStatement = {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => Record<string, unknown> | undefined;
  all: (...params: unknown[]) => Record<string, unknown>[];
};

type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
};

type SqliteModule = {
  DatabaseSync: new (location: string) => SqliteDatabase;
};

/**
 * `node:sqlite` is part of Node 22.5+/24 but not of older runtimes, so it is
 * resolved at runtime through `require` instead of a static import. That keeps
 * the module loadable on hosts where the Postgres backend is used anyway.
 */
function loadSqlite(): SqliteModule {
  const require = createRequire(import.meta.url);
  // Built through a variable so bundlers leave the builtin specifier alone.
  const specifier = "node:" + "sqlite";
  const mod = require(specifier) as SqliteModule;
  if (!mod?.DatabaseSync) {
    throw new Error("node:sqlite is not available in this Node.js runtime");
  }
  return mod;
}

const SCHEMA_STATEMENTS = [
  `create table if not exists packages (
    id text primary key,
    title text not null,
    description text,
    price_kobo integer not null,
    total_odds text,
    match_count integer,
    betting_code text not null,
    active integer not null default 1,
    created_at text not null default (datetime('now'))
  )`,
  `create table if not exists orders (
    id text primary key,
    reference text unique not null,
    package_id text not null references packages(id),
    customer_email text not null,
    amount_kobo integer not null,
    status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
    paystack_transaction_id text,
    paid_at text,
    created_at text not null default (datetime('now'))
  )`,
  `create index if not exists orders_customer_email_idx on orders (customer_email)`,
];

function resolveDatabasePath(): string {
  const configured = process.env["SQLITE_PATH"]?.trim();
  if (configured) {
    if (configured === ":memory:") return configured;
    fs.mkdirSync(path.dirname(configured), { recursive: true });
    return configured;
  }

  const dataDir = process.env["DATA_DIR"]?.trim() || path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  return path.join(dataDir, "bet-code-hub.sqlite");
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return Number(value ?? 0);
}

/**
 * Embedded SQLite backend. Used when DATABASE_URL is not configured so the
 * storefront is data-driven out of the box: the schema is created and the
 * starter catalogue is seeded on first boot.
 */
export function createSqliteStore(): Store {
  let database: SqliteDatabase | null = null;
  let location = "";

  function open(): SqliteDatabase {
    if (database) return database;

    const { DatabaseSync } = loadSqlite();
    try {
      location = resolveDatabasePath();
      database = new DatabaseSync(location);
    } catch (error) {
      // A read-only filesystem must not take the whole API down; fall back to a
      // throwaway in-memory database so the storefront still renders.
      logger.error({ err: error, location }, "SQLite file unavailable; using in-memory database");
      location = ":memory:";
      database = new DatabaseSync(location);
    }

    database.exec("pragma journal_mode = WAL");
    database.exec("pragma foreign_keys = ON");
    return database;
  }

  return {
    kind: "sqlite",

    async bootstrap(): Promise<void> {
      const db = open();

      for (const statement of SCHEMA_STATEMENTS) {
        db.exec(statement);
      }

      const insert = db.prepare(
        `insert or ignore into packages
          (id, title, description, price_kobo, total_odds, match_count, betting_code, active)
         values (?, ?, ?, ?, ?, ?, ?, 1)`,
      );

      let seeded = 0;
      for (const pkg of SEED_PACKAGES) {
        const result = insert.run(
          pkg.id,
          pkg.title,
          pkg.description,
          pkg.priceKobo,
          pkg.totalOdds,
          pkg.matchCount,
          pkg.bettingCode,
        ) as { changes?: number | bigint } | undefined;
        seeded += Number(result?.changes ?? 0);
      }

      logger.info({ backend: "sqlite", location, seeded }, "Database ready");
    },

    async listActivePackages(): Promise<StorePackage[]> {
      const rows = open()
        .prepare(
          `select id, title, description, price_kobo, total_odds, match_count
             from packages
            where active = 1
            order by price_kobo asc`,
        )
        .all();

      return rows.map((row) => ({
        id: String(row["id"]),
        title: String(row["title"]),
        description: row["description"] === null ? null : String(row["description"]),
        price_kobo: toNumber(row["price_kobo"]),
        total_odds: row["total_odds"] === null ? null : String(row["total_odds"]),
        match_count: row["match_count"] === null || row["match_count"] === undefined
          ? null
          : toNumber(row["match_count"]),
      }));
    },

    async findActivePackage(id: string): Promise<StorePackagePrice | null> {
      const row = open()
        .prepare("select id, price_kobo from packages where id = ? and active = 1 limit 1")
        .get(id);

      if (!row) return null;
      return { id: String(row["id"]), priceKobo: toNumber(row["price_kobo"]) };
    },

    async createOrder(input: CreateOrderInput): Promise<void> {
      open()
        .prepare(
          `insert into orders (id, reference, package_id, customer_email, amount_kobo, status)
           values (?, ?, ?, ?, ?, 'pending')`,
        )
        .run(
          randomUUID(),
          input.reference,
          input.packageId,
          input.customerEmail.trim().toLowerCase(),
          input.amountKobo,
        );
    },

    async updateOrderStatus(
      reference: string,
      status: OrderStatus,
      currentStatus?: OrderStatus,
    ): Promise<void> {
      const db = open();
      if (currentStatus) {
        db.prepare("update orders set status = ? where reference = ? and status = ?").run(
          status,
          reference,
          currentStatus,
        );
        return;
      }
      db.prepare("update orders set status = ? where reference = ?").run(status, reference);
    },

    async getOrderSummary(reference: string): Promise<OrderSummary | null> {
      const row = open()
        .prepare("select id, amount_kobo, status from orders where reference = ? limit 1")
        .get(reference);

      if (!row) return null;
      return {
        id: String(row["id"]),
        amountKobo: toNumber(row["amount_kobo"]),
        status: String(row["status"]) as OrderStatus,
      };
    },

    async markOrderPaid(input: {
      reference: string;
      transactionId?: string | number | null;
    }): Promise<boolean> {
      const result = open()
        .prepare(
          `update orders
              set status = 'paid',
                  paid_at = datetime('now'),
                  paystack_transaction_id = ?
            where reference = ? and status <> 'paid'`,
        )
        .run(
          input.transactionId === undefined || input.transactionId === null
            ? null
            : String(input.transactionId),
          input.reference,
        ) as { changes?: number | bigint } | undefined;

      return Number(result?.changes ?? 0) > 0;
    },

    async lookupOrder(input: { reference: string; email: string }): Promise<OrderLookup | null> {
      const row = open()
        .prepare(
          `select o.status as status, p.title as title, p.betting_code as code
             from orders o
             join packages p on p.id = o.package_id
            where o.reference = ? and lower(o.customer_email) = ?
            limit 1`,
        )
        .get(input.reference, input.email.trim().toLowerCase());

      if (!row) return null;
      return {
        status: String(row["status"]) as OrderStatus,
        title: String(row["title"]),
        code: String(row["code"]),
      };
    },
  };
}
