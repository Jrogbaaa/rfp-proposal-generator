import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from '../_lib/cors.js'

// Vercel serverless function `maxDuration` is 60s (see vercel.json).
// Leave ~2s of headroom for response serialization + cold-start overhead.
const UPSTREAM_TIMEOUT_MS = 58_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (setCors(req, res)) return

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' })
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const body = { ...req.body }
  if (body.generationConfig?.thinkingConfig) {
    const tc = body.generationConfig.thinkingConfig
    if ('thinkingBudget' in tc && !('thinkingLevel' in tc)) {
      body.generationConfig = {
        ...body.generationConfig,
        thinkingConfig: { thinkingLevel: tc.thinkingBudget === 0 ? 'low' : 'medium' },
      }
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const data = await upstream.json()
    return res.status(upstream.status).json(data)
  } catch (err: unknown) {
    if (controller.signal.aborted) {
      return res.status(504).json({ error: 'Gemini API request timed out' })
    }
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Gemini proxy] generate-content error:', message)
    return res.status(502).json({ error: 'Failed to reach Gemini API' })
  } finally {
    clearTimeout(timeout)
  }
}
