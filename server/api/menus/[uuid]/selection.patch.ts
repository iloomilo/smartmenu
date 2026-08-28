import { and, eq } from 'drizzle-orm'
import { loadMenuDto, requireMenu } from '../../../utils/menu'
import { orderLines } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const uuid = getRouterParam(event, 'uuid')
  if (!uuid) throw createError({ statusCode: 400, statusMessage: 'uuid required' })

  const body = await readBody<{ menuItemId?: number, quantity?: number }>(event)
  if (typeof body?.menuItemId !== 'number' || typeof body.quantity !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'menuItemId and quantity required' })
  }
  if (body.quantity < 0) {
    throw createError({ statusCode: 400, statusMessage: 'quantity must be >= 0' })
  }

  const menu = await requireMenu(uuid)
  const db = useDatabase()

  if (body.quantity === 0) {
    await db.delete(orderLines).where(and(
      eq(orderLines.menuId, menu.id),
      eq(orderLines.menuItemId, body.menuItemId),
    ))
  }
  else {
    const existing = await db.select().from(orderLines).where(and(
      eq(orderLines.menuId, menu.id),
      eq(orderLines.menuItemId, body.menuItemId),
    )).limit(1)

    if (existing[0]) {
      await db.update(orderLines).set({ quantity: body.quantity }).where(eq(orderLines.id, existing[0].id))
    }
    else {
      await db.insert(orderLines).values({
        menuId: menu.id,
        menuItemId: body.menuItemId,
        quantity: body.quantity,
      })
    }
  }

  return loadMenuDto(uuid)
})
