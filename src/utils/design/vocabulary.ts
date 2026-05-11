/**
 * Shared design vocabulary — the contract between the AI design reviewer
 * and the slide renderer.
 *
 * Both files import LayoutVariant from here so the reviewer can ONLY return
 * choices the renderer knows how to render. A string the renderer doesn't
 * recognize falls back to a content-shape default, never crashes.
 */

import type { SlideData } from '../../data/slideContent'

// ─────────────────────────────────────────────────────────────────────────────
// Layout variants — what the slide looks like.
// Each is implemented as a small React component under src/components/slides/.
// ─────────────────────────────────────────────────────────────────────────────

export type LayoutVariant =
  | 'title-editorial'    // serif headline, generous whitespace, no pill bullets
  | 'title-stat'         // single big number + short caption, used when subtitle has a stat
  | 'section-numeral'    // faint giant numeral + short section title
  | 'content-list'       // headline + clean bullet list, no cards, single accent rule
  | 'content-two-up'     // two parallel ideas, equal weight, vertical rule between
  | 'content-quote'      // pulled quote with attribution
  | 'content-stat-grid'  // 2-4 stats, each = big number + caption
  | 'content-timeline'   // ordered steps with numerals and rules
  | 'impact-statement'   // one sentence, very large, ample whitespace
  | 'closing-cta'        // call to action, minimal, no corner marks

export const ALL_LAYOUTS: LayoutVariant[] = [
  'title-editorial',
  'title-stat',
  'section-numeral',
  'content-list',
  'content-two-up',
  'content-quote',
  'content-stat-grid',
  'content-timeline',
  'impact-statement',
  'closing-cta',
]

// ─────────────────────────────────────────────────────────────────────────────
// Emphasis — which token in the slide gets a typographic promotion.
// ─────────────────────────────────────────────────────────────────────────────

/**
 *   - title:     the slide title is the hero (default for most layouts)
 *   - firstWord: the first word/phrase of the title is scaled larger
 *   - number:    a numeric token in the content is promoted (forces stat-grid / title-stat)
 *   - none:      no token is promoted; even hierarchy
 */
export type Emphasis = 'title' | 'firstWord' | 'number' | 'none'

// ─────────────────────────────────────────────────────────────────────────────
// Density — how much content the layout should show.
// Reviewer can downshift dense slides to sparse.
// ─────────────────────────────────────────────────────────────────────────────

/**
 *   - sparse:   1-2 elements, maximum whitespace, used for impact/quote/CTA
 *   - balanced: 3-5 elements, default for content slides
 *   - dense:    6+ elements; rare, used only when content truly demands it
 */
export type Density = 'sparse' | 'balanced' | 'dense'

// ─────────────────────────────────────────────────────────────────────────────
// Tone — overall visual register for a single slide.
// Affects which Accent the layout uses and the BgMode chosen.
// ─────────────────────────────────────────────────────────────────────────────

/**
 *   - editorial: serif-led, generous whitespace, single thin accent rule
 *   - corporate: sans-led, more structured, neutral surface backgrounds
 *   - minimal:   maximum restraint, no decoration, type only
 */
export type Tone = 'editorial' | 'corporate' | 'minimal'

// ─────────────────────────────────────────────────────────────────────────────
// Slide overrides — produced by the AI reviewer, consumed by the renderer.
// ─────────────────────────────────────────────────────────────────────────────

export interface SlideOverrides {
  /** Reviewer's chosen layout. Renderer falls back to content-shape default if absent or unknown. */
  layoutVariant?: LayoutVariant
  emphasis?: Emphasis
  density?: Density
  tone?: Tone
  /** Reviewer-tightened eyebrow text (<=4 words, all-caps recommended). */
  eyebrow?: string
  /** Reviewer-rewritten title (only when the original is too long/weak). */
  titleText?: string
  /** Tighter bullet rewrites — same count as input, each <=80 chars. */
  bulletRewrites?: string[]
  /** Cap the number of rendered bullets. */
  maxBullets?: number
  /** When the reviewer detects a stat worth heroing, it surfaces it here. */
  promotedStat?: { value: string; caption: string }
}

// ─────────────────────────────────────────────────────────────────────────────
// Content-shape fallback: how the renderer picks a layout WITHOUT an AI override.
// Pure function — also reused by the reviewer prompt to ground its suggestions.
// ─────────────────────────────────────────────────────────────────────────────

const HAS_DIGIT_OR_CURRENCY = /(\d[\d,.]*\s*%|\$\s*\d|[+-]?\d{2,}|\d+\s*x)/i
const STARTS_WITH_QUOTE     = /^[“"'']/
const ENDS_WITH_QUOTE       = /[”"'']$/

export function defaultLayoutFor(slide: SlideData): LayoutVariant {
  if (slide.type === 'title') {
    if (slide.subtitle && HAS_DIGIT_OR_CURRENCY.test(slide.subtitle)) return 'title-stat'
    return 'title-editorial'
  }
  if (slide.type === 'impact')  return 'impact-statement'
  if (slide.type === 'section') return 'section-numeral'
  if (slide.type === 'closing') return 'closing-cta'

  // content slides — pick by bullet shape
  const bullets = slide.bullets ?? []
  if (bullets.length === 1) return 'impact-statement'

  const allStat = bullets.every(b => HAS_DIGIT_OR_CURRENCY.test(b))
  if (bullets.length >= 2 && bullets.length <= 4 && allStat) return 'content-stat-grid'

  const hasQuote = bullets.some(b => STARTS_WITH_QUOTE.test(b) || ENDS_WITH_QUOTE.test(b))
  if (hasQuote) return 'content-quote'

  if (bullets.length === 2) return 'content-two-up'

  return 'content-list'
}

/** Returns the layout to render: reviewer's choice if valid, else content-shape default. */
export function pickLayout(slide: SlideData, override?: SlideOverrides): LayoutVariant {
  const chosen = override?.layoutVariant
  if (chosen && ALL_LAYOUTS.includes(chosen)) return chosen
  return defaultLayoutFor(slide)
}

/** Returns the BgMode + Accent + Padding implied by tone + variant. */
export function toneDefaults(
  variant: LayoutVariant,
  tone: Tone = 'editorial',
): { bg: 'paper' | 'ink' | 'surface'; accent: 'rule' | 'numeral' | 'bar' | 'none'; padding: 'generous' | 'balanced' | 'tight' } {
  // Section dividers and impact statements always use ink background for contrast.
  if (variant === 'section-numeral') return { bg: 'ink', accent: 'numeral', padding: 'generous' }
  if (variant === 'impact-statement') return { bg: 'ink', accent: 'none', padding: 'generous' }
  if (variant === 'closing-cta')      return { bg: 'ink', accent: 'rule', padding: 'generous' }
  if (variant === 'title-editorial')  return { bg: 'paper', accent: 'rule', padding: 'generous' }
  if (variant === 'title-stat')       return { bg: 'paper', accent: 'rule', padding: 'generous' }

  // Content layouts vary by tone
  if (tone === 'minimal')   return { bg: 'paper', accent: 'none', padding: 'balanced' }
  if (tone === 'corporate') return { bg: 'surface', accent: 'bar', padding: 'balanced' }
  return { bg: 'paper', accent: 'rule', padding: 'balanced' }
}
