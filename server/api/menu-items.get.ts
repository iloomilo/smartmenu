import { desc } from 'drizzle-orm'
import { menuItems } from '../db/schema'

export default defineEventHandler(async () => {
  const db = useDatabase()
  return await db.select().from(menuItems).orderBy(desc(menuItems.id))
})
