import { Router } from 'express'
import { getDb } from '../db.js'
import { brandVoiceProfiles } from '../schema.js'
import { eq, sql } from 'drizzle-orm'

const router = Router()

router.get('/', async (_req, res) => {
  try {
    const db = getDb()
    const rows = await db.select().from(brandVoiceProfiles).where(eq(brandVoiceProfiles.name, 'default')).limit(1)
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    return res.json(rows[0])
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch brand voice' })
  }
})

router.post('/', async (req, res) => {
  try {
    const db = getDb()
    const { tone, sentenceStyle, perspective, forbiddenPhrases, preferredVocabulary, ctaStyle, proseSummary } = req.body

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
})

router.delete('/', async (_req, res) => {
  try {
    const db = getDb()
    await db.delete(brandVoiceProfiles).where(eq(brandVoiceProfiles.name, 'default'))
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to delete brand voice' })
  }
})

export default router
