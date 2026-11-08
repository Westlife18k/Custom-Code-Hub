import { bigint, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Wallet deposits (Paystack, test mode) and the credit ledger.
 * Amounts are stored in pesewas (100 = GH₵1).
 *
 * walletCredits.depositReference is UNIQUE: that constraint is what makes a
 * replayed webhook or a repeated verification unable to credit twice.
 */
export const depositsTable = pgTable(
  "deposits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    email: text("email").notNull(),
    amountPesewas: bigint("amount_pesewas", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("GHS"),
    status: text("status").notNull().default("pending"),
    channel: text("channel"),
    paystackTransactionId: text("paystack_transaction_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("deposits_email_idx").on(table.email),
  }),
);

export const walletsTable = pgTable("wallets", {
  email: text("email").primaryKey(),
  balancePesewas: bigint("balance_pesewas", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const walletCreditsTable = pgTable("wallet_credits", {
  id: uuid("id").primaryKey().defaultRandom(),
  depositReference: text("deposit_reference").notNull().unique(),
  email: text("email").notNull(),
  amountPesewas: integer("amount_pesewas").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDepositSchema = createInsertSchema(depositsTable).omit({
  id: true,
  createdAt: true,
});

export type InsertDeposit = z.infer<typeof insertDepositSchema>;
export type Deposit = typeof depositsTable.$inferSelect;
export type Wallet = typeof walletsTable.$inferSelect;
export type WalletCredit = typeof walletCreditsTable.$inferSelect;
