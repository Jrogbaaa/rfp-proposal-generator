import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ProposalData, ExpandedContent, DesignConfig, BrandVoiceProfile } from '../types/proposal'
import { ensureFreshToken } from '../utils/googleAuth'
import { createSlidesViaClaude } from '../utils/claudeSlides'
import { generateProposalContent, GeminiBlockedError } from '../utils/llmService'
import { buildProposalData } from '../utils/buildProposalData'
import { logError } from '../utils/errorHandler'

interface ClaudeDesignButtonProps {
  data: Partial<ProposalData> | null
  briefText: string
  isEmpty: boolean
  preGeneratedContent?: ExpandedContent | null
  onSuccess?: (url: string) => void
  designConfig?: DesignConfig
  brandVoice?: BrandVoiceProfile | null
}

type Stage = 'idle' | 'working' | 'error'

const PROGRESS_STEPS = [
  'Connecting to Google...',
  'Briefing Claude on your deck...',
  'Claude is designing the slides (this can take a few minutes)...',
  'Converting to Google Slides...',
]

export default function ClaudeDesignButton({ data, briefText, isEmpty, preGeneratedContent, onSuccess, designConfig, brandVoice }: ClaudeDesignButtonProps) {
  const [stage, setStage] = useState<Stage>('idle')
  const [progressStep, setProgressStep] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleDesign = async () => {
    if (!data || isEmpty || stage === 'working') return

    setStage('working')
    setProgressStep(0)
    setErrorMessage(null)

    try {
      await ensureFreshToken()
      setProgressStep(1)

      const llmContent = preGeneratedContent ?? await generateProposalContent(briefText, data, brandVoice ?? undefined)
      const proposalData = buildProposalData(data, llmContent)
      setProgressStep(2)

      const result = await createSlidesViaClaude(
        proposalData,
        designConfig ?? { colorTheme: 'navy-gold' },
        () => ensureFreshToken(),
      )
      setProgressStep(3)

      onSuccess?.(result.presentationUrl)
      setStage('idle')
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Unknown error'
      let userMessage = raw

      if (err instanceof GeminiBlockedError) {
        userMessage = 'The AI flagged the content while drafting. Try rephrasing the brief.'
      } else if (raw.startsWith('AUTH_EXPIRED') || raw.startsWith('AUTH_DENIED') || raw.startsWith('AUTH_TIMEOUT')) {
        userMessage = 'Your Google session expired or was cancelled. Click "Try again" to re-authenticate.'
      } else if (raw.includes('ANTHROPIC_API_KEY')) {
        userMessage = 'Claude design is not configured on the server (missing ANTHROPIC_API_KEY).'
      } else if (raw.includes('timed out')) {
        userMessage = 'Claude took too long to design the deck. Try again, or use the standard export.'
      } else if (raw.startsWith('FORBIDDEN')) {
        userMessage = 'Permission denied uploading to Google Drive. Check your OAuth scopes.'
      }

      logError(raw, 'api', { component: 'ClaudeDesignButton' }, 'ClaudeDesignButton')
      setErrorMessage(userMessage)
      setStage('error')
    }
  }

  if (stage === 'working') {
    return (
      <div className="w-full px-6 py-5 rounded-xl border-2 border-indigo-200 bg-indigo-50">
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full flex-shrink-0"
          />
          <span className="text-sm font-semibold text-indigo-800">
            {PROGRESS_STEPS[progressStep] || 'Working...'}
          </span>
        </div>
        <div className="space-y-2">
          {PROGRESS_STEPS.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 transition-all duration-300 ${
                i < progressStep ? 'bg-emerald-500' : i === progressStep ? 'bg-indigo-500' : 'bg-indigo-200'
              }`} />
              <span className={`text-xs transition-colors duration-300 ${i <= progressStep ? 'text-indigo-700' : 'text-indigo-400'}`}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (stage === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border-2 border-red-200 bg-red-50 p-4 space-y-3"
      >
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-red-800">Claude design failed</p>
            <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setStage('idle'); setErrorMessage(null) }}
          className="w-full px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </motion.div>
    )
  }

  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={handleDesign}
        disabled={isEmpty}
        whileHover={!isEmpty ? { scale: 1.01, y: -2 } : {}}
        whileTap={!isEmpty ? { scale: 0.99 } : {}}
        className={`
          relative w-full px-6 py-4 rounded-xl font-semibold text-base
          flex items-center justify-center gap-3 overflow-hidden
          transition-all duration-300 border-2
          ${isEmpty
            ? 'bg-cream-200 text-navy-400 border-cream-300 cursor-not-allowed'
            : 'bg-white text-navy-800 border-indigo-200 hover:border-indigo-400 hover:shadow-md'
          }
        `}
        aria-label="Design deck with Claude"
      >
        {!isEmpty && <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl bg-indigo-500" />}

        <svg className={`w-5 h-5 flex-shrink-0 ${isEmpty ? 'text-navy-400' : 'text-indigo-500'}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5l-1.9-5.6L4.5 9l5.6-1.4L12 2zM5 16l.9 2.6L8.5 19.5l-2.6.9L5 23l-.9-2.6L1.5 19.5l2.6-.9L5 16z" />
        </svg>

        <span>Design with Claude</span>

        <svg className={`w-4 h-4 ml-auto ${isEmpty ? 'text-navy-300' : 'text-navy-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.button>

      <AnimatePresence>
        {!isEmpty && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-xs text-navy-400 text-center"
          >
            AI-designed deck — richer graphics, takes a few minutes
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
