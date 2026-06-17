/**
 * pptxVariants.ts — PptxGenJS renderers mirroring the 10 React slide variants.
 *
 * Same design tokens (design/system.ts), same layout dispatch (pickLayout /
 * toneDefaults), same content helpers (effectiveTitle / effectiveBullets).
 *
 * Unit conversions — canvas is 1920×1080px, slide is LAYOUT_WIDE 13.33×7.5in:
 *   inches = px / 144      pt = px × 0.5
 */
import pptxgen from 'pptxgenjs'
import type { SlideData } from '../../data/slideContent'
import type { DesignConfig } from '../../types/proposal'
import {
  resolveTheme,
  bgColor,
  Type,
  Pad,
  RULE,
  Space,
} from './system'
import type { ThemeColors } from './system'
import { pickLayout, toneDefaults } from './vocabulary'
import type { SlideOverrides } from './vocabulary'
import {
  effectiveTitle,
  effectiveEyebrow,
  effectiveBullets,
  extractStat,
} from '../../components/slides/types'

// ─── Unit conversion ─────────────────────────────────────────────────────────
// Canvas 1920×1080px → LAYOUT_WIDE 13.33×7.5in.  Ratio = 1/144 for both axes.
const p   = (px: number): number => +(px / 144).toFixed(4)
const pt  = (px: number): number => Math.max(6, Math.round(px * 0.5))
const hex = (color: string): string => color.replace('#', '')

const SLIDE_W = 13.33
const SLIDE_H = 7.5

// Content zones in inches, derived from Pad constants
const GP = {
  l: p(Pad.generous.left),
  t: p(Pad.generous.top),
  w: p(1920 - Pad.generous.left - Pad.generous.right),
}
const BP = {
  l: p(Pad.balanced.left),
  t: p(Pad.balanced.top),
  w: p(1920 - Pad.balanced.left - Pad.balanced.right),
}

// ─── Text + shape helpers ─────────────────────────────────────────────────────

