import type { SlideData } from '../../data/slideContent'
import type { ThemeColors } from '../../utils/design/system'
import type { SlideOverrides } from '../../utils/design/vocabulary'

/** Common props shape shared by every variant component. */
export interface VariantProps {
  slide: SlideData
  theme: ThemeColors
  overrides?: SlideOverrides
}

/** Extracts the title text the variant should render, honoring an AI rewrite. */
export function effectiveTitle(slide: SlideData, overrides?: SlideOverrides): string {
  return overrides?.titleText?.trim() || slide.title
}

/** Extracts the eyebrow the variant should render (override > slide.subtitle). */
export function effectiveEyebrow(slide: SlideData, overrides?: SlideOverrides): string | undefined {
  const fromOverride = overrides?.eyebrow?.trim()
  if (fromOverride) return fromOverride
  return slide.subtitle?.trim() || undefined
}

/** Bullets the variant should render — reviewer rewrites win, then maxBullets cap. */
export function effectiveBullets(slide: SlideData, overrides?: SlideOverrides): string[] {
  const source = overrides?.bulletRewrites && overrides.bulletRewrites.length > 0
    ? overrides.bulletRewrites
    : slide.bullets
  const cap = overrides?.maxBullets
  return typeof cap === 'number' && cap > 0 ? source.slice(0, cap) : source
}

/** First numeric/statistical token in a string, e.g. "+47%", "$2.4B", "12x". */
const STAT_RE = /([+-]?\$?\d[\d,.]*\s*(?:%|x|B|M|K)?)/i
export function extractStat(text: string): string | null {
  const m = text.match(STAT_RE)
  return m ? m[1].trim() : null
}
