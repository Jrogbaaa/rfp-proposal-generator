import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from './components/Header'
import BriefEditor from './components/BriefEditor'
import PdfUploader from './components/PdfUploader'
import DocumentPreview from './components/DocumentPreview'
import SlidePreview from './components/SlidePreview'
import GoogleSlidesButton from './components/GoogleSlidesButton'
import { useBriefParser } from './hooks/useBriefParser'
import { ErrorBoundary } from './components/ErrorBoundary'
import DevTools from './components/DevTools'

type InputMode = 'paste' | 'pdf'

export default function App() {
  const [briefText, setBriefText] = useState('')
  const [inputMode, setInputMode] = useState<InputMode>('paste')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isProcessingPdf, setIsProcessingPdf] = useState(false)
  const [processingStage, setProcessingStage] = useState(0)
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const parsedData = useBriefParser(briefText)

  // Clean up processing timer on unmount
  useEffect(() => {
    return () => {
      if (processingTimerRef.current) clearTimeout(processingTimerRef.current)
    }
  }, [])

  const handleClear = () => {
    setBriefText('')
    setUploadedFile(null)
  }

  const handleFileUpload = (file: File) => {
    setUploadedFile(file)
    setBriefText('')
    setGeneratedUrl(null)
    setIsProcessingPdf(true)
    setProcessingStage(0)

    // Stage progression: simulate multi-step analysis
    setTimeout(() => setProcessingStage(1), 800)
    setTimeout(() => setProcessingStage(2), 2000)
    processingTimerRef.current = setTimeout(() => {
      setIsProcessingPdf(false)
      setProcessingStage(0)
      processingTimerRef.current = null
    }, 3500)
  }

  const showPdfPreview = inputMode === 'pdf' && uploadedFile !== null && !isProcessingPdf
  const showPdfProcessing = inputMode === 'pdf' && uploadedFile !== null && isProcessingPdf

  return (
    <ErrorBoundary componentName="App">
    <div className="min-h-screen flex flex-col bg-cream-100">
      <Header isConnected={true} />

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 pt-16">
        {/* Editor Panel - Dark */}
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-navy-800 flex flex-col overflow-hidden min-h-[50vh] lg:min-h-0"
        >
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.03] via-transparent to-gold-500/[0.02] pointer-events-none" />

          <div className="relative z-10 flex flex-col h-full p-6 lg:p-10">
            <div className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-navy-400 mb-3">
                Input
              </p>

              {/* Mode Toggle */}
              <div className="flex gap-1 mb-4 p-1 bg-white/[0.04] rounded-lg">
                <button
                  onClick={() => setInputMode('paste')}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                    ${inputMode === 'paste'
                      ? 'bg-white/[0.1] text-cream-100 shadow-sm'
                      : 'text-navy-400 hover:text-cream-300'
                    }
                  `}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Paste Brief
                </button>
                <button
                  onClick={() => setInputMode('pdf')}
                  className={`
                    flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                    ${inputMode === 'pdf'
                      ? 'bg-white/[0.1] text-cream-100 shadow-sm'
                      : 'text-navy-400 hover:text-cream-300'
                    }
                  `}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload PDF
                </button>
              </div>

              <h2 className="font-display text-2xl lg:text-3xl text-cream-100 tracking-tight">
                {inputMode === 'paste' ? 'Paste Your Brief' : 'Upload Document'}
              </h2>
            </div>

            <AnimatePresence mode="wait">
              {inputMode === 'paste' ? (
                <motion.div
                  key="paste"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  <BriefEditor
                    value={briefText}
                    onChange={setBriefText}
                    onClear={handleClear}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="pdf"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  <PdfUploader
                    uploadedFile={uploadedFile}
                    onFileUpload={handleFileUpload}
                    onClear={() => setUploadedFile(null)}
                    isProcessing={isProcessingPdf}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        {/* Preview Panel - Light */}
        <motion.section
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="relative bg-cream-50 flex flex-col border-l border-cream-400 min-h-[50vh] lg:min-h-0"
        >
          <div className="flex flex-col h-full p-6 lg:p-10">
            <div className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-navy-400 mb-2">
                Output
              </p>
              <h2 className="font-display text-2xl lg:text-3xl text-navy-800 tracking-tight">
                {showPdfPreview ? 'Presentation Readout' : showPdfProcessing ? 'Analyzing Document' : 'Document Preview'}
              </h2>
            </div>

            <AnimatePresence mode="wait">
              {showPdfProcessing ? (
                <motion.div
                  key="processing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 flex flex-col items-center justify-center min-h-0"
                >
                  <div className="flex flex-col items-center text-center">
                    {/* Animated scanner icon */}
                    <div className="relative w-20 h-20 mb-8">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold-500 border-r-gold-300"
                      />
                      <div className="absolute inset-2 rounded-full bg-cream-100 flex items-center justify-center">
                        <svg className="w-8 h-8 text-navy-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                    </div>

                    {/* Processing steps */}
                    <div className="space-y-3 w-64">
                      {[
                        'Extracting document structure',
                        'Parsing slide content',
                        'Building presentation readout',
                      ].map((label, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: processingStage >= i ? 1 : 0.3, x: 0 }}
                          transition={{ delay: i * 0.15, duration: 0.3 }}
                          className="flex items-center gap-3"
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-300 ${
                            processingStage > i
                              ? 'bg-emerald-500'
                              : processingStage === i
                                ? 'bg-gold-500'
                                : 'bg-cream-300'
                          }`}>
                            {processingStage > i ? (
                              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : processingStage === i ? (
                              <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 0.8, repeat: Infinity }}
                                className="w-2 h-2 rounded-full bg-white"
                              />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-cream-400" />
                            )}
                          </div>
                          <span className={`text-sm font-medium transition-colors duration-300 ${
                            processingStage >= i ? 'text-navy-700' : 'text-navy-400'
                          }`}>
                            {label}
                          </span>
                        </motion.div>
                      ))}
                    </div>

                    {/* Progress bar */}
                    <div className="mt-6 w-48 h-1.5 bg-cream-300 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-gold-400 to-gold-500 rounded-full"
                        initial={{ width: '0%' }}
                        animate={{ width: processingStage === 0 ? '20%' : processingStage === 1 ? '55%' : '90%' }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                </motion.div>
              ) : showPdfPreview ? (
                <motion.div
                  key="slides"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  <SlidePreview fileName={uploadedFile!.name} />
                </motion.div>
              ) : (
                <motion.div
                  key="document"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  <DocumentPreview
                    data={parsedData}
                    isEmpty={!briefText.trim()}
                  />

                  <div className="pt-5 mt-5 border-t border-cream-400">
                    <GoogleSlidesButton
                      data={parsedData}
                      briefText={briefText}
                      isEmpty={!briefText.trim()}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>
      </main>

      {/* DevTools Panel - only renders in dev mode */}
      <DevTools />
    </div>
    </ErrorBoundary>
  )
}
