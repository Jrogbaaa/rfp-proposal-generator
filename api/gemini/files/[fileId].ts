import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../../_lib/cors.js'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const FILES_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCors(req, res)) return

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' })
  }

  const { fileId } = req.query

  try {
    await fetch(`${FILES_API_BASE}/files/${fileId}?key=${GEMINI_API_KEY}`, { method: 'DELETE' })
    return res.json({ ok: true })
  } catch (err) {
    console.error('[Gemini proxy] delete file error:', err)
    return res.status(502).json({ error: 'Failed to delete file' })
  }
}
