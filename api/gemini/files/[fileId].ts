import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../../_lib/cors.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCors(req, res)) return

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' })
  }

  const fileId = req.query.fileId as string
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return res.status(400).json({ error: 'Invalid file ID' })
  }

  try {
    await fetch(`https://generativelanguage.googleapis.com/v1beta/files/${fileId}?key=${apiKey}`, { method: 'DELETE' })
    return res.json({ ok: true })
  } catch (err: unknown) {
    console.error('[Gemini proxy] delete file error:', err)
    return res.status(502).json({ error: 'Failed to delete file' })
  }
}
