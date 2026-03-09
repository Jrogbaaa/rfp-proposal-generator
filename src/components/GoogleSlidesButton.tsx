import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ProposalData, ExpandedContent, DesignConfig } from '../types/proposal'
import { getValidToken } from '../utils/googleAuth'
import { createGoogleSlidesPresentation } from '../utils/googleSlides'
import { generateProposalContent } from '../utils/llmService'
import { logError } from '../utils/errorHandler'

interface GoogleSlidesButtonProps {
  data: Partial<ProposalData> | null
  briefText: string
  isEmpty: boolean
  preGeneratedContent?: ExpandedContent | null
  onSuccess?: (url: string) => void
  designConfig?: DesignConfig
}

type Stage = 'idle' | 'authenticating' | 'generating' | 'creating' | 'done' | 'error'

const PROGRESS_STEPS = [
  'Connecting to Google...',
  'Generating slide content...',
  'Building slides...',
  'Populating slides...',
  'Finalising...',
]

function buildProposalData(parsedData: Partial<ProposalData>, llmContent?: ExpandedContent): ProposalData {
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const company = parsedData.client?.company || ''

  return {
    client: {
      firstName: parsedData.client?.firstName || '',
      lastName: parsedData.client?.lastName || '',
      email: parsedData.client?.email || '',
      company,
      companyDomain: parsedData.client?.companyDomain || '',
    },
    project: {
      title: parsedData.project?.title || '',
      duration: parsedData.project?.duration || '',
      totalValue: parsedData.project?.totalValue || '',
      platformCosts: parsedData.project?.platformCosts || '',
      monthOneInvestment: parsedData.project?.monthOneInvestment || '',
      monthTwoInvestment: parsedData.project?.monthTwoInvestment || '',
      monthThreeInvestment: parsedData.project?.monthThreeInvestment || '',
    },
    content: parsedData.content || {
      problems: ['', '', '', ''],
      benefits: ['', '', '', ''],
    },
    expanded: llmContent || {
      problemExpansions: parsedData.content?.problems as [string, string, string, string] || ['', '', '', ''],
      benefitExpansions: parsedData.content?.benefits as [string, string, string, string] || ['', '', '', ''],
    },
    generated: {
      slideFooter: company ? `${company} | Confidential` : 'Confidential',
      contractFooterSlug: `proposal-${Date.now()}`,
      createdDate: today,
    },
  }
}

export default function GoogleSlidesButton({ data, briefText, isEmpty, preGeneratedContent, onSuccess, designConfig }: GoogleSlidesButtonProps) {
  const [stage, setStage] = useState<Stage>('idle')
  const [progressStep, setProgressStep] = useState(0)
  const [slidesUrl, setSlidesUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isWorking = stage === 'authenticating' || stage === 'generating' || stage === 'creating'

  const handleCreateSlides = async () => {
    if (!data || isEmpty || isWorking) return

    setStage('authenticating')
    setProgressStep(0)
    setErrorMessage(null)
    setSlidesUrl(null)

    try {
      // Step 1: Get OAuth token
      const token = await getValidToken()
      setProgressStep(1)

      // Step 2: Generate LLM content (skip if already pre-generated via chatbot)
      setStage('generating')
      const llmContent = preGeneratedContent ?? await generateProposalContent(briefText, data)
      setProgressStep(2)

      // Step 3: Build full proposal data
      const proposalData = buildProposalData(data, llmContent)
      setStage('creating')
      setProgressStep(3)

      // Step 4: Create presentation from scratch
      const result = await createGoogleSlidesPresentation(proposalData, token, designConfig)
      setProgressStep(4)

      setSlidesUrl(result.presentationUrl)
      setStage('done')
      onSuccess?.(result.presentationUrl)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      logError(message, 'api', { component: 'GoogleSlidesButton' }, 'GoogleSlidesButton')
      setErrorMessage(message)
      setStage('error')
    }
  }

  const handleRetry = () => {
    setStage('idle')
    setProgressStep(0)
    setErrorMessage(null)
  }

  // -------------------------------------------------------------------------
  // Done state — show "Open in Google Slides" link
  // -------------------------------------------------------------------------
  if (stage === 'done' && slidesUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="space-y-3"
      >
        <a
          href={slidesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="
            flex items-center justify-center gap-3 w-full px-6 py-4 rounded-xl
            bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-base
            transition-all duration-200 shadow-md hover:shadow-lg
          "
        >
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Open in Google Slides
          <svg className="w-4 h-4 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
        <button
          type="button"
          onClick={handleRetry}
          className="w-full text-sm text-navy-400 hover:text-navy-600 transition-colors py-1"
        >
          Create another presentation
        </button>
      </motion.div>
    )
  }

  // -------------------------------------------------------------------------
  // Working state — animated progress steps
  // -------------------------------------------------------------------------
  if (isWorking) {
    return (
      <div className="w-full px-6 py-5 rounded-xl border-2 border-blue-200 bg-blue-50">
        <div className="flex items-center gap-3 mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
            className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full flex-shrink-0"
          />
          <span className="text-sm font-semibold text-blue-800">
            {PROGRESS_STEPS[progressStep] || 'Working...'}
          </span>
        </div>
        <div className="space-y-2">
          {PROGRESS_STEPS.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full flex-shrink-0 transition-all duration-300 ${
                i < progressStep
                  ? 'bg-emerald-500'
                  : i === progressStep
                    ? 'bg-blue-500'
                    : 'bg-blue-200'
              }`} />
              <span className={`text-xs transition-colors duration-300 ${
                i <= progressStep ? 'text-blue-700' : 'text-blue-400'
              }`}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------
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
            <p className="text-sm font-semibold text-red-800">Slides creation failed</p>
            <p className="text-xs text-red-600 mt-0.5">{errorMessage}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          className="w-full px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </motion.div>
    )
  }

  // -------------------------------------------------------------------------
  // Idle state — main button
  // -------------------------------------------------------------------------
  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={handleCreateSlides}
        disabled={isEmpty}
        whileHover={!isEmpty ? { scale: 1.01, y: -2 } : {}}
        whileTap={!isEmpty ? { scale: 0.99 } : {}}
        className={`
          relative w-full px-6 py-4 rounded-xl font-semibold text-base
          flex items-center justify-center gap-3 overflow-hidden
          transition-all duration-300 border-2
          ${isEmpty
            ? 'bg-cream-200 text-navy-400 border-cream-300 cursor-not-allowed'
            : 'bg-white text-navy-800 border-navy-200 hover:border-blue-400 hover:shadow-md'
          }
        `}
        aria-label="Create Google Slides presentation"
      >
        {/* Google-colour left accent bar */}
        {!isEmpty && (
          <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl overflow-hidden">
            <div className="h-1/4 bg-[#4285F4]" />
            <div className="h-1/4 bg-[#DB4437]" />
            <div className="h-1/4 bg-[#F4B400]" />
            <div className="h-1/4 bg-[#0F9D58]" />
          </div>
        )}

        {/* Google Slides icon */}
        <svg className={`w-5 h-5 flex-shrink-0 ${isEmpty ? 'text-navy-400' : 'text-[#4285F4]'}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-2-4H7v-2h10v2zm0-4H7V9h10v2z"/>
        </svg>

        <span>Create Google Slides Presentation</span>

        {/* Arrow indicator */}
        <svg
          className={`w-4 h-4 ml-auto ${isEmpty ? 'text-navy-300' : 'text-navy-400'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.button>

      {/* Helper hint */}
      <AnimatePresence>
        {!isEmpty && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-xs text-navy-400 text-center"
          >
            Creates a professional presentation in your Google Drive
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
