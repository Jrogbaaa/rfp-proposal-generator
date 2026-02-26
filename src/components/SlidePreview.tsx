import { motion } from 'framer-motion'
import type { ProposalData } from '../types/proposal'
import { TMOBILE_PARAMOUNT_SLIDES, type SlideData } from '../data/slideContent'

interface SlidePreviewProps {
  fileName?: string
  data?: Partial<ProposalData> | null
}

// Build slide outline cards from real proposal data
function buildSlidesFromData(data: Partial<ProposalData>): SlideData[] {
  const client = data.client
  const project = data.project
  const content = data.content
  const expanded = data.expanded

  const company = client?.company || 'Client'
  const projectTitle = project?.title || 'Digital Transformation'
  const problems = content?.problems || ['', '', '', '']
  const benefits = content?.benefits || ['', '', '', '']
  const problemExpansions = expanded?.problemExpansions // [string, string, string, string] | undefined
  const benefitExpansions = expanded?.benefitExpansions // [string, string, string, string] | undefined

  return [
    {
      slideNumber: 1,
      type: 'title',
      title: projectTitle,
      subtitle: `Presented to ${client?.firstName ? `${client.firstName} ${client.lastName}` : company}`,
      bullets: [
        `${company} · ${project?.duration || 'TBD'}`,
        `Investment: ${project?.totalValue || 'TBD'}`,
      ],
    },
    {
      slideNumber: 2,
      type: 'content',
      title: 'The Challenge',
      subtitle: `What's holding ${company} back`,
      bullets: problems.filter(Boolean).length > 0
        ? problems.filter(Boolean).map((p) => p)
        : ['Challenges to be defined'],
    },
    {
      slideNumber: 3,
      type: 'content',
      title: problems[0] || 'Problem 1',
      subtitle: undefined,
      bullets: problemExpansions
        ? [problemExpansions[0] || 'Details to be expanded']
        : ['This challenge will be detailed in the proposal.'],
    },
    {
      slideNumber: 4,
      type: 'content',
      title: problems[1] || 'Problem 2',
      subtitle: undefined,
      bullets: problemExpansions
        ? [problemExpansions[1] || 'Details to be expanded']
        : ['This challenge will be detailed in the proposal.'],
    },
    {
      slideNumber: 5,
      type: 'content',
      title: 'Challenges 3 & 4',
      subtitle: undefined,
      bullets: [
        problems[2] || 'Problem 3',
        problemExpansions?.[2] || '',
        problems[3] || 'Problem 4',
        problemExpansions?.[3] || '',
      ].filter(Boolean),
    },
    {
      slideNumber: 6,
      type: 'content',
      title: 'Our Solution',
      subtitle: `How we deliver results for ${company}`,
      bullets: benefits.filter(Boolean).length > 0
        ? benefits.filter(Boolean).map((b) => b)
        : ['Benefits to be defined'],
    },
    {
      slideNumber: 7,
      type: 'content',
      title: benefits[0] || 'Benefit 1',
      subtitle: undefined,
      bullets: benefitExpansions
        ? [benefitExpansions[0] || 'Details to be expanded']
        : ['This outcome will be detailed in the proposal.'],
    },
    {
      slideNumber: 8,
      type: 'content',
      title: benefits[1] || 'Benefit 2',
      subtitle: undefined,
      bullets: benefitExpansions
        ? [benefitExpansions[1] || 'Details to be expanded']
        : ['This outcome will be detailed in the proposal.'],
    },
    {
      slideNumber: 9,
      type: 'content',
      title: 'Investment & Timeline',
      subtitle: undefined,
      bullets: [
        `Total Investment: ${project?.totalValue || 'TBD'}`,
        `Timeline: ${project?.duration || 'TBD'}`,
        project?.monthOneInvestment ? `Month 1: ${project.monthOneInvestment}` : '',
        project?.monthTwoInvestment ? `Month 2: ${project.monthTwoInvestment}` : '',
        project?.monthThreeInvestment ? `Month 3: ${project.monthThreeInvestment}` : '',
      ].filter(Boolean),
    },
    {
      slideNumber: 10,
      type: 'closing',
      title: `Let's Build This Together`,
      subtitle: company,
      bullets: [
        `Ready to move forward, ${client?.firstName || company}?`,
        client?.email ? `Reach us at ${client.email}` : '',
      ].filter(Boolean),
    },
  ]
}

