import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import compression from 'compression'
import geminiRouter from './routes/gemini.js'
import brandVoiceRouter from './routes/brandVoice.js'
import proposalsRouter from './routes/proposals.js'

const app = express()

const ALLOWED_ORIGINS = new Set(
  [process.env.FRONTEND_ORIGIN, 'http://localhost:5173'].filter(Boolean)
)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.has(origin)) callback(null, true)
    else callback(new Error('CORS rejected'))
  },
}))
app.use(compression())

app.use('/api/gemini', geminiRouter)

app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/brand-voice', brandVoiceRouter)
app.use('/api/proposals', proposalsRouter)

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const e = err as Error & { status?: number; statusCode?: number; length?: number; limit?: number }
  console.error('[server] Unhandled error:', err.message)
  const status = typeof e.status === 'number' ? e.status
    : typeof e.statusCode === 'number' ? e.statusCode
    : 500
  const message = status === 413
    ? `Request payload too large (limit: ${e.limit ?? 'unknown'} bytes, got: ${e.length ?? 'unknown'} bytes)`
    : status >= 400 && status < 500
      ? err.message || 'Bad request'
      : 'Internal server error'
  res.status(status).json({ error: message })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`API server running on :${PORT}`))
