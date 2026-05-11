/**
 * pptxExport.ts
 *
 * Generates a polished .pptx file using PptxGenJS, then uploads it to Google
 * Drive with mimeType conversion so it opens as a native Google Slides file.
 *
 * Design system:
 *   - Cover:         full-bleed primary brand colour, large white title
 *   - Section break: full-bleed dark, centred white title (no bullets)
 *   - Dark impact:   dark background, accent-coloured bullet markers
 *   - Quote/reframe: full-bleed primary, large centred italic quote
 *   - Proof grid:    white bg, stat cards with accent borders
 *   - Content:       white bg, accent left bar, titled bullet list
 *   - Three steps:   white bg, 3 numbered accent circles with text blocks
 *   - Tier cards:    white bg, 3 side-by-side investment tier boxes
 *   - Closing:       full-bleed primary, single centred CTA line
 */

import pptxgen from 'pptxgenjs'
import type {
  ProposalData,
  DesignConfig,
  ExpandedContent,
  ProofPoint,
  InvestmentTier,
  CustomClientPlan,
  FlexibleSlide,
} from '../types/proposal'
import type { SlidePalette } from './brandColors'
import { getBrandPalette, derivePaletteFromHex } from './brandColors'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExportResult {
  presentationUrl: string
  presentationId: string
  title: string
}

interface Palette {
  primary: string   // hex without # (pptxgenjs format)
  accent: string
  dark: string
  text: string
}

// ─── Palette helpers ─────────────────────────────────────────────────────────

type RgbColor = { red: number; green: number; blue: number }

function rgbToHex(c: RgbColor): string {
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return (to(c.red) + to(c.green) + to(c.blue)).toUpperCase()
}

function slidePaletteToPptx(sp: SlidePalette): Palette {
  return {
    primary: rgbToHex(sp.primary),
    accent:  rgbToHex(sp.accent),
    dark:    rgbToHex(sp.primaryDarker),
    text:    '1A1A2E',
  }
}

const THEME_PALETTES: Record<string, Palette> = {
  'navy-gold':      { primary: '003087', accent: 'F5C518', dark: '0A0F1A', text: '1A1A2E' },
  'slate-blue':     { primary: '1E3A5F', accent: '4DA6FF', dark: '0D1B2A', text: '1A2A3A' },
  'forest-green':   { primary: '1B4332', accent: '52B788', dark: '081C15', text: '1B3A2B' },
  'executive-dark': { primary: '1A1A2E', accent: 'B8A88A', dark: '0F0F1A', text: '2D2D44' },
  'paramount':      { primary: '003087', accent: 'F5C518', dark: '0A0F1A', text: '1A1A2E' },
}

function buildPptxPalette(company: string, designConfig: DesignConfig): Palette {
  if (designConfig.customBrandHex) {
    return slidePaletteToPptx(derivePaletteFromHex(designConfig.customBrandHex))
  }
  const brand = getBrandPalette(company)
  if (brand) return slidePaletteToPptx(brand)
  return THEME_PALETTES[designConfig.colorTheme] ?? THEME_PALETTES['navy-gold']
}

// ─── Shared constants ────────────────────────────────────────────────────────

const FONT     = 'Calibri'
const FOOTER_H = 0.28    // inches
const SLIDE_W  = 13.33   // LAYOUT_WIDE
const SLIDE_H  = 7.5
const FOOTER_Y = SLIDE_H - FOOTER_H

function addFooter(slide: pptxgen.Slide, text: string, palette: Palette) {
  slide.addShape('rect', { x: 0, y: FOOTER_Y, w: SLIDE_W, h: FOOTER_H, fill: { color: palette.primary } })
  slide.addText(text, {
    x: 0.4, y: FOOTER_Y, w: SLIDE_W - 0.8, h: FOOTER_H,
    fontSize: 7, fontFace: FONT, color: 'FFFFFF', align: 'center', valign: 'middle',
  })
}

// ─── Slide renderers ─────────────────────────────────────────────────────────

