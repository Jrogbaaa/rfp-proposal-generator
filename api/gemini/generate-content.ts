import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' })
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  // Normalise thinking config: convert 2.5-style thinkingBudget to 3-style thinkingLevel
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

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await upstream.json()
    return res.status(upstream.status).json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(502).json({ error: 'Failed to reach Gemini API', detail: message })
  }
}
