import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

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
  `create table if not exists deposits (
    id text primary key,
    reference text unique not null,
    email text not null,
    amount_pesewas integer not null check (amount_pesewas > 0),
    currency text not null default 'GHS',
    status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
    channel text,
    paystack_transaction_id text,
    paid_at text,
    created_at text not null default (datetime('now'))
  )`,
  `create index if not exists deposits_email_idx on deposits (email, created_at desc)`,
  `create table if not exists wallets (
    email text primary key,
    balance_pesewas integer not null default 0,
    updated_at text not null default (datetime('now'))
  )`,
  // The unique constraint on deposit_reference is the hard guarantee that a
  // deposit can never credit a wallet twice, whatever path (verify or webhook)
  // gets there first.
  `create table if not exists wallet_credits (
    id text primary key,
    deposit_reference text unique not null,
    email text not null,
    amount_pesewas integer not null,
    created_at text not null default (datetime('now'))
  )`,
];

const DATABASE_FILENAME = "bet-code-hub.sqlite";
const IN_MEMORY_LOCATION = ":memory:";

/**
 * Ordered list of file locations to try, most durable first. An operator-set
 * path always wins; otherwise the persistent disk mount (/app/data in the
 * container image) is preferred over the working directory or a temp dir.
 */
function candidatePaths(): string[] {
  const configured = process.env["SQLITE_PATH"]?.trim();
  if (configured === IN_MEMORY_LOCATION) return [IN_MEMORY_LOCATION];

  const candidates: string[] = [];
  if (configured) candidates.push(configured);

  const dataDir = process.env["DATA_DIR"]?.trim();
  if (dataDir) candidates.push(path.join(dataDir, DATABASE_FILENAME));

  candidates.push(path.join(process.cwd(), "data", DATABASE_FILENAME));
  candidates.push(path.join(os.tmpdir(), DATABASE_FILENAME));

  return [...new Set(candidates)];
}

/**
 * Creates a directory tree one segment at a time.
 *
 * `fs.mkdirSync(dir, { recursive: true })` can spin without ever throwing when
 * the parent filesystem keeps answering `ENOENT` (seen with pseudo filesystems
 * such as /proc), which would hang startup instead of letting us fall through to
 * the next candidate. This bounded walk always terminates.
 */
function ensureDirectory(directory: string): void {
  const segments = path.resolve(directory).split(path.sep).filter(Boolean);
  let current: string = path.sep;

  for (const segment of segments) {
    current = path.join(current, segment);

    let exists = false;
    try {
      exists = fs.statSync(current).isDirectory();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
    }

    if (exists) continue;
    if (fs.existsSync(current)) {
      throw new Error(`${current} exists but is not a directory`);
    }
    fs.mkdirSync(current);
  }
}

/**
 * Opens the first candidate location that is actually usable. A read-only or
 * missing mount must not silently degrade to a throwaway in-memory database on
 * the first attempt, so every candidate gets a real write test before the
 * in-memory database is chosen as a last resort.
 */
function openDatabase(DatabaseSync: SqliteModule["DatabaseSync"]): {
  database: SqliteDatabase;
  location: string;
} {
  for (const candidate of candidatePaths()) {
    if (candidate === IN_MEMORY_LOCATION) {
      logger.warn("No persistent SQLite location configured; using an in-memory database");
      return { database: new DatabaseSync(IN_MEMORY_LOCATION), location: IN_MEMORY_LOCATION };
    }

    try {
      ensureDirectory(path.dirname(candidate));
      const database = new DatabaseSync(candidate);
      // `pragma journal_mode = WAL` needs a writable directory; running it here
      // proves the mount is genuinely usable before we commit to it.
      database.exec("pragma journal_mode = WAL");
      return { database, location: candidate };
    } catch (error) {
      logger.warn({ candidate, err: error }, "SQLite location is not usable; trying the next one");
    }
  }

  logger.error("No writable SQLite location found; falling back to an in-memory database");
  return { database: new DatabaseSync(IN_MEMORY_LOCATION), location: IN_MEMORY_LOCATION };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  return Number(value ?? 0);
}

function toText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function mapDeposit(row: Record<string, unknown>): DepositRecord {
  return {
    reference: String(row["reference"]),
    email: String(row["email"]),
    amountPesewas: toNumber(row["amount_pesewas"]),
    status: String(row["status"]) as DepositStatus,
    channel: toText(row["channel"]),
    paystackTransactionId: toText(row["paystack_transaction_id"]),
    paidAt: toText(row["paid_at"]),
    createdAt: String(row["created_at"] ?? ""),
  };
}