function SlideCard({ slide, index }: { slide: SlideData; index: number }) {
  const isTitle = slide.type === 'title'
  const isClosing = slide.type === 'closing'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mb-5 last:mb-0"
    >
      <div className="preview-paper rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-6 pt-5 pb-3">
          <div className="w-7 h-7 rounded-full bg-gold-500 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-navy-800">{slide.slideNumber}</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-navy-400">
            Slide {slide.slideNumber}
          </span>
        </div>

        <div className={`px-6 pb-5 ${isTitle || isClosing ? 'text-center pt-4 pb-8' : ''}`}>
          <h3 className={`font-display text-navy-800 mb-1 ${isTitle ? 'text-2xl' : 'text-lg'}`}>
            {slide.title}
          </h3>

          {slide.subtitle && (
            <p className={`text-gold-600 font-medium mb-4 ${isTitle ? 'text-base' : 'text-sm'}`}>
              {slide.subtitle}
            </p>
          )}

          {!slide.subtitle && <div className="mb-3" />}

          <div className={`space-y-2 ${isTitle || isClosing ? 'max-w-md mx-auto' : ''}`}>
            {slide.bullets.map((bullet, i) => {
              const isLabel = bullet.endsWith(':')
              const isPunchLine = isClosing && bullet.length < 60
              const isQuote = bullet.startsWith('"') && bullet.endsWith('"')

              return (
                <p
                  key={i}
                  className={`
                    text-sm leading-relaxed
                    ${isLabel ? 'font-semibold text-navy-700 mt-3 first:mt-0' : ''}
                    ${isPunchLine ? 'text-navy-600 font-medium' : ''}
                    ${isQuote ? 'text-gold-600 font-semibold italic text-base' : ''}
                    ${!isLabel && !isPunchLine && !isQuote ? 'text-navy-600 pl-3' : ''}
                  `}
                >
                  {!isLabel && !isPunchLine && !isQuote && !isTitle && !isClosing && (
                    <span className="text-gold-500 mr-2">&#x2022;</span>
                  )}
                  {bullet}
                </p>
              )
            })}
          </div>
        </div>

        <div className="h-1 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-400" />
      </div>
    </motion.div>
  )
}

export default function SlidePreview({ fileName, data }: SlidePreviewProps) {
  const slides = data && (data.client?.company || data.project?.title || data.content?.problems?.[0])
    ? buildSlidesFromData(data)
    : TMOBILE_PARAMOUNT_SLIDES

  const isRealData = data && (data.client?.company || data.project?.title || data.content?.problems?.[0])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-cream-200 border-b border-cream-400 rounded-t-xl flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-md shadow-sm">
            <svg className="w-4 h-4 text-navy-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <span className="text-sm font-medium text-navy-700 truncate max-w-[200px]">
              {isRealData
                ? `${data?.project?.title || data?.client?.company || 'Proposal'} — Preview`
                : (fileName || 'Slide Preview')}
            </span>
          </div>
          {isRealData && (
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              Live data
            </span>
          )}
        </div>
        <span className="text-sm text-navy-400">{slides.length} slides</span>
      </div>

      {/* Slides */}
      <div className="flex-1 overflow-auto preview-grid-bg p-5 lg:p-7 rounded-b-xl">
        <div className="max-w-[600px] mx-auto">
          {slides.map((slide, index) => (
            <SlideCard key={slide.slideNumber} slide={slide} index={index} />
          ))}
        </div>
      </div>
    </div>
  )
}
