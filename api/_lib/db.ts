import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

// In serverless, reuse the connection across warm invocations
const globalForDb = globalThis as unknown as { _db?: ReturnType<typeof drizzle> }

if (!globalForDb._db) {
  const queryClient = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 })
  globalForDb._db = drizzle(queryClient, { schema })
}

export const db = globalForDb._db
