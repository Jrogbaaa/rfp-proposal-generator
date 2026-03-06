import { useState } from 'react'
import { motion } from 'framer-motion'
import type { ProposalData, DesignConfig } from '../types/proposal'
import type { SlideData } from '../data/slideContent'
import { buildSlidesFromData } from '../utils/slideBuilder'

interface SlidePreviewProps {
  fileName?: string
  data?: Partial<ProposalData> | null
  designConfig?: DesignConfig
  isUpdating?: boolean
  chatUpdateVersion?: number
  onSlideEdit?: (slideNumber: number, bulletIndex: number, newText: string) => void
  onSlideTitleEdit?: (slideNumber: number, newTitle: string) => void
}

// Theme token shapes for dynamic coloring
interface ThemeTokens {
  accentBar: string
  badgeBg: string
  badgeText: string
  title: string
  subtitle: string
  bullet: string
}

const THEME_MAP: Record<string, ThemeTokens> = {
  'navy-gold': {
    accentBar: 'from-gold-400 via-gold-500 to-gold-400',
    badgeBg: 'bg-gold-500',
    badgeText: 'text-navy-800',
    title: 'text-navy-800',
    subtitle: 'text-gold-600',
    bullet: 'text-gold-500',
  },
  'slate-blue': {
    accentBar: 'from-blue-400 via-blue-500 to-blue-400',
    badgeBg: 'bg-blue-500',
    badgeText: 'text-white',
    title: 'text-slate-800',
    subtitle: 'text-blue-600',
    bullet: 'text-blue-500',
  },
  'forest-green': {
    accentBar: 'from-green-400 via-green-500 to-green-400',
    badgeBg: 'bg-green-600',
    badgeText: 'text-white',
    title: 'text-stone-800',
    subtitle: 'text-green-700',
    bullet: 'text-green-500',
  },
  'executive-dark': {
    accentBar: 'from-stone-300 via-stone-200 to-stone-300',
    badgeBg: 'bg-stone-700',
    badgeText: 'text-stone-100',
    title: 'text-navy-800',
    subtitle: 'text-stone-500',
    bullet: 'text-stone-400',
  },
}

const DEFAULT_THEME = THEME_MAP['navy-gold']

