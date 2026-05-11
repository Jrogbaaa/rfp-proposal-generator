import { forwardRef } from 'react'
import type { SlideData } from '../data/slideContent'
import type { DesignConfig } from '../types/proposal'
import { resolveTheme } from '../utils/design/system'
import { pickLayout, toneDefaults, type SlideOverrides } from '../utils/design/vocabulary'
import SlideFrame from './slides/SlideFrame'
import TitleEditorial from './slides/TitleEditorial'
import TitleStat from './slides/TitleStat'
import SectionNumeral from './slides/SectionNumeral'
import ContentList from './slides/ContentList'
import ContentTwoUp from './slides/ContentTwoUp'
import ContentQuote from './slides/ContentQuote'
import ContentStatGrid from './slides/ContentStatGrid'
import ContentTimeline from './slides/ContentTimeline'
import ImpactStatement from './slides/ImpactStatement'
import ClosingCta from './slides/ClosingCta'

// Re-export for backwards compatibility with existing consumers
// (DesignStudio.tsx, designReview.ts).
export type { SlideOverrides } from '../utils/design/vocabulary'

interface SlideCanvasRendererProps {
  slide: SlideData
  designConfig: DesignConfig
  overrides?: SlideOverrides
  scale?: number
}

/**
 * Slide renderer / dispatcher.
 *
 * Looks up the theme palette, picks a layout variant (AI override if valid,
 * else content-shape default), wraps it in the 1920x1080 canvas, and renders
 * the right variant component. Each variant is small and lives in
 * src/components/slides/.
 *
 * Hard-encoded design rules (none of these can be turned off by overrides):
 *   - No gradients anywhere in the slide canvas
 *   - No body text below 26px at canvas size (the type scale has no smaller body role)
 *   - One accent gesture per slide, picked by toneDefaults()
 *   - Layout is chosen by content shape, NOT by slide index modulo
 */
const SlideCanvasRenderer = forwardRef<HTMLDivElement, SlideCanvasRendererProps>(
  ({ slide, designConfig, overrides, scale = 1 }, ref) => {
    const theme = resolveTheme(designConfig.colorTheme)
    const variant = pickLayout(slide, overrides)
    const tone = overrides?.tone ?? 'editorial'
    const { bg } = toneDefaults(variant, tone)

    const props = { slide, theme, overrides }

    let body: React.ReactNode = null
    switch (variant) {
      case 'title-editorial':   body = <TitleEditorial   {...props} />; break
      case 'title-stat':        body = <TitleStat        {...props} />; break
      case 'section-numeral':   body = <SectionNumeral   {...props} />; break
      case 'content-list':      body = <ContentList      {...props} />; break
      case 'content-two-up':    body = <ContentTwoUp     {...props} />; break
      case 'content-quote':     body = <ContentQuote     {...props} />; break
      case 'content-stat-grid': body = <ContentStatGrid  {...props} />; break
      case 'content-timeline':  body = <ContentTimeline  {...props} />; break
      case 'impact-statement':  body = <ImpactStatement  {...props} />; break
      case 'closing-cta':       body = <ClosingCta       {...props} />; break
      default:                  body = <ContentList      {...props} />
    }

    return (
      <SlideFrame ref={ref} theme={theme} bg={bg} scale={scale}>
        {body}
      </SlideFrame>
    )
  },
)

SlideCanvasRenderer.displayName = 'SlideCanvasRenderer'

export default SlideCanvasRenderer
