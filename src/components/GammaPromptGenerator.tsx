import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ProposalData } from '../types/proposal'

interface GammaPromptGeneratorProps {
  data: Partial<ProposalData> | null
  isEmpty: boolean
}

const generateGammaPrompt = (data: Partial<ProposalData> | null): string => {
  if (!data) return ''

  // Extract data from the brief
  const clientName = data.client?.firstName && data.client?.lastName 
    ? `${data.client.firstName} ${data.client.lastName}` 
    : data.client?.firstName || 'Client Contact'
  const company = data.client?.company || 'Client Company'
  const projectTitle = data.project?.title || 'Digital Customer Experience Transformation'
  const duration = data.project?.duration || '4 months'
  const totalBudget = data.project?.totalValue || '$175,000'
  
  // Get problems and benefits from the brief, filter out empty ones
  const problems = data.content?.problems?.filter(p => p.trim()) || []
  const benefits = data.content?.benefits?.filter(b => b.trim()) || []

  // Build the coffee-themed prompt
  const prompt = `You are Look After You, a world-class digital experience agency preparing a visually compelling, executive-ready presentation for ${company}. The deck should use coffee-inspired metaphors, language, and storytelling (brew, blend, roast, aroma, grind, pour, etc.) while maintaining strategic credibility and business rigor.

Create a 10-slide presentation that responds to the following client brief and communicates a confident Look After You solution to senior ${company} leaders.

Tone: premium, warm, strategic, innovative, and outcome-driven.

Slide Structure:

1. Executive Brew — Vision & Impact
High-level transformation vision and business outcomes.

2. The Grind — Current Challenges
Translate the problems into business risks and customer experience gaps.

3. The Perfect Blend — Look After You's Strategic Approach
Experience, data, AI, and operations unified into one system.

4. Customer Journey Roast — Reimagining the Experience
Before vs. after customer journey with personalization moments.

5. Data Espresso Shot — Unified Customer Intelligence
How data is unified in real time across loyalty, app, store, and channels.

6. Personalization Pour-Over — AI in Action
How AI personalization increases engagement and average order value.

7. Brew Plan — 4-Month Delivery Roadmap
Phased approach with milestones and business outcomes.

8. Investment Recipe — Budget & ROI Alignment
How the ${totalBudget} investment translates into value creation.

9. Flavor Profile — Success Metrics & Impact
KPIs, engagement lift, revenue growth, and operational efficiency.

10. The Last Sip — Why Look After You & Next Steps
Differentiation, partnership model, and call to action.

Use:
	•	Headline-driven slides
	•	Coffee-inspired metaphors
	•	Executive-level clarity
	•	Business outcomes over technical jargon
	•	Visually suggestive layout language (diagrams described in text)

Client Brief:

⸻

Project: ${projectTitle}
Client: ${clientName}, ${company}
Timeline: ${duration}
Budget: ${totalBudget}

Problems:
${problems.length > 0 
  ? problems.map(p => `	•	${p}`).join('\n')
  : `	•	Mobile app engagement has dropped 23% since last quarter
	•	Customer loyalty program data is siloed across multiple systems
	•	Store-level analytics are delayed by 48+ hours
	•	Personalization engine is serving generic recommendations`}

Benefits:
${benefits.length > 0
  ? benefits.map(b => `	•	${b}`).join('\n')
  : `	•	Real-time unified customer view across all touchpoints
	•	15-20% lift in mobile app engagement within 90 days
	•	Same-day actionable insights for store managers
	•	AI-powered personalization driving 12% higher average order value`}

⸻`

  return prompt
}

export default function GammaPromptGenerator({ data, isEmpty }: GammaPromptGeneratorProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const generatedPrompt = useMemo(() => generateGammaPrompt(data), [data])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2500)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleToggleExpand = () => {
    setIsExpanded(prev => !prev)
  }

  return (
    <div className="relative">
      {/* Main Button */}
      <motion.button
        type="button"
        onClick={handleToggleExpand}
        disabled={isEmpty}
        whileHover={!isEmpty ? { scale: 1.01, y: -2 } : {}}
        whileTap={!isEmpty ? { scale: 0.99 } : {}}
        className={`
          relative w-full px-6 py-4 rounded-xl font-semibold text-base
          flex items-center justify-center gap-3 overflow-hidden
          transition-all duration-300 border-2
          ${isEmpty
            ? 'bg-cream-200 text-navy-400 border-cream-300 cursor-not-allowed'
            : isExpanded
              ? 'bg-violet-600 text-white border-violet-600 shadow-lg'
              : 'bg-white text-navy-800 border-navy-200 hover:border-violet-400 hover:shadow-md'
          }
        `}
        aria-expanded={isExpanded}
        aria-label="Generate Gamma presentation prompt"
        tabIndex={0}
      >
        {/* Gamma-style gradient accent */}
        {!isEmpty && !isExpanded && (
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-violet-500 via-fuchsia-500 to-amber-400 rounded-l-xl" />
        )}

        {/* Icon */}
        <svg 
          className={`w-5 h-5 transition-colors ${isExpanded ? 'text-white' : 'text-violet-500'}`} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M9 21V9" />
        </svg>

        <span>Gamma Presentation Prompt</span>

        {/* Expand/collapse indicator */}
        <motion.svg
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className={`w-4 h-4 ml-auto ${isExpanded ? 'text-violet-200' : 'text-navy-400'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
      </motion.button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && !isEmpty && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-cream-300 shadow-lg overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 bg-gradient-to-r from-violet-50 to-fuchsia-50 border-b border-cream-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-semibold text-navy-800 text-sm">Your Gamma Prompt</h4>
                      <p className="text-xs text-navy-500">Copy and paste into gamma.app</p>
                    </div>
                  </div>

                  {/* Copy Button */}
                  <motion.button
                    type="button"
                    onClick={handleCopy}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                      transition-all duration-200
                      ${isCopied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-violet-600 text-white hover:bg-violet-700'
                      }
                    `}
                    aria-label={isCopied ? 'Copied to clipboard' : 'Copy prompt to clipboard'}
                    tabIndex={0}
                  >
                    {isCopied ? (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                        Copy Prompt
                      </>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Prompt Preview */}
              <div className="p-5">
                <div className="relative">
                  <pre className="whitespace-pre-wrap text-sm text-navy-700 leading-relaxed font-sans max-h-64 overflow-y-auto p-4 bg-cream-50 rounded-xl border border-cream-200">
                    {generatedPrompt}
                  </pre>

                  {/* Fade gradient at bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-cream-50 to-transparent pointer-events-none rounded-b-xl" />
                </div>

                {/* Helper text */}
                <div className="mt-4 flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
                  </svg>
                  <div className="text-sm text-amber-800">
                    <p className="font-medium">How to use:</p>
                    <ol className="mt-1 space-y-1 text-amber-700">
                      <li>1. Copy the prompt above</li>
                      <li>2. Go to <a href="https://gamma.app" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900">gamma.app</a> and create a new presentation</li>
                      <li>3. Paste the prompt and let Gamma generate your slides</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