function renderCover(pptx: pptxgen, title: string, subtitle: string, palette: Palette, footer: string) {
  const slide = pptx.addSlide()
  slide.addShape('rect', { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, fill: { color: palette.primary } })
  slide.addShape('rect', { x: 0, y: SLIDE_H * 0.72, w: SLIDE_W, h: 0.06, fill: { color: palette.accent } })
  slide.addText(title, {
    x: 1, y: 1.8, w: SLIDE_W - 2, h: 2.4,
    fontFace: FONT, fontSize: 48, bold: true, color: 'FFFFFF',
    align: 'center', valign: 'middle', wrap: true,
  })
  if (subtitle) {
    slide.addText(subtitle, {
      x: 1, y: 4.4, w: SLIDE_W - 2, h: 0.8,
      fontFace: FONT, fontSize: 20, color: 'FFFFFF',
      align: 'center', valign: 'middle', transparency: 20,
    })
  }
  addFooter(slide, footer, palette)
}

function renderSectionDivider(pptx: pptxgen, title: string, palette: Palette, footer: string) {
  const slide = pptx.addSlide()
  slide.addShape('rect', { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, fill: { color: palette.dark } })
  slide.addShape('rect', { x: 0, y: SLIDE_H * 0.45, w: 0.08, h: 1.8, fill: { color: palette.accent } })
  slide.addText(title, {
    x: 0.5, y: 2.4, w: SLIDE_W - 1, h: 2,
    fontFace: FONT, fontSize: 40, bold: true, color: 'FFFFFF',
    align: 'center', valign: 'middle', wrap: true,
  })
  addFooter(slide, footer, palette)
}

function renderDarkImpact(
  pptx: pptxgen,
  title: string,
  bullets: string[],
  palette: Palette,
  footer: string,
  accentOverride?: string,
) {
  const slide = pptx.addSlide()
  const bullet_accent = accentOverride || palette.accent
  slide.addShape('rect', { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, fill: { color: palette.dark } })
  slide.addShape('rect', { x: 0, y: 0, w: SLIDE_W, h: 0.06, fill: { color: bullet_accent } })
  slide.addText(title, {
    x: 0.7, y: 0.5, w: SLIDE_W - 1.4, h: 1.1,
    fontFace: FONT, fontSize: 30, bold: true, color: 'FFFFFF',
    align: 'left', valign: 'middle', wrap: true,
  })
  const bulletY = 1.9
  const bulletSpacing = (FOOTER_Y - 0.3 - bulletY) / Math.max(bullets.length, 1)
  bullets.forEach((text, i) => {
    slide.addShape('ellipse', {
      x: 0.5, y: bulletY + i * bulletSpacing + 0.1, w: 0.2, h: 0.2,
      fill: { color: bullet_accent },
    })
    slide.addText(text, {
      x: 0.85, y: bulletY + i * bulletSpacing, w: SLIDE_W - 1.5, h: bulletSpacing - 0.05,
      fontFace: FONT, fontSize: 17, color: 'FFFFFF', align: 'left', valign: 'top', wrap: true,
    })
  })
  addFooter(slide, footer, palette)
}

function renderQuote(pptx: pptxgen, quote: string, label: string, palette: Palette, footer: string) {
  const slide = pptx.addSlide()
  slide.addShape('rect', { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, fill: { color: palette.primary } })
  slide.addText('"', {
    x: 0.3, y: -0.3, w: 3, h: 3,
    fontFace: FONT, fontSize: 180, bold: true, color: palette.accent,
    align: 'left', transparency: 60,
  })
  slide.addText(quote, {
    x: 1, y: 1.8, w: SLIDE_W - 2, h: 3,
    fontFace: FONT, fontSize: 28, bold: true, italic: true, color: 'FFFFFF',
    align: 'center', valign: 'middle', wrap: true,
  })
  if (label) {
    slide.addText(label, {
      x: 1, y: 5.2, w: SLIDE_W - 2, h: 0.5,
      fontFace: FONT, fontSize: 14, color: 'FFFFFF',
      align: 'center', transparency: 25,
    })
  }
  addFooter(slide, footer, palette)
}

