import { pgTable, bigint, text, integer, timestamp, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const menuItems = pgTable('menu_items', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  name: text('name').notNull(),
  priceCents: integer('price_cents').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  check('price_cents_non_negative', sql`${table.priceCents} >= 0`),
])

export type MenuItem = typeof menuItems.$inferSelect
export type NewMenuItem = typeof menuItems.$inferInsert
