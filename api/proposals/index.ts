import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getDb } from '../_lib/db.js'
import { proposals } from '../_lib/schema.js'
import { sql } from 'drizzle-orm'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const db = getDb()

  if (req.method === 'GET') {
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
  }

  if (req.method === 'POST') {
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
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