function renderProofGrid(pptx: pptxgen, title: string, proofPoints: ProofPoint[], palette: Palette, footer: string) {
  const slide = pptx.addSlide()
  slide.addShape('rect', { x: 0, y: 0, w: SLIDE_W, h: 1.1, fill: { color: palette.primary } })
  slide.addText(title, {
    x: 0.5, y: 0, w: SLIDE_W - 1, h: 1.1,
    fontFace: FONT, fontSize: 24, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle',
  })
  const pts = proofPoints.slice(0, 6)
  const cols = pts.length <= 3 ? pts.length : 3
  const rows = Math.ceil(pts.length / cols)
  const cardW = (SLIDE_W - 1) / cols
  const contentH = FOOTER_Y - 1.3
  const cardH = contentH / rows - 0.15
  pts.forEach((pt, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = 0.4 + col * cardW
    const y = 1.25 + row * (cardH + 0.15)
    slide.addShape('rect', {
      x, y, w: cardW - 0.2, h: cardH,
      fill: { color: 'F7F8FC' },
      line: { color: palette.primary, width: 1.5 },
    })
    slide.addText(pt.stat, {
      x: x + 0.15, y: y + 0.12, w: cardW - 0.5, h: cardH * 0.5,
      fontFace: FONT, fontSize: rows === 1 ? 28 : 22, bold: true,
      color: palette.primary, align: 'center', valign: 'middle', wrap: true,
    })
    slide.addText(pt.source, {
      x: x + 0.15, y: y + cardH * 0.55, w: cardW - 0.5, h: cardH * 0.25,
      fontFace: FONT, fontSize: 10, color: '888888', align: 'center', valign: 'top', wrap: true,
    })
    if (pt.context && rows === 1) {
      slide.addText(pt.context, {
        x: x + 0.15, y: y + cardH * 0.76, w: cardW - 0.5, h: cardH * 0.2,
        fontFace: FONT, fontSize: 9, color: 'AAAAAA', align: 'center', valign: 'top', wrap: true,
      })
    }
  })
  addFooter(slide, footer, palette)
}

function renderContent(
  pptx: pptxgen,
  title: string,
  bullets: string[],
  palette: Palette,
  footer: string,
  bodyText?: string,
) {
  const slide = pptx.addSlide()
  slide.addShape('rect', { x: 0, y: 0, w: 0.12, h: FOOTER_Y, fill: { color: palette.primary } })
  slide.addText(title, {
    x: 0.4, y: 0.35, w: SLIDE_W - 0.9, h: 1,
    fontFace: FONT, fontSize: 28, bold: true, color: palette.primary,
    align: 'left', valign: 'middle', wrap: true,
  })
  slide.addShape('line', {
    x: 0.4, y: 1.45, w: SLIDE_W - 0.9, h: 0,
    line: { color: palette.accent, width: 1.5 },
  })
  if (bodyText) {
    slide.addText(bodyText, {
      x: 0.5, y: 1.65, w: SLIDE_W - 1, h: 1.2,
      fontFace: FONT, fontSize: 15, italic: true, color: palette.text,
      align: 'left', valign: 'top', wrap: true,
    })
  }
  const bulletsY = bodyText ? 3.0 : 1.7
  const bulletsH = FOOTER_Y - 0.2 - bulletsY
  const itemH = bulletsH / Math.max(bullets.length, 1)
  bullets.forEach((text, i) => {
    slide.addShape('rect', {
      x: 0.5, y: bulletsY + i * itemH + 0.14, w: 0.08, h: 0.08,
      fill: { color: palette.accent },
    })
    slide.addText(text, {
      x: 0.75, y: bulletsY + i * itemH, w: SLIDE_W - 1.2, h: itemH - 0.05,
      fontFace: FONT, fontSize: 16, color: palette.text,
      align: 'left', valign: 'top', wrap: true,
    })
  })
  addFooter(slide, footer, palette)
}

