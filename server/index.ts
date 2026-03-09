import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import brandVoiceRouter from './routes/brandVoice.js'
import proposalsRouter from './routes/proposals.js'

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }))

app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api/brand-voice', brandVoiceRouter)
app.use('/api/proposals', proposalsRouter)

const PORT = 3001
app.listen(PORT, () => console.log(`API server running on :${PORT}`))
