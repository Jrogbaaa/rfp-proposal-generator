/**
 * Gemini API proxy — keeps the API key server-side so it is never exposed
 * in the browser bundle.
 *
 * Routes:
 *   POST /api/gemini/generate-content   — proxy to generateContent
 *   POST /api/gemini/upload-file        — upload base64 PDF to Files API, return fileUri
 *   DELETE /api/gemini/files/:fileId    — delete file from Files API
 */

import { Router } from 'express'
import express from 'express'
import type { Request, Response } from 'express'

const router = Router()

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL   = process.env.GEMINI_MODEL || 'gemini-3-flash-preview'
const GEMINI_ENDPOINT  = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const FILES_API_UPLOAD = `https://generativelanguage.googleapis.com/upload/v1beta/files`
const FILES_API_BASE   = `https://generativelanguage.googleapis.com/v1beta`

function missingKey(res: Response) {
  return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' })
}

// POST /api/gemini/generate-content
// Proxies the Gemini generateContent request, injecting the server-side API key.
// Body: raw Gemini request object (contents, systemInstruction, generationConfig, …)
router.post('/generate-content', express.json({ limit: '2mb' }), async (req: Request, res: Response) => {
  if (!GEMINI_API_KEY) return missingKey(res)

  try {
    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })

    const data = await geminiRes.json()
    return res.status(geminiRes.status).json(data)
  } catch (err) {
    console.error('[Gemini proxy] generate-content error:', err)
    return res.status(502).json({ error: 'Failed to reach Gemini API' })
  }
})

// POST /api/gemini/upload-file
// Accepts a base64-encoded file and uploads it to the Gemini Files API.
// Body: { base64Data: string, mimeType: string, fileName: string }
// Returns: { fileUri: string }
router.post('/upload-file', express.json({ limit: '100mb' }), async (req: Request, res: Response) => {
  if (!GEMINI_API_KEY) return missingKey(res)

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
    console.error('[Gemini proxy] upload-file error:', err)
    return res.status(502).json({ error: 'Failed to upload file to Gemini Files API' })
  }
})

// DELETE /api/gemini/files/:fileId
// Fire-and-forget deletion from the Gemini Files API.
router.delete('/files/:fileId', async (req: Request, res: Response) => {
  if (!GEMINI_API_KEY) return missingKey(res)

  try {
    await fetch(`${FILES_API_BASE}/files/${req.params.fileId}?key=${GEMINI_API_KEY}`, { method: 'DELETE' })
    return res.json({ ok: true })
  } catch (err) {
    console.error('[Gemini proxy] delete file error:', err)
    return res.status(502).json({ error: 'Failed to delete file' })
  }
})

export default router
