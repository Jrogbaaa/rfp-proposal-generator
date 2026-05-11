import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ProposalData, ExpandedContent, DesignConfig, BrandVoiceProfile } from '../types/proposal'
import type { SlideData } from '../data/slideContent'
import type { SlideOverrides } from './SlideCanvasRenderer'
import SlideCanvasRenderer from './SlideCanvasRenderer'
import GoogleSlidesButton from './GoogleSlidesButton'
import { buildSlidesFromData } from '../utils/slideBuilder'
import { runDesignLoop } from '../utils/designReview'

interface DesignStudioProps {
  parsedData: Partial<ProposalData> | null
  briefText: string
  expansions: ExpandedContent | null
  designConfig: DesignConfig
  brandVoice: BrandVoiceProfile | null
  clientCompany: string
  projectTitle: string
  onReset: () => void
}

type Phase = 'building' | 'reviewing' | 'done' | 'exported'

interface LogEntry {
  message: string
  slideIndex?: number
}

export default function DesignStudio({
  parsedData,
  briefText,
  expansions,
  designConfig,
  brandVoice,
  clientCompany,
  projectTitle,
  onReset,
}: DesignStudioProps) {
  const company = clientCompany

  const [phase, setPhase] = useState<Phase>('building')
  const [slides, setSlides] = useState<SlideData[]>([])
  const [overrides, setOverrides] = useState<SlideOverrides[]>([])
  const [focusedSlide, setFocusedSlide] = useState(0)
  const [log, setLog] = useState<LogEntry[]>([])
  const [scoreStart, setScoreStart] = useState<number | null>(null)
  const [scoreFinal, setScoreFinal] = useState<number | null>(null)
  const [slidesUrl, setSlidesUrl] = useState<string | null>(null)

  // Refs to hidden full-res slide elements for html2canvas
  const slideRefs = useRef<(HTMLDivElement | null)[]>([])

  const addLog = (message: string, slideIndex?: number) => {
    setLog(prev => [...prev, { message, slideIndex }])
  }

  const runReview = useCallback(async (builtSlides: SlideData[]) => {
    setPhase('reviewing')
    addLog('AI is scanning your slides for design issues...')

    let firstScore: number | null = null
    let lastScore: number | null = null

    const result = await runDesignLoop(
      builtSlides,
      (i) => slideRefs.current[i] ?? null,
      ({ slideIndex, commentary, score }) => {
        if (firstScore === null) firstScore = score
        lastScore = score
        setScoreStart(prev => prev ?? score)
        setScoreFinal(Math.min(10, score + 2))
        addLog(`→ ${commentary}`, slideIndex)
        setFocusedSlide(slideIndex)
      },
    )

    setOverrides(result)
    if (firstScore !== null) setScoreStart(firstScore)
    if (lastScore !== null) setScoreFinal(Math.min(10, lastScore + 2))

    addLog('Design optimization complete.')
    setPhase('done')
  }, [])

  // Build slides on mount, then kick off review after a short render delay
  useEffect(() => {
    if (!parsedData) return

    const proposalForBuild: Partial<ProposalData> = {
      ...parsedData,
      expanded: expansions ?? undefined,
    }
    const builtSlides = buildSlidesFromData(proposalForBuild)
    setSlides(builtSlides)
    setOverrides(builtSlides.map(() => ({})))
    slideRefs.current = new Array(builtSlides.length).fill(null)

    // Short delay to let slides render before screenshotting
    const t = setTimeout(() => runReview(builtSlides), 800)
    return () => clearTimeout(t)
  }, [parsedData, expansions, runReview])

  const isReviewing = phase === 'reviewing'
  const isDone = phase === 'done' || phase === 'exported'

  return (
    <div className="h-[calc(100vh-8.5rem)] bg-cream-50 flex flex-col">
      {/* Header bar */}
      <div className="bg-navy-800 text-cream-100 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-sm font-medium">AI Design Studio</span>
          {isReviewing && (
            <motion.span
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-xs text-cream-400"
            >
              Reviewing slides…
            </motion.span>
          )}
        </div>
        {(scoreStart !== null && scoreFinal !== null) && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-cream-400">Design score</span>
            <span className="text-amber-400 font-bold">{scoreStart}/10</span>
            <span className="text-cream-500">→</span>
            <span className="text-emerald-400 font-bold">{scoreFinal}/10</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Filmstrip — slide thumbnails */}
        <div className="w-44 bg-navy-900 overflow-y-auto flex-shrink-0 py-3 space-y-2 px-2">
          {slides.map((slide, i) => (
            <button
              key={i}
              onClick={() => setFocusedSlide(i)}
              className={`w-full rounded overflow-hidden border-2 transition-all ${
                focusedSlide === i ? 'border-amber-400 shadow-lg' : 'border-transparent opacity-60 hover:opacity-90'
              } ${isReviewing && focusedSlide === i ? 'ring-2 ring-amber-400/50' : ''}`}
            >
              <div className="relative">
                <SlideCanvasRenderer
                  slide={slide}
                  designConfig={designConfig}
                  overrides={overrides[i]}
                  scale={0.165}
                />
                {isReviewing && focusedSlide === i && (
                  <motion.div
                    className="absolute inset-0 bg-amber-400/20"
                    animate={{ opacity: [0, 0.4, 0] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                )}
              </div>
              <div className="bg-navy-800 text-center py-0.5">
                <span className="text-cream-500 text-[9px]">{i + 1}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Main focused slide view */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4 overflow-hidden">
          {slides.length > 0 && (
            <motion.div
              key={focusedSlide}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-lg overflow-hidden shadow-2xl"
            >
              <SlideCanvasRenderer
                slide={slides[focusedSlide]}
                designConfig={designConfig}
                overrides={overrides[focusedSlide]}
                scale={0.60}
              />
            </motion.div>
          )}

          {/* Navigation dots */}
          {slides.length > 0 && (
            <div className="flex gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setFocusedSlide(i)}
                  className={`rounded-full transition-all ${
                    i === focusedSlide ? 'w-4 h-2 bg-navy-600' : 'w-2 h-2 bg-navy-300 hover:bg-navy-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel — AI commentary + export */}
        <div className="w-72 bg-white border-l border-cream-200 flex flex-col flex-shrink-0">
          {/* Commentary log */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <div className="text-xs font-semibold text-navy-400 uppercase tracking-wide mb-3">
              AI Design Notes
            </div>
            <AnimatePresence initial={false}>
              {log.map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`text-xs rounded-lg px-3 py-2 leading-relaxed ${
                    entry.message.startsWith('→')
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                      : 'bg-cream-100 text-navy-500'
                  }`}
                >
                  {entry.slideIndex !== undefined && (
                    <span className="font-semibold text-navy-400 mr-1">Slide {entry.slideIndex + 1}:</span>
                  )}
                  {entry.message}
                </motion.div>
              ))}
            </AnimatePresence>

            {isReviewing && (
              <motion.div
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-xs text-navy-400 px-3 py-2"
              >
                Analyzing visual design…
              </motion.div>
            )}
          </div>

          {/* Export section */}
          <div className="border-t border-cream-200 p-4">
            <AnimatePresence mode="wait">
              {isDone && phase !== 'exported' ? (
                <motion.div
                  key="export"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-navy-600">
                      Design optimized — {log.filter(e => e.message.startsWith('→')).length} improvements applied
                    </span>
                  </div>
                  <GoogleSlidesButton
                    data={parsedData}
                    briefText={briefText}
                    isEmpty={!briefText.trim()}
                    preGeneratedContent={expansions}
                    onSuccess={(url) => {
                      setSlidesUrl(url)
                      setPhase('exported')
                    }}
                    designConfig={designConfig}
                    brandVoice={brandVoice}
                  />
                </motion.div>
              ) : phase === 'exported' && slidesUrl ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <p className="text-xs text-navy-500 text-center">
                    Your deck for{' '}
                    <span className="font-semibold text-navy-700">
                      {company || 'your client'}
                    </span>{' '}
                    is live in Google Drive.
                  </p>
                  <a
                    href={slidesUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-navy-800 text-cream-100 font-semibold text-sm hover:bg-navy-700 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    Open in Google Slides
                  </a>
                  <a
                    href={'mailto:?subject=' + encodeURIComponent('RFP: ' + (projectTitle || 'Proposal')) + '&body=' + encodeURIComponent('Hey team,\n\nHere\'s the first draft for ' + (company || 'the proposal') + ':\n' + slidesUrl + '\n\nLet me know what you think.')}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-xl border border-navy-200 text-navy-700 text-sm font-medium hover:bg-cream-50 transition-colors"
                  >
                    Share via Email
                  </a>
                  <button
                    onClick={onReset}
                    className="w-full text-xs text-navy-400 hover:text-navy-600 py-1 transition-colors"
                  >
                    Start new proposal
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="waiting"
                  className="text-xs text-navy-400 text-center py-2"
                >
                  Export unlocks after design review
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Hidden full-res slides for html2canvas — fixed so they never affect scroll height */}
      <div
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          pointerEvents: 'none',
          zIndex: -1,
        }}
        aria-hidden
      >
        {slides.map((slide, i) => (
          <SlideCanvasRenderer
            key={i}
            ref={(el) => { slideRefs.current[i] = el }}
            slide={slide}
            designConfig={designConfig}
            overrides={{}}
            scale={1}
          />
        ))}
      </div>
    </div>
  )
}
