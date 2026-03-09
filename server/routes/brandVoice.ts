import { Router } from 'express'
import { db } from '../db.js'
import { brandVoiceProfiles } from '../schema.js'
import { eq, sql } from 'drizzle-orm'

const router = Router()

// GET /api/brand-voice — return the default profile, or 404
router.get('/', async (_req, res) => {
  try {
    const rows = await db.select().from(brandVoiceProfiles).where(eq(brandVoiceProfiles.name, 'default')).limit(1)
    if (rows.length === 0) return res.status(404).json(null)
    return res.json(rows[0])
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch brand voice' })
  }
})

// POST /api/brand-voice — upsert the default profile
router.post('/', async (req, res) => {
  try {
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

// DELETE /api/brand-voice — clear the profile
router.delete('/', async (_req, res) => {
  try {
    await db.delete(brandVoiceProfiles).where(eq(brandVoiceProfiles.name, 'default'))
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to delete brand voice' })
  }
})

export default router
