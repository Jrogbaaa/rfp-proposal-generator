import { Router } from 'express'
import { db } from '../db.js'
import { proposals } from '../schema.js'
import { eq, sql } from 'drizzle-orm'

const router = Router()

// GET /api/proposals — list all (summary fields only)
router.get('/', async (_req, res) => {
  try {
    const rows = await db.select({
      id: proposals.id,
      company: proposals.company,
      projectTitle: proposals.projectTitle,
      slidesUrl: proposals.slidesUrl,
      createdAt: proposals.createdAt,
    }).from(proposals).orderBy(sql`${proposals.createdAt} desc`)
    return res.json(rows)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to list proposals' })
  }
})

// GET /api/proposals/:id — full record
router.get('/:id', async (req, res) => {
  try {
    const rows = await db.select().from(proposals).where(eq(proposals.id, Number(req.params.id))).limit(1)
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    return res.json(rows[0])
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch proposal' })
  }
})

// POST /api/proposals — create
router.post('/', async (req, res) => {
  try {
    const { company, projectTitle, briefText, clientData, projectData, contentData, expandedData, designConfig, slidesUrl } = req.body
    const inserted = await db.insert(proposals)
      .values({ company, projectTitle, briefText, clientData, projectData, contentData, expandedData, designConfig, slidesUrl })
      .returning({ id: proposals.id })
    return res.status(201).json(inserted[0])
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to create proposal' })
  }
})

// PATCH /api/proposals/:id — partial update
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['company', 'projectTitle', 'briefText', 'clientData', 'projectData', 'contentData', 'expandedData', 'designConfig', 'slidesUrl']
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in req.body) patch[key] = req.body[key]
    }
    patch.updatedAt = sql`now()`

    const updated = await db.update(proposals)
      .set(patch as Parameters<typeof db.update>[0] extends infer T ? T : never)
      .where(eq(proposals.id, Number(req.params.id)))
      .returning({ id: proposals.id })
    if (updated.length === 0) return res.status(404).json({ error: 'Not found' })
    return res.json(updated[0])
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to update proposal' })
  }
})

// DELETE /api/proposals/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.delete(proposals).where(eq(proposals.id, Number(req.params.id)))
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to delete proposal' })
  }
})

export default router
