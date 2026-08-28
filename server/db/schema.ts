import { pgTable, bigint, text, integer, timestamp, uuid, doublePrecision, unique, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const menus = pgTable('menus', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  uuid: uuid('uuid').notNull().unique().defaultRandom(),
  sourceLocale: text('source_locale').notNull().default('de'),
  targetLocale: text('target_locale').notNull().default('en'),
  currency: text('currency').notNull().default('EUR'),
  status: text('status').notNull().default('scanning'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const menuItems = pgTable('menu_items', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  menuId: bigint('menu_id', { mode: 'number' }).notNull().references(() => menus.id, { onDelete: 'cascade' }),
  originalName: text('original_name').notNull(),
  translatedName: text('translated_name').notNull(),
  originalDescription: text('original_description'),
  translatedDescription: text('translated_description'),
  originalSection: text('original_section').notNull(),
  translatedSection: text('translated_section').notNull(),
  price: doublePrecision('price'),
  priceLabel: text('price_label'),
  page: integer('page'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique('menu_items_upsert_key').on(table.menuId, table.originalName, table.originalSection),
  check('price_non_negative', sql`${table.price} IS NULL OR ${table.price} >= 0`),
])

export const orderLines = pgTable('order_lines', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  menuId: bigint('menu_id', { mode: 'number' }).notNull().references(() => menus.id, { onDelete: 'cascade' }),
  menuItemId: bigint('menu_item_id', { mode: 'number' }).notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(1),
}, table => [
  unique('order_lines_item_key').on(table.menuId, table.menuItemId),
  check('quantity_non_negative', sql`${table.quantity} >= 0`),
])

export type Menu = typeof menus.$inferSelect
export type MenuItem = typeof menuItems.$inferSelect
export type OrderLine = typeof orderLines.$inferSelect
