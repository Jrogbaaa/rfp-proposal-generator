import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../_lib/db.js'
import { proposals } from '../_lib/schema.js'
import { eq, sql } from 'drizzle-orm'
import { setCors } from '../_lib/cors.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCors(req, res)) return

  const id = Number(req.query.id)
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid proposal ID' })
  }

  const db = getDb()

  if (req.method === 'GET') {
    try {
      const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1)
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
      return res.json(rows[0])
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Failed to fetch proposal' })
    }
  }

  if (req.method === 'PATCH') {
    try {
      const allowed = ['company', 'projectTitle', 'briefText', 'clientData', 'projectData', 'contentData', 'expandedData', 'designConfig', 'slidesUrl']
      const patch: Record<string, unknown> = {}
      for (const key of allowed) {
        if (key in (req.body ?? {})) patch[key] = req.body[key]
      }
      patch.updatedAt = sql`now()`

      const updated = await db.update(proposals)
        .set(patch as never)
        .where(eq(proposals.id, id))
        .returning({ id: proposals.id })
      if (updated.length === 0) return res.status(404).json({ error: 'Not found' })
      return res.json(updated[0])
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Failed to update proposal' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      const deleted = await db.delete(proposals).where(eq(proposals.id, id)).returning({ id: proposals.id })
      if (deleted.length === 0) return res.status(404).json({ error: 'Not found' })
      return res.json({ ok: true })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Failed to delete proposal' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