function renderThreeSteps(pptx: pptxgen, title: string, steps: string[], palette: Palette, footer: string) {
  const slide = pptx.addSlide()
  slide.addShape('rect', { x: 0, y: 0, w: SLIDE_W, h: 1.1, fill: { color: palette.primary } })
  slide.addText(title, {
    x: 0.5, y: 0, w: SLIDE_W - 1, h: 1.1,
    fontFace: FONT, fontSize: 24, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle',
  })
  const colW = (SLIDE_W - 1.2) / 3
  steps.slice(0, 3).forEach((text, i) => {
    const x = 0.4 + i * (colW + 0.2)
    const circleY = 1.4
    slide.addShape('ellipse', {
      x: x + colW / 2 - 0.4, y: circleY, w: 0.8, h: 0.8,
      fill: { color: palette.primary },
    })
    slide.addText(String(i + 1), {
      x: x + colW / 2 - 0.4, y: circleY, w: 0.8, h: 0.8,
      fontFace: FONT, fontSize: 24, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle',
    })
    if (i < 2) {
      slide.addShape('rect', {
        x: x + colW - 0.05, y: circleY + 0.35, w: 0.3, h: 0.08,
        fill: { color: palette.accent },
      })
    }
    const cardY = circleY + 1.05
    const cardH = FOOTER_Y - 0.2 - cardY
    slide.addShape('rect', {
      x, y: cardY, w: colW, h: cardH,
      fill: { color: 'F7F8FC' },
      line: { color: palette.primary, width: 1 },
    })
    slide.addText(text, {
      x: x + 0.15, y: cardY + 0.1, w: colW - 0.3, h: cardH - 0.2,
      fontFace: FONT, fontSize: 15, color: palette.text, align: 'left', valign: 'top', wrap: true,
    })
  })
  addFooter(slide, footer, palette)
}

function renderTierCards(pptx: pptxgen, title: string, tiers: InvestmentTier[], palette: Palette, footer: string) {
  const slide = pptx.addSlide()
  slide.addShape('rect', { x: 0, y: 0, w: SLIDE_W, h: 1.1, fill: { color: palette.primary } })
  slide.addText(title, {
    x: 0.5, y: 0, w: SLIDE_W - 1, h: 1.1,
    fontFace: FONT, fontSize: 24, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle',
  })
  const colW = (SLIDE_W - 1.2) / 3
  const cardH = FOOTER_Y - 1.4
  tiers.slice(0, 3).forEach((tier, i) => {
    const x = 0.4 + i * (colW + 0.2)
    const isMiddle = i === 1
    slide.addShape('rect', {
      x, y: 1.25, w: colW, h: cardH,
      fill: { color: isMiddle ? palette.primary : 'FFFFFF' },
      line: isMiddle ? undefined : { color: palette.primary, width: 1.5 },
    })
    slide.addText(tier.tierName, {
      x: x + 0.1, y: 1.4, w: colW - 0.2, h: 0.55,
      fontFace: FONT, fontSize: 20, bold: true,
      color: isMiddle ? 'FFFFFF' : palette.primary,
      align: 'center', valign: 'middle',
    })
    slide.addText(tier.budget, {
      x: x + 0.1, y: 2.0, w: colW - 0.2, h: 0.5,
      fontFace: FONT, fontSize: 16, bold: true,
      color: isMiddle ? palette.accent : palette.text,
      align: 'center', valign: 'middle',
    })
    slide.addShape('line', {
      x: x + 0.2, y: 2.55, w: colW - 0.4, h: 0,
      line: { color: isMiddle ? '4466AA' : 'DDDDDD', width: 1 },
    })
    const inclusions = tier.inclusions.slice(0, 5)
    const incH = (cardH - 1.5) / Math.max(inclusions.length, 1)
    inclusions.forEach((inc, j) => {
      slide.addText(`• ${inc}`, {
        x: x + 0.15, y: 2.7 + j * incH, w: colW - 0.3, h: incH - 0.02,
        fontFace: FONT, fontSize: 12,
        color: isMiddle ? 'FFFFFF' : palette.text,
        align: 'left', valign: 'top', wrap: true,
      })
    })
  })
  addFooter(slide, footer, palette)
}

