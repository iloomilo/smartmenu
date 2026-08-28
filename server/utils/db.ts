import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../db/schema'

let db: ReturnType<typeof drizzle<typeof schema>> | undefined

export function useDatabase() {
  if (!db) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL ist nicht gesetzt (siehe .env.example)')

    const client = postgres(url, { max: 10, idle_timeout: 20 })
    db = drizzle(client, { schema })
  }
  return db
}
