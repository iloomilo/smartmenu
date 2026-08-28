import { eq } from 'drizzle-orm'
import { menuItems, menus, orderLines } from '../db/schema'
import type { MenuDto, MenuItemDto, MenuStatus } from '../../shared/types'

export async function loadMenuDto(uuid: string): Promise<MenuDto | null> {
  const db = useDatabase()
  const [menu] = await db.select().from(menus).where(eq(menus.uuid, uuid)).limit(1)
  if (!menu) return null

  const items = await db.select().from(menuItems).where(eq(menuItems.menuId, menu.id))
  const lines = await db.select().from(orderLines).where(eq(orderLines.menuId, menu.id))

  return {
    uuid: menu.uuid,
    sourceLocale: menu.sourceLocale,
    targetLocale: menu.targetLocale,
    currency: menu.currency,
    status: menu.status as MenuStatus,
    items: items.map(toItemDto),
    orderLines: lines.map(line => ({ menuItemId: line.menuItemId, quantity: line.quantity })),
  }
}

export function toItemDto(row: typeof menuItems.$inferSelect): MenuItemDto {
  return {
    id: row.id,
    originalName: row.originalName,
    translatedName: row.translatedName,
    originalDescription: row.originalDescription,
    translatedDescription: row.translatedDescription,
    originalSection: row.originalSection,
    translatedSection: row.translatedSection,
    price: row.price,
    priceLabel: row.priceLabel,
    page: row.page,
  }
}

export async function requireMenu(uuid: string) {
  const db = useDatabase()
  const [menu] = await db.select().from(menus).where(eq(menus.uuid, uuid)).limit(1)
  if (!menu) {
    throw createError({ statusCode: 404, statusMessage: 'Menu not found' })
  }
  return menu
}