function SlideCard({
  slide,
  index,
  theme = DEFAULT_THEME,
  chatUpdateVersion = 0,
  onBulletEdit,
  onTitleEdit,
}: {
  slide: SlideData
  index: number
  theme?: ThemeTokens
  chatUpdateVersion?: number
  onBulletEdit?: (bulletIndex: number, newText: string) => void
  onTitleEdit?: (newTitle: string) => void
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const isTitle = slide.type === 'title'
  const isClosing = slide.type === 'closing'

  const handleEditStart = (i: number, text: string) => {
    setEditingIndex(i)
    setEditValue(text)
  }

  const handleEditSave = (i: number) => {
    if (editValue.trim() && onBulletEdit) {
      onBulletEdit(i, editValue.trim())
    }
    setEditingIndex(null)
  }

  const handleTitleSave = () => {
    if (onTitleEdit) onTitleEdit(titleValue.trim() || slide.title)
    setEditingTitle(false)
  }

  return (
    <motion.div
      key={`${slide.slideNumber}-${chatUpdateVersion}-${slide.bullets.join('|').slice(0, 60)}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mb-5 last:mb-0 group"
    >
      <div className="preview-paper rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-6 pt-5 pb-3">
          <div className={`w-7 h-7 rounded-full ${theme.badgeBg} flex items-center justify-center flex-shrink-0`}>
            <span className={`text-xs font-bold ${theme.badgeText}`}>{slide.slideNumber}</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-navy-400">
            Slide {slide.slideNumber}
          </span>
          {(onBulletEdit || onTitleEdit) && (
            <span className="ml-auto text-[10px] text-navy-300 font-medium">click to edit</span>
          )}
        </div>

        <div className={`px-6 pb-5 ${isTitle || isClosing ? 'text-center pt-4 pb-8' : ''}`}>
          {/* Title — editable on all slides except closing (slide 1 title = project title) */}
          {onTitleEdit && !isClosing ? (
            editingTitle ? (
              <input
                autoFocus
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleSave}
                onKeyDown={(e) => { if (e.key === 'Enter') handleTitleSave() }}
                className={`font-display text-lg w-full bg-transparent border-0 outline-none p-0 m-0 mb-1 ${theme.title}`}
              />
            ) : (
              <h3
                className={`font-display mb-1 text-lg ${theme.title} cursor-pointer hover:bg-gold-50 rounded px-1 -mx-1 transition-colors inline-flex items-center gap-1`}
                onClick={() => { setEditingTitle(true); setTitleValue(slide.title) }}
              >
                {slide.title}
                <span className="opacity-0 group-hover:opacity-100 text-navy-300 text-[11px] transition-opacity">✏</span>
              </h3>
            )
          ) : (
            <h3 className={`font-display mb-1 ${isTitle ? 'text-2xl' : 'text-lg'} ${theme.title}`}>
              {slide.title}
            </h3>
          )}

          {slide.subtitle && (
            <p className={`font-medium mb-4 ${isTitle ? 'text-base' : 'text-sm'} ${theme.subtitle}`}>
              {slide.subtitle}
            </p>
          )}

          {!slide.subtitle && <div className="mb-3" />}

          <div className={`space-y-2 ${isTitle || isClosing ? 'max-w-md mx-auto' : ''}`}>
            {slide.bullets.map((bullet, i) => {
              const isLabel = bullet.endsWith(':')
              const isPunchLine = isClosing && bullet.length < 60
              const isQuote = bullet.startsWith('"') && bullet.endsWith('"')
              const isEditable = !!onBulletEdit && !isLabel && !isTitle

              if (editingIndex === i) {
                return (
                  <textarea
                    key={i}
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => handleEditSave(i)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(i) } }}
                    className="w-full text-sm leading-relaxed text-navy-600 pl-3 resize-none bg-transparent border-0 outline-none focus:outline-none p-0 shadow-none"
                    rows={3}
                  />
                )
              }

              return (
                <p
                  key={i}
                  onClick={isEditable ? () => handleEditStart(i, bullet) : undefined}
                  className={`
                    text-sm leading-relaxed
                    ${isLabel ? 'font-semibold text-navy-700 mt-3 first:mt-0' : ''}
                    ${isPunchLine ? 'text-navy-600 font-medium' : ''}
                    ${isQuote ? `font-semibold italic text-base ${theme.subtitle}` : ''}
                    ${!isLabel && !isPunchLine && !isQuote ? 'text-navy-600 pl-3' : ''}
                    ${isEditable ? 'cursor-pointer hover:bg-gold-50 rounded-md px-2 -mx-2 transition-colors' : ''}
                  `}
                >
                  {!isLabel && !isPunchLine && !isQuote && !isTitle && !isClosing && (
                    <span className={`${theme.bullet} mr-2`}>&#x2022;</span>
                  )}
                  {bullet}
                </p>
              )
            })}
          </div>
        </div>

        <div className={`h-1 bg-gradient-to-r ${theme.accentBar}`} />
      </div>
    </motion.div>
  )
}

// All slides are editable
const isEditableSlide = (_n: number) => true

export default function SlidePreview({ fileName, data, designConfig, isUpdating, chatUpdateVersion, onSlideEdit, onSlideTitleEdit }: SlidePreviewProps) {
  const hasRealData = !!(data && (data.client?.company || data.project?.title || data.content?.problems?.[0]))
  const slides = hasRealData ? buildSlidesFromData(data!) : null
  const theme = THEME_MAP[designConfig?.colorTheme ?? 'navy-gold'] ?? DEFAULT_THEME

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
              {hasRealData
                ? `${data?.project?.title || data?.client?.company || 'Proposal'} — Preview`
                : (fileName || 'Slide Preview')}
            </span>
          </div>
          {isUpdating ? (
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full animate-pulse">
              ✦ Rewriting…
            </span>
          ) : hasRealData ? (
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              Live data
            </span>
          ) : null}
        </div>
        {slides && <span className="text-sm text-navy-400">{slides.length} slides</span>}
      </div>

      {/* Slides or empty state */}
      <div className={`flex-1 overflow-auto preview-grid-bg p-5 lg:p-7 rounded-b-xl transition-opacity duration-300 ${isUpdating ? 'opacity-50' : 'opacity-100'}`}>
        {slides ? (
          <div className="max-w-[600px] mx-auto">
            {slides.map((slide, index) => (
              <SlideCard
                key={slide.slideNumber}
                slide={slide}
                index={index}
                theme={theme}
                chatUpdateVersion={chatUpdateVersion}
                onBulletEdit={onSlideEdit && isEditableSlide(slide.slideNumber)
                  ? (bulletIndex, newText) => onSlideEdit(slide.slideNumber, bulletIndex, newText)
                  : undefined
                }
                onTitleEdit={onSlideTitleEdit && isEditableSlide(slide.slideNumber)
                  ? (newTitle) => onSlideTitleEdit(slide.slideNumber, newTitle)
                  : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="w-16 h-16 text-navy-300/40 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="3" y="3" width="18" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <p className="text-sm font-medium text-navy-400">No slides to preview yet</p>
            <p className="text-xs text-navy-300 mt-1">Upload a brief to generate your deck</p>
          </div>
        )}
      </div>
    </div>
  )
}
