import { menuItems } from '../db/schema'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name?: string, priceCents?: number }>(event)

  if (!body?.name || typeof body.priceCents !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'name und priceCents erforderlich' })
  }

  const db = useDatabase()
  const [item] = await db
    .insert(menuItems)
    .values({ name: body.name, priceCents: body.priceCents })
    .returning()

  return item
})
