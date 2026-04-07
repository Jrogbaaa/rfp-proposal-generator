import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const globalForDb = globalThis as unknown as { _db?: ReturnType<typeof drizzle> }

export function getDb() {
  if (!globalForDb._db) {
    const queryClient = postgres(process.env.DATABASE_URL!, { ssl: 'require' })
    globalForDb._db = drizzle(queryClient, { schema })
  }
  return globalForDb._db
}

/** @deprecated Use getDb() for lazy initialization */
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    return (getDb() as Record<string | symbol, unknown>)[prop]
  },
})
