import { motion } from 'framer-motion'
import { TMOBILE_PARAMOUNT_SLIDES, type SlideData } from '../data/slideContent'

interface SlidePreviewProps {
  fileName: string
}

function SlideCard({ slide, index }: { slide: SlideData; index: number }) {
  const isTitle = slide.type === 'title'
  const isClosing = slide.type === 'closing'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6 last:mb-0"
    >
      <div className="preview-paper rounded-lg overflow-hidden">
        {/* Slide number badge */}
        <div className="flex items-center gap-3 px-6 pt-5 pb-3">
          <div className="w-7 h-7 rounded-full bg-gold-500 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-navy-800">{slide.slideNumber}</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-navy-400">
            Slide {slide.slideNumber}
          </span>
        </div>

        {/* Slide content */}
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
              // Check if bullet looks like a header/label (ends with colon)
              const isLabel = bullet.endsWith(':')
              // Check if it's a short punchy line (closing slide style)
              const isPunchLine = isClosing && bullet.length < 30 && !bullet.includes(',')
              // Check if it's a quoted line
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

        {/* Gold accent bar */}
        <div className="h-1 bg-gradient-to-r from-gold-400 via-gold-500 to-gold-400" />
      </div>
    </motion.div>
  )
}

export default function SlidePreview({ fileName }: SlidePreviewProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-cream-200 border-b border-cream-400">
        <div className="flex items-center gap-3">
          {/* PDF icon */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-md shadow-sm">
            <svg className="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
            </svg>
            <span className="text-sm font-medium text-navy-700 truncate max-w-[200px]">
              {fileName}
            </span>
          </div>
        </div>
        <span className="text-sm text-navy-400">{TMOBILE_PARAMOUNT_SLIDES.length} slides</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto preview-grid-bg p-6 lg:p-8">
        <div className="max-w-[600px] mx-auto">
          {TMOBILE_PARAMOUNT_SLIDES.map((slide, index) => (
            <SlideCard key={slide.slideNumber} slide={slide} index={index} />
          ))}
        </div>
      </div>
    </div>
  )
}
