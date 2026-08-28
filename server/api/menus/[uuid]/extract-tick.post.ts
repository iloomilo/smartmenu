import { and, eq } from 'drizzle-orm'
import { FRAME_PATCHES, translatePatch } from '../../../utils/mock-catalog'
import { loadMenuDto, requireMenu } from '../../../utils/menu'
import { menuItems } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  const uuid = getRouterParam(event, 'uuid')
  if (!uuid) throw createError({ statusCode: 400, statusMessage: 'uuid required' })

  const body = await readBody<{ frameIndex?: number }>(event)
  if (typeof body?.frameIndex !== 'number') {
    throw createError({ statusCode: 400, statusMessage: 'frameIndex required' })
  }

  const patches = FRAME_PATCHES[body.frameIndex]
  if (!patches) {
    return loadMenuDto(uuid)
  }

  const menu = await requireMenu(uuid)
  const db = useDatabase()

  for (const patch of patches) {
    const translated = translatePatch(patch, menu.targetLocale)
    const existing = await db.select().from(menuItems).where(and(
      eq(menuItems.menuId, menu.id),
      eq(menuItems.originalName, translated.originalName),
      eq(menuItems.originalSection, translated.originalSection),
    )).limit(1)

    if (existing[0]) {
      const current = existing[0]
      await db.update(menuItems).set({
        translatedName: translated.translatedName,
        originalDescription: translated.originalDescription ?? current.originalDescription,
        translatedDescription: translated.translatedDescription ?? current.translatedDescription,
        translatedSection: translated.translatedSection,
        price: translated.price ?? current.price,
        priceLabel: translated.priceLabel ?? current.priceLabel,
        page: translated.page ?? current.page,
      }).where(eq(menuItems.id, current.id))
    }
    else {
      await db.insert(menuItems).values({
        menuId: menu.id,
        originalName: translated.originalName,
        translatedName: translated.translatedName,
        originalDescription: translated.originalDescription,
        translatedDescription: translated.translatedDescription,
        originalSection: translated.originalSection,
        translatedSection: translated.translatedSection,
        price: translated.price,
        priceLabel: translated.priceLabel,
        page: translated.page,
      })
    }
  }

  return loadMenuDto(uuid)
})
