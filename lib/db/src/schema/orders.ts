import { bigint, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { packagesTable } from "./packages";

/**
 * Mirrors public.orders in supabase/schema.sql.
 * Amounts are stored in kobo/pesewas (100 = GH₵1).
 */
export const ordersTable = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    packageId: uuid("package_id")
      .notNull()
      .references(() => packagesTable.id),
    customerEmail: text("customer_email").notNull(),
    amountKobo: bigint("amount_kobo", { mode: "number" }).notNull(),
    status: text("status").notNull().default("pending"),
    paystackTransactionId: text("paystack_transaction_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    customerEmailIdx: index("orders_customer_email_idx").on(table.customerEmail),
  }),
);

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderStatus = "pending" | "paid" | "failed";
