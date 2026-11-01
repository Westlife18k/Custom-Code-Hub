import { isDatabaseConfigured } from "@workspace/db";

import { logger } from "../logger";
import { createPostgresStore } from "./postgres";
import { createSqliteStore } from "./sqlite";
import type { Store } from "./types";

export type {
  CreateOrderInput,
  OrderLookup,
  OrderStatus,
  OrderSummary,
  Store,
  StorePackage,
  StorePackagePrice,
} from "./types";

let cachedStore: Store | null = null;

/**
 * Picks the persistence backend once per process:
 *  - DATABASE_URL set  → Postgres (Drizzle) via @workspace/db
 *  - otherwise         → embedded SQLite file created on first boot
 *
 * The SQLite fallback keeps the storefront data-driven on hosts where no
 * database has been provisioned yet.
 */
export function getStore(): Store {
  if (cachedStore) return cachedStore;

  cachedStore = isDatabaseConfigured() ? createPostgresStore() : createSqliteStore();
  logger.info({ backend: cachedStore.kind }, "Selected data backend");
  return cachedStore;
}

/**
 * Creates the schema and seeds the starter catalogue. Failures are logged and
 * retried for Postgres so a slow database does not stop the API from booting;
 * the health route stays available either way.
 */
export async function prepareStore(): Promise<Store> {
  const store = getStore();
  const attempts = store.kind === "postgres" ? 5 : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await store.bootstrap();
      return store;
    } catch (error) {
      logger.error(
        { err: error, backend: store.kind, attempt, attempts },
        "Store bootstrap failed",
      );
      if (attempt === attempts) return store;
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }

  return store;
}
