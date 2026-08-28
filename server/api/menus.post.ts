import type { H3Event } from 'h3'
import { menus } from '../db/schema'
import { loadMenuDto } from '../utils/menu'

export default defineEventHandler(async (event) => {
  const db = useDatabase()
  const [menu] = await db.insert(menus).values({
    sourceLocale: 'de',
    targetLocale: defaultTargetLocale(event),
    currency: 'EUR',
    status: 'scanning',
  }).returning()

  return loadMenuDto(menu.uuid)
})

function defaultTargetLocale(event: H3Event) {
  const accept = getRequestHeader(event, 'accept-language') ?? 'en'
  const code = accept.slice(0, 2).toLowerCase()
  if (['en', 'de', 'es', 'fr'].includes(code)) return code
  return 'en'
}