function renderCustomPlan(pptx: pptxgen, title: string, plan: CustomClientPlan, palette: Palette, footer: string) {
  const slide = pptx.addSlide()
  slide.addShape('rect', { x: 0, y: 0, w: 0.12, h: FOOTER_Y, fill: { color: palette.primary } })
  slide.addText(title, {
    x: 0.4, y: 0.35, w: SLIDE_W - 0.9, h: 0.9,
    fontFace: FONT, fontSize: 28, bold: true, color: palette.primary, align: 'left', valign: 'middle', wrap: true,
  })
  slide.addShape('line', {
    x: 0.4, y: 1.3, w: SLIDE_W - 0.9, h: 0,
    line: { color: palette.accent, width: 1.5 },
  })
  const colW = (SLIDE_W - 1.2) / 2
  slide.addText('Recommended Properties', {
    x: 0.5, y: 1.5, w: colW, h: 0.4,
    fontFace: FONT, fontSize: 13, bold: true, color: palette.primary, align: 'left',
  })
  plan.recommendedProperties.slice(0, 4).forEach((p, i) => {
    slide.addText(`• ${p}`, {
      x: 0.5, y: 2.0 + i * 0.42, w: colW, h: 0.4,
      fontFace: FONT, fontSize: 14, color: palette.text, align: 'left', wrap: true,
    })
  })
  slide.addText('Formats', {
    x: 0.5, y: 3.85, w: colW, h: 0.4,
    fontFace: FONT, fontSize: 13, bold: true, color: palette.primary, align: 'left',
  })
  plan.formats.slice(0, 3).forEach((f, i) => {
    slide.addText(`• ${f}`, {
      x: 0.5, y: 4.3 + i * 0.38, w: colW, h: 0.37,
      fontFace: FONT, fontSize: 14, color: palette.text, align: 'left', wrap: true,
    })
  })
  const rx = 0.5 + colW + 0.3
  slide.addShape('rect', {
    x: rx - 0.15, y: 1.45, w: colW + 0.1, h: 2.5,
    fill: { color: 'F7F8FC' },
    line: { color: palette.primary, width: 1 },
  })
  slide.addText('Audience Fit', {
    x: rx, y: 1.6, w: colW - 0.2, h: 0.35,
    fontFace: FONT, fontSize: 13, bold: true, color: palette.primary, align: 'left',
  })
  slide.addText(plan.audienceMatch, {
    x: rx, y: 2.0, w: colW - 0.2, h: 1.7,
    fontFace: FONT, fontSize: 14, color: palette.text, align: 'left', valign: 'top', wrap: true,
  })
  if (plan.timeline) {
    slide.addShape('rect', {
      x: rx - 0.15, y: 4.1, w: colW + 0.1, h: 0.8,
      fill: { color: palette.primary },
    })
    slide.addText(`Timeline: ${plan.timeline}`, {
      x: rx, y: 4.15, w: colW - 0.2, h: 0.7,
      fontFace: FONT, fontSize: 14, bold: true, color: 'FFFFFF', align: 'left', valign: 'middle',
    })
  }
  addFooter(slide, footer, palette)
}

function renderClosing(pptx: pptxgen, headline: string, subline: string, palette: Palette, footer: string) {
  const slide = pptx.addSlide()
  slide.addShape('rect', { x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, fill: { color: palette.primary } })
  slide.addShape('rect', { x: 0, y: SLIDE_H * 0.55, w: SLIDE_W, h: 0.06, fill: { color: palette.accent } })
  slide.addText(headline, {
    x: 1, y: 2.0, w: SLIDE_W - 2, h: 2,
    fontFace: FONT, fontSize: 44, bold: true, color: 'FFFFFF',
    align: 'center', valign: 'middle', wrap: true,
  })
  if (subline) {
    slide.addText(subline, {
      x: 1, y: 4.3, w: SLIDE_W - 2, h: 0.7,
      fontFace: FONT, fontSize: 18, color: 'FFFFFF', align: 'center', transparency: 20,
    })
  }
  addFooter(slide, footer, palette)
}

