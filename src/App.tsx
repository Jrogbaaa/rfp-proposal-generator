import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Header from './components/Header'
import BriefEditor from './components/BriefEditor'
import PdfUploader from './components/PdfUploader'
import SlidePreview from './components/SlidePreview'
import ChatInterface from './components/ChatInterface'
import GoogleSlidesButton from './components/GoogleSlidesButton'
import ProgressStepper from './components/ProgressStepper'
import BrandVoicePanel from './components/BrandVoicePanel'
import { useBriefParser } from './hooks/useBriefParser'
import { ErrorBoundary } from './components/ErrorBoundary'
import DevTools from './components/DevTools'
import type { Step, ExpandedContent, DesignConfig } from './types/proposal'
import { DEFAULT_DESIGN_CONFIG } from './types/proposal'
import { generateProposalContent } from './utils/llmService'
import { getAuthState } from './utils/googleAuth'

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

  // Design config
  const [designConfig, setDesignConfig] = useState<DesignConfig>(DEFAULT_DESIGN_CONFIG)

  // Brand voice training
  const [brandVoice, setBrandVoice] = useState<string | null>(() => localStorage.getItem('rfp_brand_voice'))

  // Loading / error states
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSlideUpdating, setIsSlideUpdating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)

  // Google auth state — poll periodically so badge updates after OAuth
  const [isGoogleConnected, setIsGoogleConnected] = useState(() => getAuthState().isSignedIn)
  useEffect(() => {
    const id = setInterval(() => setIsGoogleConnected(getAuthState().isSignedIn), 3000)
    return () => clearInterval(id)
  }, [])

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
    setIsGenerating(false)
    setIsSlideUpdating(false)
    setCurrentStep('draft')
  }

  const STEP_ORDER: Step[] = ['draft', 'iterate', 'share']
  const currentStepIndex = STEP_ORDER.indexOf(currentStep)

  const handleStepClick = useCallback((stepIndex: number) => {
    if (stepIndex >= currentStepIndex) return
    setCurrentStep(STEP_ORDER[stepIndex])
  }, [currentStepIndex])

  const handleContinueToIteration = async () => {
    setCurrentStep('iterate')
    setGenerationError(null)
    if (!expansions) {
      setIsGenerating(true)
      try {
        const result = await generateProposalContent(briefText, parsedData || {}, brandVoice ?? undefined)
        setExpansions(result)
      } catch (err) {
        console.error('[App] Failed to generate proposal content:', err)
        setGenerationError(err instanceof Error ? err.message : 'Failed to generate content. Please try again.')
      } finally {
        setIsGenerating(false)
      }
    }
  }

  const handleRetryGeneration = async () => {
    setGenerationError(null)
    setIsGenerating(true)
    try {
      const result = await generateProposalContent(briefText, parsedData || {}, brandVoice ?? undefined)
      setExpansions(result)
    } catch (err) {
      console.error('[App] Retry failed:', err)
      setGenerationError(err instanceof Error ? err.message : 'Failed to generate content. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSlideEdit = (slideNumber: number, bulletIndex: number, newText: string) => {
    if (!expansions) return
    // Slide 2: edit the problem bullets (stored as editedProblems override)
    if (slideNumber === 2) {
      const base = expansions.editedProblems ?? parsedData?.content?.problems ?? ['', '', '', '']
      const edited = [...base] as [string, string, string, string]
      edited[bulletIndex] = newText
      setExpansions({ ...expansions, editedProblems: edited })
      return
    }
    const probs = [...expansions.problemExpansions] as [string, string, string, string]
    const bens = [...expansions.benefitExpansions] as [string, string, string, string]
    if (slideNumber === 3 && bulletIndex === 0) probs[0] = newText
    else if (slideNumber === 4 && bulletIndex === 0) probs[1] = newText
    else if (slideNumber === 7 && bulletIndex === 0) bens[0] = newText
    else if (slideNumber === 8 && bulletIndex === 0) bens[1] = newText
    else if (slideNumber >= 11) {
      const additionalIdx = slideNumber - 11
      const additional = [...(expansions.additionalSlides ?? [])]
      if (additional[additionalIdx]) {
        const bullets = [...additional[additionalIdx].bullets]
        bullets[bulletIndex] = newText
        additional[additionalIdx] = { ...additional[additionalIdx], bullets }
        setExpansions({ ...expansions, additionalSlides: additional })
      }
      return
    } else return
    setExpansions({ ...expansions, problemExpansions: probs, benefitExpansions: bens })
  }

  const handleSlideTitleEdit = (slideNumber: number, newTitle: string) => {
    if (!expansions) return
    // Slide 1: edit the project title (stored as editedProjectTitle override)
    if (slideNumber === 1) {
      setExpansions({ ...expansions, editedProjectTitle: newTitle })
      return
    }
    setExpansions({
      ...expansions,
      customTitles: { ...(expansions.customTitles ?? {}), [slideNumber]: newTitle },
    })
  }

  return (
    <ErrorBoundary componentName="App">
      <div className="min-h-screen flex flex-col bg-cream-100">
        <Header isConnected={isGoogleConnected} onNew={handleReset} />

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
                    <BrandVoicePanel
                      brandVoice={brandVoice}
                      onBrandVoiceExtracted={(voice, _count) => setBrandVoice(voice || null)}
                    />
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
                            onClick={handleContinueToIteration}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-navy-800 text-cream-100 font-semibold text-base hover:bg-navy-700 transition-colors shadow-md"
                          >
                            Continue to Refine
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

            {/* ── STEP 2: REFINE ────────────────────────────────────────── */}
            {currentStep === 'iterate' && (
              <motion.div
                key="iterate"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-1 lg:grid-cols-[1fr_420px] min-h-[calc(100vh-8.5rem)]"
              >
                {/* Left: Full slide preview */}
                <section className="bg-cream-50 flex flex-col border-r border-cream-300 min-h-[60vh] lg:min-h-0">
                  <div className="flex flex-col h-full p-6 lg:p-8">
                    <div className="mb-5 flex items-start justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-navy-400 mb-1">
                          Step 2 · Refine
                        </p>
                        <h2 className="font-display text-xl text-navy-800">Slide Preview</h2>
                        <p className="text-xs text-navy-400 mt-1">
                          {generationError
                            ? 'Generation failed — retry or go back'
                            : isGenerating
                            ? 'Generating your slides with AI…'
                            : isSlideUpdating
                            ? 'Rewriting slides…'
                            : expansions
                            ? 'Click any paragraph to edit it directly'
                            : '10-slide deck · ready to preview'}
                        </p>
                      </div>
                    </div>

                    {isGenerating ? (
                      <div className="flex-1 overflow-auto space-y-4 pr-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="preview-paper rounded-lg overflow-hidden animate-pulse">
                            <div className="flex items-center gap-3 px-6 pt-5 pb-3">
                              <div className="w-7 h-7 rounded-full bg-cream-300" />
                              <div className="h-3 bg-cream-300 rounded w-16" />
                            </div>
                            <div className="px-6 pb-6 space-y-3">
                              <div className="h-5 bg-cream-300 rounded w-3/4" />
                              <div className="h-4 bg-cream-200 rounded w-full" />
                              <div className="h-4 bg-cream-200 rounded w-5/6" />
                              <div className="h-4 bg-cream-200 rounded w-4/5" />
                            </div>
                            <div className="h-1 bg-cream-300" />
                          </div>
                        ))}
                        <p className="text-center text-sm text-navy-400 py-4 animate-pulse">
                          Gemini is writing your proposal…
                        </p>
                      </div>
                    ) : generationError ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-6 max-w-md w-full space-y-4">
                          <div className="flex items-start gap-3 text-left">
                            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <div>
                              <p className="text-sm font-semibold text-red-800">Content generation failed</p>
                              <p className="text-xs text-red-600 mt-1">{generationError}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleRetryGeneration}
                              className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
                            >
                              Retry
                            </button>
                            <button
                              onClick={() => setCurrentStep('draft')}
                              className="flex-1 px-4 py-2.5 rounded-lg border border-red-200 text-red-700 text-sm font-medium hover:bg-red-100 transition-colors"
                            >
                              Back to Draft
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 min-h-0">
                        <SlidePreview
                          data={expansions ? { ...parsedData, expanded: expansions } : parsedData}
                          designConfig={designConfig}
                          isUpdating={isSlideUpdating}
                          onSlideEdit={expansions ? handleSlideEdit : undefined}
                          onSlideTitleEdit={expansions ? handleSlideTitleEdit : undefined}
                        />
                      </div>
                    )}
                  </div>
                </section>

                {/* Right: Content/Design Chat + Export — sticky so it stays in viewport while slides scroll */}
                <section className="bg-navy-800 flex flex-col lg:sticky lg:top-[8.5rem] lg:h-[calc(100vh-8.5rem)] overflow-hidden">
                  <div className="flex flex-col h-full p-6 lg:p-8">
                    {/* Section label */}
                    <div className="mb-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-navy-400">Refine Content</p>
                    </div>

                    <div className="flex-1 min-h-0 bg-cream-50 rounded-xl p-4 overflow-hidden">
                      <ChatInterface
                        briefText={briefText}
                        parsedData={parsedData || {}}
                        currentExpansions={expansions}
                        onExpansionsUpdated={setExpansions}
                        onLoadingChange={setIsSlideUpdating}
                        brandVoice={brandVoice ?? undefined}
                      />
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                      {/* Design style picker — toggle before export to test each layout */}
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-navy-400 mb-2">Slide Style</p>
                        <div className="flex gap-1.5">
                          {([
                            { value: 'standard',          label: 'Classic' },
                            { value: 'bold-agency',        label: 'Bold' },
                            { value: 'executive-minimal',  label: 'Executive' },
                          ] as const).map(({ value, label }) => (
                            <button
                              key={value}
                              onClick={() => setDesignConfig(c => ({ ...c, designStyle: value }))}
                              className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                                (designConfig.designStyle ?? 'standard') === value
                                  ? 'bg-gold-500 text-navy-900'
                                  : 'bg-white/10 text-navy-300 hover:bg-white/20'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <GoogleSlidesButton
                        data={parsedData}
                        briefText={briefText}
                        isEmpty={!briefText.trim()}
                        preGeneratedContent={expansions}
                        designConfig={designConfig}
                        onSuccess={handleSlidesSuccess}
                      />
                    </div>
                  </div>
                </section>
              </motion.div>
            )}

            {/* ── STEP 3: EXPORT & SHARE ────────────────────────────────── */}
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
                        href={`mailto:?subject=${encodeURIComponent(`RFP: ${parsedData?.project?.title || 'Proposal'}`)}&body=${encodeURIComponent(`Hey team,\n\nHere's the first draft for ${parsedData?.client?.company || 'the proposal'}:\n${slidesUrl}\n\nLet me know what you think.`)}`}
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

