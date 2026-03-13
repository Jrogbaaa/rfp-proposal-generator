import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import geminiRouter from './routes/gemini.js'
import brandVoiceRouter from './routes/brandVoice.js'
import proposalsRouter from './routes/proposals.js'

const app = express()
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }))

// Gemini router must be mounted BEFORE the global json parser so it can apply
// its own per-route body limits (upload-file accepts up to 100mb of base64 data)
app.use('/api/gemini', geminiRouter)

app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/brand-voice', brandVoiceRouter)
app.use('/api/proposals', proposalsRouter)

const PORT = 3001
app.listen(PORT, () => console.log(`API server running on :${PORT}`))