function renderFlexibleSlide(pptx: pptxgen, s: FlexibleSlide, palette: Palette, footer: string) {
  if (s.bullets.length === 0) {
    renderSectionDivider(pptx, s.title, palette, footer)
  } else if (s.bullets.length <= 2 && !s.subtitle) {
    renderDarkImpact(pptx, s.title, s.bullets, palette, footer)
  } else {
    renderContent(pptx, s.title, s.bullets, palette, footer, s.subtitle)
  }
}

// ─── Deck builders ───────────────────────────────────────────────────────────

function buildParamountRfpDeck(pptx: pptxgen, proposalData: ProposalData, expanded: ExpandedContent, palette: Palette, footer: string) {
  const pm     = expanded.paramountMedia
  const client = proposalData.client.company || 'Your Brand'
  const project = proposalData.project.title || 'Media Partnership Proposal'

  renderCover(pptx, project, `Prepared for ${client} · ${proposalData.generated.createdDate}`, palette, footer)

  if (expanded.culturalShift?.length)
    renderDarkImpact(pptx, 'The New Reality of Attention', expanded.culturalShift.slice(0, 3), palette, footer)

  if (expanded.realProblem?.length)
    renderDarkImpact(pptx, 'Why Most Brand Campaigns Fail Today', expanded.realProblem.slice(0, 3), palette, footer, 'E55555')

  if (expanded.costOfInaction?.length)
    renderDarkImpact(pptx, `What This Is Costing ${client}`, expanded.costOfInaction.slice(0, 3), palette, footer, 'FF8C42')

  if (expanded.coreInsight)
    renderQuote(pptx, expanded.coreInsight, 'The Paramount Advantage', palette, footer)

  if (pm) {
    const ipBullets = pm.paramountIPAlignments.slice(0, 4).map(
      ip => `${ip.propertyName} (${ip.network}) — ${ip.audienceStat}`
    )
    renderContent(pptx, 'How Paramount Turns Brands Into Cultural Moments', ipBullets, palette, footer, pm.opportunityStatement)
  }

  const proofPoints = pm?.proofPoints ?? expanded.proofPoints ?? []
  if (proofPoints.length)
    renderProofGrid(pptx, 'Proven Impact at Scale', proofPoints.slice(0, 6), palette, footer)

  if (expanded.approachSteps?.length)
    renderThreeSteps(pptx, 'From Idea to Cultural Moment', expanded.approachSteps.slice(0, 3), palette, footer)

  if (expanded.customPlan)
    renderCustomPlan(pptx, 'Your Opportunity With Paramount', expanded.customPlan, palette, footer)

  if (pm?.investmentTiers?.length)
    renderTierCards(pptx, 'Investment vs. Impact', pm.investmentTiers.slice(0, 3), palette, footer)

  const nextSteps = pm?.nextSteps ?? expanded.nextSteps ?? []
  if (nextSteps.length)
    renderContent(pptx, 'Next Steps', nextSteps.slice(0, 5), palette, footer)

  renderClosing(pptx, "Let's Build This Together", `Contact us to lock in your ${new Date().getFullYear()} partnership`, palette, footer)

  expanded.additionalSlides?.forEach(s => renderContent(pptx, s.title, s.bullets, palette, footer))
}

