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

  const { base64Data, mimeType, fileName } = req.body as {
    base64Data?: string
    mimeType?: string
    fileName?: string
  }

  if (!base64Data || !mimeType || !fileName) {
    return res.status(400).json({ error: 'base64Data, mimeType, and fileName are required' })
  }

  try {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const metadata = JSON.stringify({ file: { display_name: fileName } })

    const encoder = new TextEncoder()
    const fileBytes = Buffer.from(base64Data, 'base64')
    const metadataPart = Buffer.from(encoder.encode(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n`))
    const filePart = Buffer.from(encoder.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`))
    const closingPart = Buffer.from(encoder.encode(`\r\n--${boundary}--`))

    const body = Buffer.concat([metadataPart, filePart, fileBytes, closingPart])

    const uploadRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    })

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text()
      console.error('[Gemini proxy] Files API upload error:', errorText)
      return res.status(uploadRes.status).json({ error: `Files API upload failed: ${uploadRes.status}` })
    }

    const result = await uploadRes.json()
    const fileUri = result.file?.uri
    if (!fileUri) return res.status(502).json({ error: 'Files API did not return a file URI' })
    return res.json({ fileUri })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(502).json({ error: 'Failed to upload file to Gemini Files API', detail: message })
  }
}
