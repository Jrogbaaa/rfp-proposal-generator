import { Router } from 'express'
import express from 'express'
import type { Request, Response } from 'express'

const router = Router()

const rateMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

function checkRate(req: Request, res: Response): boolean {
  const ip = req.ip ?? 'unknown'
  const now = Date.now()
  let entry = rateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS }
    rateMap.set(ip, entry)
  }
  entry.count++
  if (entry.count > RATE_LIMIT) {
    res.status(429).json({ error: 'Too many requests. Try again in a minute.' })
    return true
  }
  return false
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL   = process.env.GEMINI_MODEL || 'gemini-3-flash-preview'
const GEMINI_ENDPOINT  = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const FILES_API_UPLOAD = `https://generativelanguage.googleapis.com/upload/v1beta/files`
const FILES_API_BASE   = `https://generativelanguage.googleapis.com/v1beta`

const GENERATE_TIMEOUT_MS = 55_000
const UPLOAD_TIMEOUT_MS = 55_000

function missingKey(res: Response) {
  return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' })
}

router.post('/generate-content', express.json({ limit: '25mb' }), async (req: Request, res: Response) => {
  if (checkRate(req, res)) return
  if (!GEMINI_API_KEY) return missingKey(res)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS)

  try {
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

    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const data = await geminiRes.json()
    return res.status(geminiRes.status).json(data)
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
})

router.post('/upload-file', express.json({ limit: '100mb' }), async (req: Request, res: Response) => {
  if (checkRate(req, res)) return
  if (!GEMINI_API_KEY) return missingKey(res)

  const { base64Data, mimeType, fileName } = req.body as {
    base64Data?: string
    mimeType?: string
    fileName?: string
  }

  if (!base64Data || !mimeType || !fileName) {
    return res.status(400).json({ error: 'base64Data, mimeType, and fileName are required' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS)

  try {
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const metadata  = JSON.stringify({ file: { display_name: fileName } })

    const encoder     = new TextEncoder()
    const fileBytes   = Buffer.from(base64Data, 'base64')
    const metadataPart = Buffer.from(encoder.encode(`--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n`))
    const filePart     = Buffer.from(encoder.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`))
    const closingPart  = Buffer.from(encoder.encode(`\r\n--${boundary}--`))

    const body = Buffer.concat([metadataPart, filePart, fileBytes, closingPart])

    const uploadRes = await fetch(`${FILES_API_UPLOAD}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
      signal: controller.signal,
    })

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text()
      console.error('[Gemini proxy] Files API upload error:', errorText)
      return res.status(uploadRes.status).json({ error: `Files API upload failed: ${uploadRes.status}` })
    }

    const result  = await uploadRes.json()
    const fileUri = result.file?.uri
    if (!fileUri) return res.status(502).json({ error: 'Files API did not return a file URI' })
    return res.json({ fileUri })
  } catch (err) {
    if (controller.signal.aborted) {
      return res.status(504).json({ error: 'File upload timed out' })
    }
    console.error('[Gemini proxy] upload-file error:', err)
    return res.status(502).json({ error: 'Failed to upload file to Gemini Files API' })
  } finally {
    clearTimeout(timeout)
  }
})

router.delete('/files/:fileId', async (req: Request, res: Response) => {
  if (!GEMINI_API_KEY) return missingKey(res)

  const { fileId } = req.params
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return res.status(400).json({ error: 'Invalid file ID' })
  }

  try {
    await fetch(`${FILES_API_BASE}/files/${fileId}?key=${GEMINI_API_KEY}`, { method: 'DELETE' })
    return res.json({ ok: true })
  } catch (err) {
    console.error('[Gemini proxy] delete file error:', err)
    return res.status(502).json({ error: 'Failed to delete file' })
  }
})

export default router
