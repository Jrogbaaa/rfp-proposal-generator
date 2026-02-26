import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from './components/Header'
import BriefEditor from './components/BriefEditor'
import PdfUploader from './components/PdfUploader'
import SlidePreview from './components/SlidePreview'
import GoogleSlidesButton from './components/GoogleSlidesButton'
import ChatInterface from './components/ChatInterface'
import ProgressStepper from './components/ProgressStepper'
import { useBriefParser } from './hooks/useBriefParser'
import { ErrorBoundary } from './components/ErrorBoundary'
import DevTools from './components/DevTools'
import type { Step, ExpandedContent } from './types/proposal'

type InputMode = 'pdf' | 'paste'

export default function App() {
  // Step flow
  const [currentStep, setCurrentStep] = useState<Step>('draft')
  const [slidesUrl, setSlidesUrl] = useState<string | null>(null)

  // Brief input
  const [briefText, setBriefText] = useState('')
  const [inputMode, setInputMode] = useState<InputMode>('pdf')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)

  // AI-refined expansions from chatbot
  const [expansions, setExpansions] = useState<ExpandedContent | null>(null)

  const parsedData = useBriefParser(briefText)
  const hasContent = briefText.trim().length > 0

  const handleClear = () => {
    setBriefText('')
    setUploadedFile(null)
    setExpansions(null)
  }

  const handleFileUpload = (file: File) => {
    setUploadedFile(file)
    setBriefText('')
  }

  const handleTextExtracted = (text: string) => {
    setBriefText(text)
  }

  const handleSlidesSuccess = (url: string) => {
    setSlidesUrl(url)
    setCurrentStep('share')
  }

  const handleReset = () => {
    setBriefText('')
    setUploadedFile(null)
    setExpansions(null)
    setSlidesUrl(null)
    setCurrentStep('draft')
  }

  const handleStepClick = (stepIndex: number) => {
    const steps: Step[] = ['draft', 'iterate', 'design', 'share']
    setCurrentStep(steps[stepIndex])
  }

  const slideOutline = buildSlideOutline(parsedData)

  return (
    <ErrorBoundary componentName="App">
      <div className="min-h-screen flex flex-col bg-cream-100">
        <Header isConnected={true} />

        {/* Step nav bar — fixed below the header */}
        <div className="fixed top-16 left-0 right-0 z-30 bg-cream-50 border-b border-cream-300 shadow-sm">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <ProgressStepper
              currentStep={currentStep}
              onStepClick={handleStepClick}
            />
          </div>
        </div>

        <main className="flex-1 pt-[8.5rem]">
          <AnimatePresence mode="wait">

            {/* ── STEP 1: DRAFT ─────────────────────────────────────────── */}
            {currentStep === 'draft' && (
              <motion.div
                key="draft"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-8.5rem)]"
              >
                {/* Left: Input panel */}
                <section className="relative bg-navy-800 flex flex-col overflow-hidden min-h-[50vh] lg:min-h-0">
                  <div className="absolute inset-0 bg-gradient-to-br from-gold-500/[0.03] via-transparent to-gold-500/[0.02] pointer-events-none" />

                  <div className="relative z-10 flex flex-col h-full p-6 lg:p-10">
                    <div className="mb-6">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-navy-400 mb-3">
                        Step 1 · Draft
                      </p>

                      {/* Mode toggle — PDF first */}
                      <div className="flex gap-1 mb-5 p-1 bg-white/[0.04] rounded-lg">
                        <button
                          onClick={() => setInputMode('pdf')}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                            inputMode === 'pdf'
                              ? 'bg-white/[0.1] text-cream-100 shadow-sm'
                              : 'text-navy-400 hover:text-cream-300'
                          }`}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          Upload PDF
                        </button>
                        <button
                          onClick={() => setInputMode('paste')}
                          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                            inputMode === 'paste'
                              ? 'bg-white/[0.1] text-cream-100 shadow-sm'
                              : 'text-navy-400 hover:text-cream-300'
                          }`}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                          </svg>
                          Paste Text
                        </button>
                      </div>

                      <h2 className="font-display text-2xl lg:text-3xl text-cream-100 tracking-tight">
                        Upload your brief here
                      </h2>
                      <p className="text-sm text-navy-400 mt-1">
                        {inputMode === 'pdf'
                          ? 'Drop a PDF — Gemini extracts structure automatically'
                          : 'Paste your RFP or brief text below'}
                      </p>
                    </div>

                    <AnimatePresence mode="wait">
                      {inputMode === 'pdf' ? (
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
                            onTextExtracted={handleTextExtracted}
                            onClear={handleClear}
                          />
                        </motion.div>
                      ) : (
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
                      )}
                    </AnimatePresence>
                  </div>
                </section>

                {/* Right: Parsed preview + CTA */}
                <section className="relative bg-cream-50 flex flex-col border-l border-cream-400 min-h-[50vh] lg:min-h-0">
                  <div className="flex flex-col h-full p-6 lg:p-10">
                    <div className="mb-6">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-navy-400 mb-2">
                        Preview
                      </p>
                      <h2 className="font-display text-2xl lg:text-3xl text-navy-800 tracking-tight">
                        {hasContent ? 'Brief parsed' : 'Waiting for brief'}
                      </h2>
                    </div>

                    <div className="flex-1 flex flex-col min-h-0">
                      {hasContent ? (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex-1 flex flex-col gap-4"
                        >
                          <div className="rounded-xl bg-white border border-cream-300 p-5 space-y-3">
                            <ParsedField label="Company" value={parsedData?.client?.company} />
                            <ParsedField label="Contact" value={
                              parsedData?.client?.firstName
                                ? `${parsedData.client.firstName} ${parsedData.client.lastName}`.trim()
                                : undefined
                            } />
                            <ParsedField label="Email" value={parsedData?.client?.email} />
                            <ParsedField label="Project" value={parsedData?.project?.title} />
                            <ParsedField label="Timeline" value={parsedData?.project?.duration} />
                            <ParsedField label="Budget" value={parsedData?.project?.totalValue} />
                            <ParsedField
                              label="Problems"
                              value={
                                parsedData?.content?.problems?.filter(Boolean).length
                                  ? `${parsedData.content.problems.filter(Boolean).length} identified`
                                  : undefined
                              }
                            />
                            <ParsedField
                              label="Benefits"
                              value={
                                parsedData?.content?.benefits?.filter(Boolean).length
                                  ? `${parsedData.content.benefits.filter(Boolean).length} identified`
                                  : undefined
                              }
                            />
                          </div>

                          <button
                            onClick={() => setCurrentStep('iterate')}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-navy-800 text-cream-100 font-semibold text-base hover:bg-navy-700 transition-colors shadow-md"
                          >
                            Continue to Iteration
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                          </button>
                        </motion.div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center text-navy-400">
                          <svg className="w-12 h-12 mb-4 opacity-25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                          <p className="text-sm">Upload a PDF or paste your brief to get started</p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </motion.div>
            )}

            {/* ── STEP 2: ITERATION ─────────────────────────────────────── */}
            {currentStep === 'iterate' && (
              <motion.div
                key="iterate"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-1 lg:grid-cols-3 min-h-[calc(100vh-8.5rem)]"
              >
                {/* Left: Slide outline */}
                <section className="bg-navy-800 flex flex-col border-r border-white/10 min-h-[40vh] lg:min-h-0">
                  <div className="p-6 lg:p-8 flex flex-col h-full">
                    <div className="mb-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-navy-400 mb-1">
                        Step 2 · Iteration
                      </p>
                      <h2 className="font-display text-xl text-cream-100">Slide Outline</h2>
                      <p className="text-xs text-navy-400 mt-1">10-slide structure from your brief</p>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-1.5">
                      {slideOutline.map((slide) => (
                        <div
                          key={slide.num}
                          className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-white/[0.04] border border-white/[0.05]"
                        >
                          <span className="w-5 h-5 rounded-full bg-gold-500/20 text-gold-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            {slide.num}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-cream-200">{slide.title}</p>
                            {slide.detail && (
                              <p className="text-[11px] text-navy-400 mt-0.5 truncate">{slide.detail}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {expansions && (
                      <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-xs font-medium text-emerald-400">Content updated by AI</span>
                      </div>
                    )}
                  </div>
                </section>

                {/* Right: Chat (2 cols) */}
                <section className="lg:col-span-2 bg-cream-50 flex flex-col min-h-[60vh] lg:min-h-0">
                  <div className="flex flex-col h-full p-6 lg:p-8">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-navy-400 mb-1">
                          Refine with AI
                        </p>
                        <h2 className="font-display text-xl text-navy-800">Ask for changes</h2>
                        <p className="text-sm text-navy-500 mt-1">
                          Request tone, language, or focus changes — the content will update instantly.
                        </p>
                      </div>
                      <button
                        onClick={() => setCurrentStep('design')}
                        className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-800 text-cream-100 text-sm font-semibold hover:bg-navy-700 transition-colors"
                      >
                        Design
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 min-h-0">
                      <ChatInterface
                        briefText={briefText}
                        parsedData={parsedData || {}}
                        currentExpansions={expansions}
                        onExpansionsUpdated={setExpansions}
                      />
                    </div>
                  </div>
                </section>
              </motion.div>
            )}

            {/* ── STEP 3: DESIGN ────────────────────────────────────────── */}
            {currentStep === 'design' && (
              <motion.div
                key="design"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-8.5rem)]"
              >
                {/* Left: Slide preview with real data */}
                <section className="bg-cream-50 flex flex-col border-r border-cream-300 min-h-[50vh] lg:min-h-0">
                  <div className="flex flex-col h-full p-6 lg:p-8">
                    <div className="mb-5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-navy-400 mb-1">
                        Step 3 · Design
                      </p>
                      <h2 className="font-display text-xl text-navy-800">Slide Preview</h2>
                      <p className="text-xs text-navy-400 mt-1">10-slide deck · ready to export</p>
                    </div>
                    <div className="flex-1 min-h-0">
                      <SlidePreview
                        data={
                          expansions
                            ? { ...parsedData, expanded: expansions }
                            : parsedData
                        }
                      />
                    </div>
                  </div>
                </section>

                {/* Right: Export panel */}
                <section className="bg-navy-800 flex flex-col min-h-[50vh] lg:min-h-0">
                  <div className="flex flex-col h-full p-6 lg:p-10">
                    <div className="mb-8">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-navy-400 mb-1">
                        Export
                      </p>
                      <h2 className="font-display text-2xl text-cream-100 tracking-tight">
                        Ready to create your deck?
                      </h2>
                      <p className="text-sm text-navy-400 mt-2">
                        We'll generate all 10 slides in Google Slides with your branding.
                      </p>
                    </div>

                    {parsedData && (
                      <div className="flex flex-wrap gap-2 mb-8">
                        {parsedData.client?.company && <Chip label={parsedData.client.company} />}
                        {parsedData.project?.title && <Chip label={parsedData.project.title} />}
                        {parsedData.project?.duration && <Chip label={parsedData.project.duration} />}
                        {parsedData.project?.totalValue && <Chip label={parsedData.project.totalValue} />}
                        {expansions && <Chip label="AI-refined content" highlight />}
                      </div>
                    )}

                    <div className="mt-auto space-y-2">
                      <GoogleSlidesButton
                        data={parsedData}
                        briefText={briefText}
                        isEmpty={!hasContent}
                        preGeneratedContent={expansions}
                        onSuccess={handleSlidesSuccess}
                      />
                      <button
                        onClick={() => setCurrentStep('iterate')}
                        className="w-full text-sm text-navy-400 hover:text-cream-300 transition-colors py-2"
                      >
                        ← Back to Iteration
                      </button>
                    </div>
                  </div>
                </section>
              </motion.div>
            )}

            {/* ── STEP 4: SHARE ─────────────────────────────────────────── */}
            {currentStep === 'share' && (
              <motion.div
                key="share"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center justify-center min-h-[calc(100vh-8.5rem)] p-6"
              >
                <div className="w-full max-w-lg text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
                    className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6"
                  >
                    <svg className="w-10 h-10 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </motion.div>

                  <h1 className="font-display text-3xl text-navy-800 mb-2">
                    Presentation created!
                  </h1>
                  <p className="text-navy-400 mb-8">
                    Your 10-slide deck for{' '}
                    <span className="font-semibold text-navy-700">
                      {parsedData?.client?.company || 'your client'}
                    </span>{' '}
                    is live in Google Drive.
                  </p>

                  <div className="space-y-3">
                    {slidesUrl && (
                      <a
                        href={slidesUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-3 w-full px-6 py-4 rounded-xl bg-navy-800 text-cream-100 font-semibold text-base hover:bg-navy-700 transition-colors shadow-md"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                          <polyline points="15 3 21 3 21 9" />
                          <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        Open in Google Slides
                      </a>
                    )}

                    {slidesUrl && (
                      <a
                        href={`mailto:${parsedData?.client?.email || ''}?subject=${encodeURIComponent(`RFP: ${parsedData?.project?.title || 'Proposal'}`)}&body=${encodeURIComponent(`Hi ${parsedData?.client?.firstName || 'there'},\n\nPlease find your proposal presentation here:\n${slidesUrl}\n\nLet me know if you have any questions.\n\nBest regards`)}`}
                        className="flex items-center justify-center gap-3 w-full px-6 py-4 rounded-xl border-2 border-navy-200 bg-white text-navy-800 font-semibold text-base hover:border-navy-300 hover:shadow-sm transition-all"
                      >
                        <svg className="w-5 h-5 text-navy-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                        Share via Outlook
                      </a>
                    )}

                    <button
                      onClick={handleReset}
                      className="w-full px-6 py-3 rounded-xl text-navy-500 text-sm font-medium hover:text-navy-700 hover:bg-cream-200 transition-colors"
                    >
                      Start new proposal
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        <DevTools />
      </div>
    </ErrorBoundary>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function ParsedField({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs font-semibold text-navy-400 w-20 flex-shrink-0">{label}</span>
      <span className="text-sm text-navy-700 font-medium truncate">{value}</span>
    </div>
  )
}

function Chip({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
      highlight
        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
        : 'bg-white/10 text-navy-300 border border-white/10'
    }`}>
      {label}
    </span>
  )
}

// ─── Slide outline builder ────────────────────────────────────────────────────

type ParsedDataType = ReturnType<typeof useBriefParser>

function buildSlideOutline(parsedData: ParsedDataType | null) {
  const company = parsedData?.client?.company || 'Client'
  const project = parsedData?.project?.title || 'Proposal'
  const problems = parsedData?.content?.problems || ['', '', '', '']
  const benefits = parsedData?.content?.benefits || ['', '', '', '']

  return [
    { num: 1, title: 'Cover', detail: `${project} · ${company}` },
    { num: 2, title: 'Challenge Overview', detail: problems.filter(Boolean).join(' · ') || 'Key challenges' },
    { num: 3, title: 'Problem Deep-Dive', detail: problems[0] || 'Problem 1' },
    { num: 4, title: 'Problem Deep-Dive', detail: problems[1] || 'Problem 2' },
    { num: 5, title: 'Problems 3 & 4', detail: [problems[2], problems[3]].filter(Boolean).join(' · ') || 'Additional challenges' },
    { num: 6, title: 'Solution Overview', detail: benefits.filter(Boolean).join(' · ') || 'Key benefits' },
    { num: 7, title: 'Benefit Deep-Dive', detail: benefits[0] || 'Benefit 1' },
    { num: 8, title: 'Benefit Deep-Dive', detail: benefits[1] || 'Benefit 2' },
    { num: 9, title: 'Investment & Timeline', detail: `${parsedData?.project?.totalValue || 'TBD'} · ${parsedData?.project?.duration || 'TBD'}` },
    { num: 10, title: 'Closing CTA', detail: `Let's build this together, ${company}` },
  ]
}