function buildShowcaseDeck(pptx: pptxgen, _proposalData: ProposalData, expanded: ExpandedContent, palette: Palette, footer: string) {
  const sc = expanded.showcaseContent
  if (!sc) return

  renderCover(pptx, sc.showcaseTitle, sc.executiveSummary, palette, footer)
  sc.slides.forEach(s => renderFlexibleSlide(pptx, s, palette, footer))

  if (sc.audienceInsights?.length)
    renderContent(pptx, 'Audience Insights', sc.audienceInsights, palette, footer)
  if (sc.measurementFramework?.length)
    renderContent(pptx, 'Measurement Framework', sc.measurementFramework, palette, footer)

  renderClosing(pptx, 'Ready to Activate?', 'Contact Paramount Advertising Solutions', palette, footer)
}

function buildGenericDeck(pptx: pptxgen, proposalData: ProposalData, expanded: ExpandedContent, palette: Palette, footer: string) {
  const slides  = expanded.flexibleSlides ?? []
  const project = proposalData.project.title || 'Presentation'
  const client  = proposalData.client.company

  renderCover(pptx, project, client ? `Prepared for ${client}` : proposalData.generated.createdDate, palette, footer)
  slides.forEach(s => renderFlexibleSlide(pptx, s, palette, footer))
  expanded.additionalSlides?.forEach(s => renderContent(pptx, s.title, s.bullets, palette, footer))
}

// ─── Drive upload ─────────────────────────────────────────────────────────────

async function uploadPptxToDrive(arrayBuffer: ArrayBuffer, name: string, token: string): Promise<{ id: string; webViewLink: string }> {
  const boundary = 'rfp_pptx_boundary_x7k2'
  const meta = JSON.stringify({ name, mimeType: 'application/vnd.google-apps.presentation' })
  const enc = new TextEncoder()
  const metaPart  = enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`)
  const filePart  = enc.encode(`--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation\r\n\r\n`)
  const ending    = enc.encode(`\r\n--${boundary}--`)
  const fileBytes = new Uint8Array(arrayBuffer)

  const body = new Uint8Array(metaPart.length + filePart.length + fileBytes.length + ending.length)
  let offset = 0
  body.set(metaPart, offset);  offset += metaPart.length
  body.set(filePart, offset);  offset += filePart.length
  body.set(fileBytes, offset); offset += fileBytes.length
  body.set(ending, offset)

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )

  if (response.status === 401) throw new Error('AUTH_EXPIRED')
  if (response.status === 429) throw new Error('RATE_LIMITED: Drive quota exceeded')
  if (response.status === 403) {
    const b = await response.json().catch(() => ({})) as { error?: { message?: string } }
    throw new Error(`FORBIDDEN: ${b?.error?.message || response.statusText}`)
  }
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Drive upload failed ${response.status}: ${text.slice(0, 200)}`)
  }

  return response.json() as Promise<{ id: string; webViewLink: string }>
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function exportPresentationViaDrive(
  proposalData: ProposalData,
  designConfig: DesignConfig,
  getToken: () => Promise<string>,
): Promise<ExportResult> {
  const expanded  = proposalData.expanded
  const deckType  = expanded.deckType ?? 'paramount-rfp'
  const company   = proposalData.client.company || 'Paramount'
  const title     = proposalData.project.title  || 'Media Partnership Proposal'
  const palette   = buildPptxPalette(company, designConfig)
  const footer    = `${company.toUpperCase()} · ADVERTISING SOLUTIONS · CONFIDENTIAL`

  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title  = title
  pptx.author = 'Paramount Advertising Solutions'

  switch (deckType) {
    case 'paramount-showcase':
      buildShowcaseDeck(pptx, proposalData, expanded, palette, footer)
      break
    case 'generic':
      buildGenericDeck(pptx, proposalData, expanded, palette, footer)
      break
    default:
      buildParamountRfpDeck(pptx, proposalData, expanded, palette, footer)
  }

  // Generate the .pptx binary
  const arrayBuffer = await pptx.write({ outputType: 'arraybuffer' }) as ArrayBuffer

  // Upload to Drive — auto-converts to Google Slides format
  const token  = await getToken()
  const result = await uploadPptxToDrive(arrayBuffer, title, token)

  return {
    presentationId:  result.id,
    presentationUrl: result.webViewLink,
    title,
  }
}
