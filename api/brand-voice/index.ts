import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../_lib/db.js'
import { brandVoiceProfiles } from '../_lib/schema.js'
import { eq, sql } from 'drizzle-orm'
import { setCors } from '../_lib/cors.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCors(req, res)) return

  const db = getDb()

  if (req.method === 'GET') {
    try {
      const rows = await db.select().from(brandVoiceProfiles).where(eq(brandVoiceProfiles.name, 'default')).limit(1)
      if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
      return res.json(rows[0])
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Failed to fetch brand voice' })
    }
  }

  if (req.method === 'POST') {
    try {
      const { tone, sentenceStyle, perspective, forbiddenPhrases, preferredVocabulary, ctaStyle, proseSummary } = req.body ?? {}

      const existing = await db.select({ id: brandVoiceProfiles.id })
        .from(brandVoiceProfiles)
        .where(eq(brandVoiceProfiles.name, 'default'))
        .limit(1)

      if (existing.length > 0) {
        const updated = await db.update(brandVoiceProfiles)
          .set({ tone, sentenceStyle, perspective, forbiddenPhrases, preferredVocabulary, ctaStyle, proseSummary, updatedAt: sql`now()` })
          .where(eq(brandVoiceProfiles.name, 'default'))
          .returning()
        return res.json(updated[0])
      } else {
        const inserted = await db.insert(brandVoiceProfiles)
          .values({ name: 'default', tone, sentenceStyle, perspective, forbiddenPhrases, preferredVocabulary, ctaStyle, proseSummary })
          .returning()
        return res.json(inserted[0])
      }
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Failed to save brand voice' })
    }
  }

  if (req.method === 'DELETE') {
    try {
      await db.delete(brandVoiceProfiles).where(eq(brandVoiceProfiles.name, 'default'))
      return res.json({ ok: true })
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Failed to delete brand voice' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