function mapAdminPackage(row: Record<string, unknown>): AdminPackage {
  return {
    id: String(row["id"]),
    title: String(row["title"]),
    description: toText(row["description"]),
    pricePesewas: toNumber(row["price_kobo"]),
    totalOdds: toText(row["total_odds"]),
    matchCount: row["match_count"] === null || row["match_count"] === undefined
      ? null
      : toNumber(row["match_count"]),
    bettingCode: String(row["betting_code"] ?? ""),
    active: toNumber(row["active"]) === 1,
    createdAt: String(row["created_at"] ?? ""),
  };
}

const ADMIN_PACKAGE_COLUMNS =
  "id, title, description, price_kobo, total_odds, match_count, betting_code, active, created_at";

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
    const opened = openDatabase(DatabaseSync);
    database = opened.database;
    location = opened.location;

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

    async createDeposit(input: CreateDepositInput): Promise<void> {
      open()
        .prepare(
          `insert into deposits (id, reference, email, amount_pesewas, status, channel)
           values (?, ?, ?, ?, 'pending', ?)`,
        )
        .run(
          randomUUID(),
          input.reference,
          input.email.trim().toLowerCase(),
          input.amountPesewas,
          input.channel,
        );
    },

    async getDeposit(reference: string): Promise<DepositRecord | null> {
      const row = open()
        .prepare(
          `select reference, email, amount_pesewas, status, channel,
                  paystack_transaction_id, paid_at, created_at
             from deposits
            where reference = ?
            limit 1`,
        )
        .get(reference);
      return row ? mapDeposit(row) : null;
    },

    async updateDepositStatus(
      reference: string,
      status: DepositStatus,
      currentStatus?: DepositStatus,
    ): Promise<void> {
      if (currentStatus) {
        open()
          .prepare(`update deposits set status = ? where reference = ? and status = ?`)
          .run(status, reference, currentStatus);
        return;
      }
      open().prepare(`update deposits set status = ? where reference = ?`).run(status, reference);
    },

    async creditDeposit(input: CreditDepositInput): Promise<CreditOutcome> {
      const db = open();
      // BEGIN IMMEDIATE takes the write lock up front, so two concurrent
      // callers (webhook + verify) cannot both pass the status check.
      db.exec("begin immediate");
      try {
        const row = db
          .prepare(`select email, amount_pesewas, status from deposits where reference = ? limit 1`)
          .get(input.reference);

        if (!row) {
          db.exec("rollback");
          return "not_found";
        }

        const email = String(row["email"]);
        const amountPesewas = toNumber(row["amount_pesewas"]);
        const status = String(row["status"]) as DepositStatus;

        if (status === "success") {
          db.exec("rollback");
          return "already_credited";
        }

        if (
          typeof input.amountPesewas === "number" &&
          Number.isFinite(input.amountPesewas) &&
          input.amountPesewas !== amountPesewas
        ) {
          db.exec("rollback");
          return "amount_mismatch";
        }

        const inserted = db
          .prepare(
            `insert or ignore into wallet_credits (id, deposit_reference, email, amount_pesewas)
             values (?, ?, ?, ?)`,
          )
          .run(randomUUID(), input.reference, email, amountPesewas) as
          | { changes?: number | bigint }
          | undefined;

        if (Number(inserted?.changes ?? 0) === 0) {
          db.exec("rollback");
          return "already_credited";
        }

        db.prepare(
          `update deposits
              set status = 'success',
                  paid_at = datetime('now'),
                  paystack_transaction_id = ?
            where reference = ?`,
        ).run(
          input.transactionId === undefined || input.transactionId === null
            ? null
            : String(input.transactionId),
          input.reference,
        );

        db.prepare(
          `insert into wallets (email, balance_pesewas, updated_at)
           values (?, ?, datetime('now'))
           on conflict(email) do update
             set balance_pesewas = wallets.balance_pesewas + excluded.balance_pesewas,
                 updated_at = datetime('now')`,
        ).run(email, amountPesewas);

        db.exec("commit");
        return "credited";
      } catch (error) {
        try {
          db.exec("rollback");
        } catch {
          // The transaction was already rolled back.
        }
        throw error;
      }
    },

    async listDeposits(email: string, limit: number): Promise<DepositRecord[]> {
      const rows = open()
        .prepare(
          `select reference, email, amount_pesewas, status, channel,
                  paystack_transaction_id, paid_at, created_at
             from deposits
            where email = ?
            order by created_at desc, reference desc
            limit ?`,
        )
        .all(email.trim().toLowerCase(), limit);
      return rows.map(mapDeposit);
    },

    async getWallet(email: string): Promise<WalletSummary> {
      const normalised = email.trim().toLowerCase();
      const row = open()
        .prepare(`select balance_pesewas from wallets where email = ? limit 1`)
        .get(normalised);
      return {
        email: normalised,
        balancePesewas: row ? toNumber(row["balance_pesewas"]) : 0,
      };
    },
  };
}
