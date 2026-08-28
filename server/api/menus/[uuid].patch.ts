import { eq } from 'drizzle-orm'
import { loadMenuDto, requireMenu } from '../../utils/menu'
import { menus, menuItems } from '../../db/schema'
import { translateCatalogItem } from '../../utils/mock-catalog'

export default defineEventHandler(async (event) => {
  const uuid = getRouterParam(event, 'uuid')
  if (!uuid) throw createError({ statusCode: 400, statusMessage: 'uuid required' })

  const body = await readBody<{ targetLocale?: string, status?: 'scanning' | 'review' | 'done' }>(event)
  const menu = await requireMenu(uuid)
  const db = useDatabase()

  if (body.targetLocale && body.targetLocale !== menu.targetLocale) {
    const items = await db.select().from(menuItems).where(eq(menuItems.menuId, menu.id))
    for (const item of items) {
      const t = translateCatalogItem(item.originalName, item.originalSection, body.targetLocale)
      await db.update(menuItems).set(t).where(eq(menuItems.id, item.id))
    }
    await db.update(menus).set({ targetLocale: body.targetLocale }).where(eq(menus.id, menu.id))
  }

  if (body.status) {
    await db.update(menus).set({ status: body.status }).where(eq(menus.id, menu.id))
  }

  return loadMenuDto(uuid)
})
