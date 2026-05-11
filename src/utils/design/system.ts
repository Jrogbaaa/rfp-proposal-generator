/**
 * Slide design system — tokens.
 *
 * Single source of truth for typography, spacing, and color used by all slide
 * layout variants. Replaces the ad-hoc 16/36/56/84/200pt values previously
 * scattered through SlideCanvasRenderer.
 *
 * All sizes are pre-multiplied for a 1920x1080 internal slide canvas (the
 * renderer scales on display). Body type starts at 26px to clear the 24px
 * minimum-readable floor at export size.
 *
 * Hard rules encoded structurally:
 *   - No CSS gradients exposed (gradient stops are not tokenized).
 *   - No body size below 26px in the type scale.
 *   - One sanctioned accent gesture per layout — exported as Accent enum;
 *     layouts must pick exactly one, not stack them.
 *   - Fonts are non-Inter, non-Roboto, non-Arial, non-Fraunces by design.
 */

import type { ColorTheme } from '../../types/proposal'

// ─────────────────────────────────────────────────────────────────────────────
// Slide canvas
// ─────────────────────────────────────────────────────────────────────────────

export const SLIDE_W = 1920
export const SLIDE_H = 1080
export const SLIDE_ASPECT = SLIDE_W / SLIDE_H

// ─────────────────────────────────────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Display: Newsreader — high-contrast serif, editorial feel. Used for titles
 * and impact statements where the headline carries the slide.
 *
 * Sans: Manrope — geometric humanist sans. Wider than Inter, more character.
 * Used for body, eyebrow, captions, numerals.
 *
 * Both loaded from Google Fonts in src/index.css.
 */
export const FONT_DISPLAY = '"Newsreader", "Times New Roman", Georgia, serif'
export const FONT_SANS    = '"Manrope", "Helvetica Neue", system-ui, sans-serif'

/**
 * Modular type scale (ratio ~1.333 / perfect-fourth), tuned for 1920x1080.
 * Each role names its intended use — pick by role, not raw size.
 */
export const Type = {
  display:   { size: 156, weight: 600, line: 1.02, letter: '-0.035em', family: FONT_DISPLAY },
  h1:        { size: 112, weight: 600, line: 1.06, letter: '-0.03em',  family: FONT_DISPLAY },
  h2:        { size: 84,  weight: 600, line: 1.08, letter: '-0.025em', family: FONT_DISPLAY },
  h3:        { size: 64,  weight: 600, line: 1.12, letter: '-0.02em',  family: FONT_DISPLAY },
  h4:        { size: 48,  weight: 600, line: 1.18, letter: '-0.015em', family: FONT_DISPLAY },
  bodyLarge: { size: 36,  weight: 400, line: 1.4,  letter: '0',         family: FONT_SANS },
  body:      { size: 28,  weight: 400, line: 1.5,  letter: '0',         family: FONT_SANS },
  bodySmall: { size: 26,  weight: 400, line: 1.5,  letter: '0',         family: FONT_SANS },
  caption:   { size: 22,  weight: 500, line: 1.4,  letter: '0.01em',    family: FONT_SANS },
  eyebrow:   { size: 22,  weight: 700, line: 1.0,  letter: '0.18em',    family: FONT_SANS, transform: 'uppercase' as const },
  numeralXL: { size: 480, weight: 700, line: 0.9,  letter: '-0.06em',   family: FONT_SANS },
  numeralL:  { size: 240, weight: 700, line: 0.9,  letter: '-0.05em',   family: FONT_SANS },
  numeralM:  { size: 144, weight: 700, line: 0.95, letter: '-0.04em',   family: FONT_SANS },
} as const

export type TypeRole = keyof typeof Type

/**
 * Render a Type role to a React.CSSProperties subset.
 */
