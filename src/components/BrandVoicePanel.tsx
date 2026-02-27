import { useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { extractBrandVoice } from '../utils/llmService'

const STORAGE_KEY = 'rfp_brand_voice'
const STORAGE_COUNT_KEY = 'rfp_brand_voice_count'

interface BrandVoicePanelProps {
  brandVoice: string | null
  onBrandVoiceExtracted: (voice: string, fileCount: number) => void
}

const STAGES = [
  'Reading documents',
  'Analysing tone & vocabulary',
  'Building voice profile',
]

export default function BrandVoicePanel({ brandVoice, onBrandVoiceExtracted }: BrandVoicePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isExpanded, setIsExpanded] = useState(!brandVoice)
  const [isDragActive, setIsDragActive] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStage, setProcessingStage] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [stagedFiles, setStagedFiles] = useState<File[]>([])

  const trainedCount = brandVoice
    ? parseInt(localStorage.getItem(STORAGE_COUNT_KEY) || '0', 10)
    : 0

  const handleFiles = useCallback((files: File[]) => {
    const pdfs = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'))
    if (!pdfs.length) {
      setError('Please upload PDF files only')
      return
    }
    setError(null)
    setStagedFiles(pdfs)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }, [handleFiles])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFiles(Array.from(e.target.files))
    e.target.value = ''
  }, [handleFiles])

  const handleTrain = useCallback(async () => {
    if (!stagedFiles.length || isProcessing) return
    setError(null)
    setIsProcessing(true)
    setProcessingStage(0)

    const t1 = setTimeout(() => setProcessingStage(1), 1500)
    const t2 = setTimeout(() => setProcessingStage(2), 4000)

    try {
      const voice = await extractBrandVoice(stagedFiles)
      clearTimeout(t1)
      clearTimeout(t2)
      localStorage.setItem(STORAGE_KEY, voice)
      localStorage.setItem(STORAGE_COUNT_KEY, String(stagedFiles.length))
      onBrandVoiceExtracted(voice, stagedFiles.length)
      setStagedFiles([])
      setIsExpanded(false)
    } catch (err) {
      clearTimeout(t1)
      clearTimeout(t2)
      console.error('[BrandVoicePanel] Extraction failed:', err)
      setError('Failed to analyse PDFs. Please try again.')
    } finally {
      setIsProcessing(false)
      setProcessingStage(0)
    }
  }, [stagedFiles, isProcessing, onBrandVoiceExtracted])

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_COUNT_KEY)
    onBrandVoiceExtracted('', 0)
    setStagedFiles([])
    setIsExpanded(true)
  }

  const voicePreview = brandVoice
    ? brandVoice.split(/[.!?]/).filter(s => s.trim().length > 20).slice(0, 1).join('.').trim() + '.'
    : null

  return (
    <div className="rounded-xl border border-cream-300 bg-white overflow-hidden mb-4">
      {/* Header row — always visible */}
      <button
        onClick={() => setIsExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-cream-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${brandVoice ? 'bg-gold-500/15' : 'bg-navy-100'}`}>
            <svg
              className={`w-3 h-3 ${brandVoice ? 'text-gold-600' : 'text-navy-400'}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-navy-700">Brand Voice</span>
          {brandVoice ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-700 text-xs font-medium">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Trained on {trainedCount} doc{trainedCount !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full bg-navy-100 text-navy-500 text-xs font-medium">
              Not configured
            </span>
          )}
        </div>
        <motion.svg
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-4 h-4 text-navy-400 flex-shrink-0"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 pt-1 border-t border-cream-200">
              {/* Voice preview if trained */}
              {voicePreview && !stagedFiles.length && (
                <p className="text-xs text-navy-500 italic mb-3 leading-relaxed line-clamp-2">
                  "{voicePreview}"
                </p>
              )}

              {/* Drop zone */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={handleInputChange}
                className="hidden"
              />

              <div
                onDragOver={handleDragOver}
                onDragEnter={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={`
                  rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-all duration-200
                  ${isDragActive
                    ? 'border-gold-400 bg-gold-500/5'
                    : 'border-cream-300 bg-cream-50 hover:border-navy-300 hover:bg-white'
                  }
                  ${isProcessing ? 'pointer-events-none opacity-60' : ''}
                `}
              >
                {stagedFiles.length > 0 ? (
                  <div className="flex flex-col items-center gap-1">
                    <svg className="w-5 h-5 text-gold-500 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <p className="text-sm font-medium text-navy-700">
                      {stagedFiles.length} PDF{stagedFiles.length !== 1 ? 's' : ''} ready
                    </p>
                    <p className="text-xs text-navy-400">{stagedFiles.map(f => f.name).join(', ')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <svg className="w-5 h-5 text-navy-300 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" />
                      <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
                    </svg>
                    <p className="text-sm font-medium text-navy-600">
                      {isDragActive ? 'Release to add' : 'Drop example proposals here'}
                    </p>
                    <p className="text-xs text-navy-400">or click to browse · multiple PDFs supported</p>
                  </div>
                )}
              </div>

              {/* Processing stages */}
              <AnimatePresence>
                {isProcessing && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 space-y-2"
                  >
                    {STAGES.map((label, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                          processingStage > i ? 'bg-emerald-500' : processingStage === i ? 'bg-gold-500' : 'bg-cream-300'
                        }`}>
                          {processingStage > i ? (
                            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : processingStage === i ? (
                            <motion.div
                              animate={{ scale: [1, 1.3, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                              className="w-1.5 h-1.5 rounded-full bg-white"
                            />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-navy-300" />
                          )}
                        </div>
                        <span className={`text-xs font-medium transition-colors ${processingStage >= i ? 'text-navy-700' : 'text-navy-400'}`}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-2 text-xs text-red-500 font-medium"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="mt-3 flex items-center justify-between">
                {brandVoice ? (
                  <button
                    onClick={handleClear}
                    disabled={isProcessing}
                    className="text-xs text-navy-400 hover:text-red-500 transition-colors disabled:opacity-30"
                  >
                    Clear training
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  {stagedFiles.length > 0 && !isProcessing && (
                    <button
                      onClick={() => setStagedFiles([])}
                      className="px-3 py-1.5 text-xs font-medium text-navy-500 hover:text-navy-700 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    onClick={handleTrain}
                    disabled={!stagedFiles.length || isProcessing}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-navy-800 text-cream-100 hover:bg-navy-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    {isProcessing ? 'Analysing…' : brandVoice ? 'Retrain' : 'Train on these docs'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