function tf(
  role: keyof typeof Type,
  color: string,
  extra?: Record<string, unknown>,
) {
  const t = Type[role]
  const face = t.family.split(',')[0].replace(/['"]/g, '').trim()
  return {
    fontFace: face,
    fontSize: pt(t.size),
    bold: t.weight >= 600,
    color: hex(color),
    align: 'left' as const,
    valign: 'top' as const,
    wrap: true,
    ...extra,
  }
}

function addRect(
  slide: pptxgen.Slide,
  x: number, y: number, w: number, h: number,
  color: string,
) {
  slide.addShape('rect', {
    x, y, w, h,
    fill: { color: hex(color) },
    line: { width: 0 } as never,
  })
}

function bgRect(slide: pptxgen.Slide, color: string) {
  addRect(slide, 0, 0, SLIDE_W, SLIDE_H, color)
}

// ─── Variant renderers ────────────────────────────────────────────────────────

function renderTitleEditorial(
  slide: pptxgen.Slide, data: SlideData, o: SlideOverrides | undefined, theme: ThemeColors,
) {
  const title   = effectiveTitle(data, o)
  const eyebrow = effectiveEyebrow(data, o)

  const ruleY  = eyebrow ? p(350) : p(390)
  const ewY    = p(420)
  const titleY = eyebrow ? p(475) : p(445)

  addRect(slide, GP.l, ruleY, p(RULE.medium), p(RULE.thickness), theme.accent)

  if (eyebrow) {
    slide.addText(eyebrow.toUpperCase(), {
      x: GP.l, y: ewY, w: GP.w, h: p(44),
      ...tf('eyebrow', theme.mute),
    })
  }

  slide.addText(title, {
    x: GP.l, y: titleY, w: p(1500), h: p(360),
    ...tf('h1', theme.ink),
  })

  // Footer attribution
  addRect(slide, GP.l, p(960), p(RULE.short), p(2), theme.accent)
  slide.addText('Paramount Advertising', {
    x: GP.l + p(RULE.short + 24), y: p(950), w: p(700), h: p(44),
    ...tf('caption', theme.mute),
    fontSize: pt(Type.caption.size - 2),
  })
}

function renderTitleStat(
  slide: pptxgen.Slide, data: SlideData, o: SlideOverrides | undefined, theme: ThemeColors,
) {
  const title    = effectiveTitle(data, o)
  const eyebrow  = effectiveEyebrow(data, o)
  const promoted = o?.promotedStat
  const stat     = promoted?.value || (data.subtitle && extractStat(data.subtitle)) || ''
  const caption  = promoted?.caption || title

  if (eyebrow) {
    slide.addText(eyebrow.toUpperCase(), {
      x: GP.l, y: p(340), w: GP.w, h: p(44),
      ...tf('eyebrow', theme.accent),
    })
  }

  slide.addText(stat || title, {
    x: GP.l, y: p(390), w: GP.w, h: p(340),
    ...tf('numeralXL', theme.ink),
  })

  if (stat) {
    slide.addText(caption, {
      x: GP.l, y: p(750), w: p(1200), h: p(120),
      ...tf('h4', theme.ink, { bold: false }),
    })
  }

  addRect(slide, GP.l, p(910), p(RULE.medium), p(RULE.thickness), theme.accent)
}

function renderSectionNumeral(
  slide: pptxgen.Slide, data: SlideData, o: SlideOverrides | undefined, theme: ThemeColors,
) {
  const title   = effectiveTitle(data, o)
  const eyebrow = effectiveEyebrow(data, o)
  const numeral = String(data.slideNumber ?? 1).padStart(2, '0')

  // Faint giant numeral watermark
  slide.addText(numeral, {
    x: p(1500), y: p(-40), w: p(500), h: p(500),
    ...tf('numeralXL', '#FFFFFF', { bold: true }),
    transparency: 94,
  })

  if (eyebrow) {
    slide.addText(eyebrow.toUpperCase(), {
      x: GP.l, y: p(730), w: GP.w, h: p(44),
      ...tf('eyebrow', theme.accent),
    })
  }

  slide.addText(title, {
    x: GP.l, y: eyebrow ? p(790) : p(750), w: p(1400), h: p(210),
    ...tf('h2', theme.paper),
  })

  slide.addText(`Section ${numeral}`, {
    x: GP.l, y: p(1010), w: GP.w, h: p(44),
    ...tf('caption', '#FFFFFF', { transparency: 40 }),
  })
}

function renderContentList(
  slide: pptxgen.Slide, data: SlideData, o: SlideOverrides | undefined, theme: ThemeColors,
) {
  const title   = effectiveTitle(data, o)
  const eyebrow = effectiveEyebrow(data, o)
  const bullets = effectiveBullets(data, o)
  const density = o?.density ?? 'balanced'
  const bodyRole = density === 'sparse' ? 'bodyLarge' : 'body'

  let yPos = BP.t

  if (eyebrow) {
    slide.addText(eyebrow.toUpperCase(), { x: BP.l, y: yPos, w: BP.w, h: p(44), ...tf('eyebrow', theme.accent) })
    yPos += p(44 + Space.m)
  }

  const titleH = p(130)
  slide.addText(title, { x: BP.l, y: yPos, w: BP.w, h: titleH, ...tf('h2', theme.ink) })
  yPos += titleH + p(Space.l)

  addRect(slide, BP.l, yPos, p(RULE.medium), p(RULE.thickness), theme.accent)
  yPos += p(RULE.thickness + Space.xl)

  const maxB   = Math.min(bullets.length, 6)
  const avail  = SLIDE_H - yPos - p(80)
  const bulletH = Math.min(p(80), avail / Math.max(maxB, 1))
  const numW   = p(60)

  bullets.slice(0, maxB).forEach((b, i) => {
    const y = yPos + i * bulletH
    slide.addText(String(i + 1).padStart(2, '0'), {
      x: BP.l, y, w: numW, h: bulletH,
      ...tf('caption', theme.accent, { bold: true }),
    })
    slide.addText(b, {
      x: BP.l + numW + p(Space.m), y, w: BP.w - numW - p(Space.m), h: bulletH,
      ...tf(bodyRole, theme.ink),
    })
  })
}

function renderContentTwoUp(
  slide: pptxgen.Slide, data: SlideData, o: SlideOverrides | undefined, theme: ThemeColors,
) {
  const title   = effectiveTitle(data, o)
  const eyebrow = effectiveEyebrow(data, o)
  const [a, b]  = effectiveBullets(data, o).slice(0, 2)

  let yPos = BP.t

  if (eyebrow) {
    slide.addText(eyebrow.toUpperCase(), { x: BP.l, y: yPos, w: BP.w, h: p(44), ...tf('eyebrow', theme.accent) })
    yPos += p(44 + Space.m)
  }

  slide.addText(title, { x: BP.l, y: yPos, w: BP.w, h: p(120), ...tf('h3', theme.ink) })
  yPos += p(120 + Space.xl)

  const dividerX = BP.l + (BP.w - p(2)) / 2
  const colW     = dividerX - BP.l - p(Space.xxl)

  slide.addText('01', { x: BP.l, y: yPos, w: colW, h: p(44), ...tf('eyebrow', theme.mute) })
  slide.addText(a ?? '', {
    x: BP.l, y: yPos + p(44 + Space.s), w: colW, h: p(340),
    ...tf('bodyLarge', theme.ink),
  })

  // Vertical divider
  addRect(slide, dividerX, yPos + p(44), p(2), p(200), theme.accent)

  const rx = dividerX + p(2) + p(Space.xxl)
  slide.addText('02', { x: rx, y: yPos, w: colW, h: p(44), ...tf('eyebrow', theme.mute) })
  slide.addText(b ?? '', {
    x: rx, y: yPos + p(44 + Space.s), w: colW, h: p(340),
    ...tf('bodyLarge', theme.ink),
  })

  addRect(slide, BP.l, p(940), p(RULE.short), p(RULE.thickness), theme.accent)
}

function renderContentQuote(
  slide: pptxgen.Slide, data: SlideData, o: SlideOverrides | undefined, theme: ThemeColors,
) {
  const title   = effectiveTitle(data, o)
  const bullets = effectiveBullets(data, o)
  const raw     = bullets.find(b => /^[""'']/.test(b) || /[""'']$/.test(b)) ?? bullets[0] ?? ''
  const stripped = raw.replace(/^[""'']\s*/, '').replace(/\s*[""'']$/, '')

  // Oversized opening quote glyph
  slide.addText('“', {
    x: GP.l, y: p(100), w: p(300), h: p(240),
    ...tf('numeralL', theme.accent, { bold: true }),
  })

  slide.addText(stripped, {
    x: GP.l, y: p(300), w: p(1500), h: p(420),
    ...tf('h2', theme.ink, { bold: false, italic: true }),
  })

  addRect(slide, GP.l, p(760), p(56), p(2), theme.accent)
  slide.addText(title, {
    x: GP.l + p(56 + Space.m), y: p(750), w: p(800), h: p(44),
    ...tf('caption', theme.mute),
  })
}

function renderContentStatGrid(
  slide: pptxgen.Slide, data: SlideData, o: SlideOverrides | undefined, theme: ThemeColors,
) {
  const title   = effectiveTitle(data, o)
  const eyebrow = effectiveEyebrow(data, o)
  const bullets = effectiveBullets(data, o).slice(0, 4)

  const tiles = bullets
    .map(b => {
      const stat = extractStat(b)
      if (!stat) return null
      const idx = b.indexOf(stat)
      const caption = (idx < 0 ? b : b.slice(0, idx) + b.slice(idx + stat.length))
        .replace(/\s{2,}/g, ' ').trim()
        .replace(/^[—–\-:,]\s*/, '').replace(/\s*[—–\-:,]$/, '').trim()
      return { stat, caption }
    })
    .filter((t): t is { stat: string; caption: string } => t !== null)

  if (tiles.length < 2) {
    return renderContentList(slide, data, o, theme)
  }

  let yPos = BP.t

  if (eyebrow) {
    slide.addText(eyebrow.toUpperCase(), { x: BP.l, y: yPos, w: BP.w, h: p(44), ...tf('eyebrow', theme.accent) })
    yPos += p(44 + Space.m)
  }

  slide.addText(title, { x: BP.l, y: yPos, w: BP.w, h: p(100), ...tf('h3', theme.ink) })
  yPos += p(100 + Space.xl)

  const cols     = tiles.length <= 2 ? 2 : tiles.length === 3 ? 3 : 2
  const gap      = p(Space.xxl)
  const colW     = (BP.w - gap * (cols - 1)) / cols
  const numRole: keyof typeof Type = tiles.length <= 2 ? 'numeralL' : 'numeralM'

  tiles.forEach((t, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x   = BP.l + col * (colW + gap)
    const y   = yPos + row * p(380)

    slide.addText(t.stat, { x, y, w: colW, h: p(260), ...tf(numRole, theme.ink) })
    addRect(slide, x, y + p(260), p(RULE.short), p(2), theme.accent)
    if (t.caption) {
      slide.addText(t.caption, {
        x, y: y + p(280), w: colW, h: p(120),
        ...tf('body', theme.mute),
      })
    }
  })
}

function renderContentTimeline(
  slide: pptxgen.Slide, data: SlideData, o: SlideOverrides | undefined, theme: ThemeColors,
) {
  const title   = effectiveTitle(data, o)
  const eyebrow = effectiveEyebrow(data, o)
  const steps   = effectiveBullets(data, o).slice(0, 5)

  let yPos = BP.t

  if (eyebrow) {
    slide.addText(eyebrow.toUpperCase(), { x: BP.l, y: yPos, w: BP.w, h: p(44), ...tf('eyebrow', theme.accent) })
    yPos += p(44 + Space.m)
  }

  slide.addText(title, { x: BP.l, y: yPos, w: BP.w, h: p(100), ...tf('h3', theme.ink) })
  yPos += p(100 + Space.xl + 40)

  const circleD = p(72)
  const gap     = p(Space.xl)
  const colW    = (BP.w - gap * (steps.length - 1)) / steps.length

  // Connecting line through circle midpoints
  addRect(slide, BP.l, yPos + circleD / 2 - p(1), BP.w, p(2), theme.accent)

  steps.forEach((s, i) => {
    const x = BP.l + i * (colW + gap)

    slide.addShape('ellipse', {
      x, y: yPos, w: circleD, h: circleD,
      fill: { color: hex(theme.ink) },
    })
    slide.addText(String(i + 1).padStart(2, '0'), {
      x, y: yPos, w: circleD, h: circleD,
      ...tf('caption', theme.paper, { bold: true, align: 'center', valign: 'middle' }),
    })
    slide.addText(s, {
      x, y: yPos + circleD + p(Space.l), w: colW, h: p(280),
      ...tf('body', theme.ink),
    })
  })
}

function renderImpactStatement(
  slide: pptxgen.Slide, data: SlideData, o: SlideOverrides | undefined, theme: ThemeColors,
) {
  const title      = effectiveTitle(data, o)
  const eyebrow    = effectiveEyebrow(data, o) || 'Key insight'
  const bullets    = effectiveBullets(data, o)
  const supporting = bullets[0] && bullets[0] !== title ? bullets[0] : undefined

  slide.addText(eyebrow.toUpperCase(), {
    x: GP.l, y: p(340), w: GP.w, h: p(44),
    ...tf('eyebrow', theme.accent),
  })

  slide.addText(title, {
    x: GP.l, y: p(405), w: p(1500), h: p(380),
    ...tf('h1', theme.paper),
  })

  if (supporting) {
    slide.addText(supporting, {
      x: GP.l, y: p(830), w: p(1200), h: p(120),
      ...tf('bodyLarge', '#FFFFFF', { transparency: 40 }),
    })
  }
}

function renderClosingCta(
  slide: pptxgen.Slide, data: SlideData, o: SlideOverrides | undefined, theme: ThemeColors,
) {
  const title   = effectiveTitle(data, o)
  const bullets = effectiveBullets(data, o).slice(0, 3)
  const company = data.subtitle?.trim()

  slide.addText('Next Steps', {
    x: GP.l, y: p(290), w: GP.w, h: p(44),
    ...tf('eyebrow', theme.accent),
  })

  slide.addText(title, {
    x: GP.l, y: p(355), w: p(1500), h: p(300),
    ...tf('h1', theme.paper),
  })

  addRect(slide, GP.l, p(690), p(RULE.medium), p(RULE.thickness), theme.accent)

  if (bullets.length > 0) {
    const bulletH = p(68)
    bullets.forEach((b, i) => {
      slide.addText(b, {
        x: GP.l, y: p(730) + i * bulletH, w: p(1400), h: bulletH,
        ...tf('bodyLarge', '#FFFFFF', { transparency: 40 }),
      })
    })
  }

  if (company) {
    slide.addText(company, {
      x: GP.l, y: p(960), w: GP.w, h: p(44),
      ...tf('caption', theme.accent),
    })
  }
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function renderOneSlide(
  prs: pptxgen,
  data: SlideData,
  override: SlideOverrides | undefined,
  theme: ThemeColors,
): void {
  const variant = pickLayout(data, override)
  const tone    = override?.tone ?? 'editorial'
  const { bg }  = toneDefaults(variant, tone)

  const slide = prs.addSlide()
  bgRect(slide, bgColor(theme, bg))

  switch (variant) {
    case 'title-editorial':   renderTitleEditorial(slide, data, override, theme); break
    case 'title-stat':        renderTitleStat(slide, data, override, theme); break
    case 'section-numeral':   renderSectionNumeral(slide, data, override, theme); break
    case 'content-list':      renderContentList(slide, data, override, theme); break
    case 'content-two-up':    renderContentTwoUp(slide, data, override, theme); break
    case 'content-quote':     renderContentQuote(slide, data, override, theme); break
    case 'content-stat-grid': renderContentStatGrid(slide, data, override, theme); break
    case 'content-timeline':  renderContentTimeline(slide, data, override, theme); break
    case 'impact-statement':  renderImpactStatement(slide, data, override, theme); break
    case 'closing-cta':       renderClosingCta(slide, data, override, theme); break
    default:                  renderContentList(slide, data, override, theme)
  }
}

/** Render a full deck from the unified SlideData[] + SlideOverrides[] into prs. */
export function buildDeckFromSlides(
  prs: pptxgen,
  slides: SlideData[],
  overrides: SlideOverrides[],
  designConfig: DesignConfig,
): void {
  const theme = resolveTheme(designConfig.colorTheme)
  slides.forEach((slide, i) => renderOneSlide(prs, slide, overrides[i], theme))
}
