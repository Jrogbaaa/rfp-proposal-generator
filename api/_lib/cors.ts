import type { VercelRequest, VercelResponse } from '@vercel/node'

const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://rfp-proposal-generator-kappa.vercel.app'

export const setCors = (req: VercelRequest, res: VercelResponse): boolean => {
  const origin = req.headers.origin || ALLOWED_ORIGIN
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
