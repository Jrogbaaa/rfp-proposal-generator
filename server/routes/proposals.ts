import { Router } from 'express'
import { getDb } from '../db.js'
import { proposals } from '../schema.js'
import { eq, sql } from 'drizzle-orm'

const router = Router()

function parseId(raw: string): number | null {
  const id = Number(raw)
  return isNaN(id) ? null : id
}

router.get('/', async (_req, res) => {
  try {
    const db = getDb()
    const rows = await db.select({
      id: proposals.id,
      company: proposals.company,
      projectTitle: proposals.projectTitle,
      slidesUrl: proposals.slidesUrl,
      createdAt: proposals.createdAt,
    }).from(proposals).orderBy(sql`${proposals.createdAt} desc`).limit(100)
    return res.json(rows)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to list proposals' })
  }
})

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: 'Invalid proposal ID' })

  try {
    const db = getDb()
    const rows = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1)
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    return res.json(rows[0])
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to fetch proposal' })
  }
})

router.post('/', async (req, res) => {
  try {
    const db = getDb()
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

router.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: 'Invalid proposal ID' })

  try {
    const db = getDb()
    const allowed = ['company', 'projectTitle', 'briefText', 'clientData', 'projectData', 'contentData', 'expandedData', 'designConfig', 'slidesUrl']
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in req.body) patch[key] = req.body[key]
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
})

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id)
  if (id === null) return res.status(400).json({ error: 'Invalid proposal ID' })

  try {
    const db = getDb()
    const deleted = await db.delete(proposals).where(eq(proposals.id, id)).returning({ id: proposals.id })
    if (deleted.length === 0) return res.status(404).json({ error: 'Not found' })
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Failed to delete proposal' })
  }
})

export default router
