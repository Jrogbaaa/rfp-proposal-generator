import type { VercelRequest, VercelResponse } from '@vercel/node'

const ALLOWED_ORIGINS = new Set(
  [
    process.env.FRONTEND_ORIGIN,
    'https://www.rfpparamount.com',
    'https://rfpparamount.com',
    'http://localhost:5173',
  ].filter(Boolean)
)

export function setCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin as string | undefined
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