export function typeStyle(role: TypeRole): React.CSSProperties {
  const t = Type[role]
  return {
    fontFamily: t.family,
    fontSize: t.size,
    fontWeight: t.weight,
    lineHeight: t.line,
    letterSpacing: t.letter,
    ...('transform' in t ? { textTransform: t.transform } : {}),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Spacing — 4-based scale. Use names, not raw numbers.
// ─────────────────────────────────────────────────────────────────────────────

export const Space = {
  px:   1,
  xs:   8,
  s:    16,
  m:    24,
  l:    32,
  xl:   48,
  xxl:  72,
  xxxl: 112,
  huge: 160,
} as const

/** Slide-edge padding presets — pick by density, not by guess. */
export const Pad = {
  generous: { top: 120, right: 144, bottom: 120, left: 144 },
  balanced: { top: 96,  right: 120, bottom: 96,  left: 120 },
  tight:    { top: 72,  right: 96,  bottom: 72,  left: 96  },
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Color tokens — per theme, NO gradient stops, NO chrome.
// Layouts compose with these only.
// ─────────────────────────────────────────────────────────────────────────────

export interface ThemeColors {
  /** Strong foreground for dark slides; text color on light. */
  ink: string
  /** Light slide background; text color on dark. */
  paper: string
  /** Single accent — used once per slide, never as a gradient or chrome. */
  accent: string
  /** Mid-weight body text on light backgrounds. */
  mute: string
  /** A second neutral surface (slightly off paper) for two-up backgrounds. */
  surface: string
  /** Optional secondary accent (rarely used; reserved for stat-grid contrast). */
  accentMute: string
}

export const Theme: Record<ColorTheme, ThemeColors> = {
  'navy-gold': {
    ink:        '#0F1929',
    paper:      '#F7F4EE',
    accent:     '#C9A84C',
    mute:       '#4A5570',
    surface:    '#EFEAE0',
    accentMute: '#8C7635',
  },
  'slate-blue': {
    ink:        '#1A2540',
    paper:      '#F4F6FA',
    accent:     '#4A90D9',
    mute:       '#4D5A78',
    surface:    '#E8ECF3',
    accentMute: '#345E8C',
  },
  'forest-green': {
    ink:        '#0F2018',
    paper:      '#F3F7F4',
    accent:     '#5CB85C',
    mute:       '#3F5848',
    surface:    '#E6EEE8',
    accentMute: '#3F7A3F',
  },
  'executive-dark': {
    ink:        '#0D0D0D',
    paper:      '#F5F2EE',
    accent:     '#C0A882',
    mute:       '#5A5A5A',
    surface:    '#E8E4DE',
    accentMute: '#7A6B52',
  },
  'paramount': {
    ink:        '#001A4D',
    paper:      '#F4F6FC',
    accent:     '#F5C518',
    mute:       '#3B4A77',
    surface:    '#E6EAF5',
    accentMute: '#9C7D0F',
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Accent vocabulary — one per slide, no stacking.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The single decorative gesture a layout may use. NEVER stack two.
 *   - rule:    a thin horizontal accent rule, used under or beside title
 *   - numeral: a faint giant numeral watermark (section dividers only)
 *   - bar:     a thin vertical accent bar on the left edge of a content block
 *   - none:    no decoration; let typography and whitespace carry the slide
 */
export type Accent = 'rule' | 'numeral' | 'bar' | 'none'

/** A single accent rule, sized consistently. */
export const RULE = {
  thickness: 4,
  short:  64,
  medium: 120,
  long:   240,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Background mode — slides choose one. No gradients ever.
// ─────────────────────────────────────────────────────────────────────────────

export type BgMode = 'paper' | 'ink' | 'surface'

export function bgColor(theme: ThemeColors, mode: BgMode): string {
  if (mode === 'ink') return theme.ink
  if (mode === 'surface') return theme.surface
  return theme.paper
}

/** Foreground (text) color appropriate for a given background mode. */
export function fgColor(theme: ThemeColors, mode: BgMode): string {
  return mode === 'ink' ? theme.paper : theme.ink
}

/** A muted secondary text color for a given background mode. */
export function muteColor(theme: ThemeColors, mode: BgMode): string {
  if (mode === 'ink') return 'rgba(255,255,255,0.6)'
  return theme.mute
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolution: turn a ColorTheme name into a usable palette.
// ─────────────────────────────────────────────────────────────────────────────

export function resolveTheme(name: ColorTheme | undefined): ThemeColors {
  return Theme[name ?? 'navy-gold'] ?? Theme['navy-gold']
}
