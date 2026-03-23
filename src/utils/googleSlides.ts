/**
 * Google Slides REST API integration
 *
 * Two-phase approach:
 *   1. POST /v1/presentations — create empty presentation
 *   2. POST /v1/presentations/{id}:batchUpdate — build all slides in one atomic request
 *
 * No Vite proxy needed — Google Slides API supports CORS with OAuth Bearer tokens.
 */

import type { ProposalData, DesignConfig, ParamountMediaContent, IPAlignment, IntegrationConcept, CalendarItem, InvestmentTier, FlexibleSlide, ShowcaseContent, ProofPoint, CustomClientPlan } from '../types/proposal'
import { getBrandPalette, derivePaletteFromHex } from './brandColors'

const SLIDES_API = 'https://slides.googleapis.com/v1/presentations'

export type TokenGetter = () => Promise<string>

/** Converts a failed fetch response into a typed Error with a sentinel prefix. */
async function toApiError(resp: Response): Promise<Error> {
  const body = await resp.json().catch(() => ({})) as { error?: { message?: string } }
  const msg = body?.error?.message || resp.statusText
  if (resp.status === 401) return new Error('AUTH_EXPIRED')
  if (resp.status === 403) return new Error(`FORBIDDEN: ${msg}`)
  if (resp.status === 429) return new Error(`RATE_LIMITED: ${msg}`)
  return new Error(`API_ERROR_${resp.status}: ${msg}`)
}

/**
 * Retries a fetch-based operation with exponential backoff on 429 and 401.
 * On AUTH_EXPIRED (401), refreshes the token via getToken() and retries once.
 */
async function withBackoff<T>(
  fn: (token: string) => Promise<T>,
  getToken: TokenGetter,
  maxRetries = 3,
): Promise<T> {
  let currentToken = await getToken()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(currentToken)
    } catch (err) {
      const is429 = err instanceof Error && err.message.startsWith('RATE_LIMITED')
      const is401 = err instanceof Error && err.message.startsWith('AUTH_EXPIRED')

      if (is401 && attempt < maxRetries) {
        console.warn('[Slides] Token expired mid-flow, refreshing and retrying…')
        currentToken = await getToken()
        continue
      }

      if (!is429 || attempt === maxRetries) throw err
      const delay = Math.min((Math.pow(2, attempt) + Math.random()) * 1000, 32000)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('Max retries exceeded')
}

// Standard 16:9 widescreen in EMU (1 inch = 914400 EMU)
// 10" × 5.625" = 9144000 × 5143500 EMU
const W = 9144000  // slide width
const H = 5143500  // slide height

// Theme-independent palette constants
const WHITE  = { red: 1, green: 1, blue: 1 }
const LTGRAY = { red: 0.96, green: 0.96, blue: 0.97 }     // #F5F5F7
const GRAY   = { red: 0.45, green: 0.48, blue: 0.54 }

export interface CreateSlidesResult {
  presentationId: string
  presentationUrl: string
  title: string
}

// ---------------------------------------------------------------------------
// Palette system
// ---------------------------------------------------------------------------

type RgbColor = { red: number; green: number; blue: number }

interface SlidePalette {
  primary: RgbColor        // dark background (NAVY equivalent)
  primaryLighter: RgbColor // lighter variant for panels
  primaryDarker: RgbColor  // darker variant for footer bars
  accent: RgbColor         // brand accent (ORANGE equivalent)
}

const PALETTE_MAP: Record<string, SlidePalette> = {
  'navy-gold': {
    primary:        { red: 0.051, green: 0.122, blue: 0.251 },  // #0D1F40
    primaryLighter: { red: 0.07,  green: 0.16,  blue: 0.32  },
    primaryDarker:  { red: 0.035, green: 0.09,  blue: 0.2   },
    accent:         { red: 0.949, green: 0.451, blue: 0.129 },  // #F27321
  },
  'slate-blue': {
    primary:        { red: 0.118, green: 0.227, blue: 0.373 },  // #1E3A5F
    primaryLighter: { red: 0.16,  green: 0.28,  blue: 0.44  },
    primaryDarker:  { red: 0.07,  green: 0.15,  blue: 0.27  },
    accent:         { red: 0.231, green: 0.510, blue: 0.965 },  // #3B82F6
  },
  'forest-green': {
    primary:        { red: 0.102, green: 0.227, blue: 0.165 },  // #1A3A2A
    primaryLighter: { red: 0.14,  green: 0.28,  blue: 0.21  },
    primaryDarker:  { red: 0.06,  green: 0.14,  blue: 0.10  },
    accent:         { red: 0.133, green: 0.773, blue: 0.369 },  // #22C55E
  },
  // Option 3: Executive Minimal — near-black with warm platinum accent
  'executive-dark': {
    primary:        { red: 0.055, green: 0.055, blue: 0.065 },  // #0E0E10 near-black
    primaryLighter: { red: 0.12,  green: 0.12,  blue: 0.14  },  // dark charcoal (hairline rules)
    primaryDarker:  { red: 0.03,  green: 0.03,  blue: 0.04  },  // deepest tone
    accent:         { red: 0.85,  green: 0.82,  blue: 0.75  },  // warm platinum/champagne
  },
  // Paramount brand theme — official Paramount Advertising blue + gold
  'paramount': {
    primary:        { red: 0.0,   green: 0.188, blue: 0.529 },  // #003087 Paramount deep blue
    primaryLighter: { red: 0.0,   green: 0.314, blue: 0.702 },  // #0050B3
    primaryDarker:  { red: 0.0,   green: 0.122, blue: 0.357 },  // #001F5B
    accent:         { red: 0.961, green: 0.773, blue: 0.094 },  // #F5C518 Paramount gold
  },
}

// ---------------------------------------------------------------------------
// Low-level request builders
// ---------------------------------------------------------------------------

function bgFill(slideId: string, color: RgbColor) {
  return {
    updatePageProperties: {
      objectId: slideId,
      pageProperties: {
        pageBackgroundFill: {
          solidFill: { color: { rgbColor: color } },
        },
      },
      fields: 'pageBackgroundFill',
    },
  }
}

function createTextBox(
  id: string,
  slideId: string,
  x: number, y: number, w: number, h: number
) {
  return {
    createShape: {
      objectId: id,
      shapeType: 'TEXT_BOX',
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: w, unit: 'EMU' },
          height: { magnitude: h, unit: 'EMU' },
        },
        transform: {
          scaleX: 1, scaleY: 1,
          translateX: x, translateY: y,
          unit: 'EMU',
        },
      },
    },
  }
}

function insertText(id: string, text: string) {
  return {
    insertText: { objectId: id, insertionIndex: 0, text },
  }
}

interface TextStyleOpts {
  color?: RgbColor
  fontSize?: number
  bold?: boolean
  fontFamily?: string
}

function styleText(id: string, opts: TextStyleOpts) {
  return {
    updateTextStyle: {
      objectId: id,
      style: {
        fontFamily: opts.fontFamily ?? 'Inter',
        fontSize: { magnitude: opts.fontSize ?? 18, unit: 'PT' },
        foregroundColor: { opaqueColor: { rgbColor: opts.color ?? GRAY } },
        bold: opts.bold ?? false,
      },
      textRange: { type: 'ALL' },
      fields: 'fontFamily,fontSize,foregroundColor,bold',
    },
  }
}

function paragraphAlign(id: string, alignment: 'START' | 'CENTER' | 'END' = 'START') {
  return {
    updateParagraphStyle: {
      objectId: id,
      style: { alignment },
      textRange: { type: 'ALL' },
      fields: 'alignment',
    },
  }
}

// autoFitRequest removed — Google Slides API now treats 'autofit' as read-only;
// any updateShapeProperties with fields: 'autofit' returns a 400.
// Text boxes are sized generously at creation time instead.

/** Truncate a string to maxChars at a word boundary (last-resort only). */
function truncate(text: string, maxChars: number, suffix = '…'): string {
  if (!text || text.length <= maxChars) return text
  const cut = text.slice(0, maxChars - suffix.length)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut) + suffix
}

// ---------------------------------------------------------------------------
// Adaptive font sizing — prevents text overflow by shrinking font first,
// truncating only as a last resort at the minimum readable size.
// ---------------------------------------------------------------------------

const EMU_PER_PT = 12700
const LINE_HEIGHT_FACTOR = 1.5

/** Estimate the max characters a text box can hold at a given font size. */
function estimateMaxChars(heightEmu: number, widthEmu: number, fontSizePt: number): number {
  const lineHeightEmu = fontSizePt * EMU_PER_PT * LINE_HEIGHT_FACTOR
  const maxLines = Math.max(1, Math.floor(heightEmu / lineHeightEmu))
  const charWidthEmu = fontSizePt * EMU_PER_PT * 0.55
  const charsPerLine = Math.max(10, Math.floor(widthEmu / charWidthEmu))
  return maxLines * charsPerLine
}

/** Pick the largest font size (stepping down by 2pt) at which text fits the box. */
function adaptiveFontSize(
  text: string, heightEmu: number, widthEmu: number,
  targetPt: number, minPt: number = 14,
): number {
  if (!text) return targetPt
  for (let pt = targetPt; pt >= minPt; pt -= 2) {
    if (text.length <= estimateMaxChars(heightEmu, widthEmu, pt)) return pt
  }
  return minPt
}

interface FitResult { text: string; fontSize: number }

/**
 * Fit a block of bullet text into a text box by first shrinking the font,
 * then truncating individual bullets only at the minimum font size.
 */
function fitBullets(
  bullets: string[],
  widthEmu: number,
  heightEmu: number,
  targetPt: number,
  minPt: number = 10,
  maxBullets: number = 8,
): FitResult {
  const safe = bullets.filter(b => b.trim()).slice(0, maxBullets)
  if (safe.length === 0) return { text: '', fontSize: targetPt }

  const fullText = safe.join('\n')

  for (let pt = targetPt; pt >= minPt; pt -= 1) {
    if (fullText.length <= estimateMaxChars(heightEmu, widthEmu, pt)) {
      return { text: fullText, fontSize: pt }
    }
  }

  const capacity = estimateMaxChars(heightEmu, widthEmu, minPt)
  const perBullet = Math.max(40, Math.floor((capacity - safe.length + 1) / safe.length))
  const trimmed = safe.map(b => truncate(b, perBullet))
  return { text: trimmed.join('\n'), fontSize: minPt }
}

/**
 * Fit a single block of text into a text box by shrinking font first,
 * truncating only at the minimum font size.
 */
function fitText(
  text: string,
  widthEmu: number,
  heightEmu: number,
  targetPt: number,
  minPt: number = 10,
): FitResult {
  if (!text) return { text: '', fontSize: targetPt }

  for (let pt = targetPt; pt >= minPt; pt -= 1) {
    if (text.length <= estimateMaxChars(heightEmu, widthEmu, pt)) {
      return { text, fontSize: pt }
    }
  }

  const capacity = estimateMaxChars(heightEmu, widthEmu, minPt)
  return { text: truncate(text, capacity), fontSize: minPt }
}

/** Build an updateParagraphStyle request for spacing / line height. */
function paragraphSpacing(id: string, opts: {
  lineSpacing?: number
  spaceAbove?: number
  spaceBelow?: number
}): object {
  const style: Record<string, unknown> = {}
  const fields: string[] = []
  if (opts.lineSpacing != null) {
    style.lineSpacing = opts.lineSpacing
    fields.push('lineSpacing')
  }
  if (opts.spaceAbove != null) {
    style.spaceAbove = { magnitude: opts.spaceAbove, unit: 'PT' }
    fields.push('spaceAbove')
  }
  if (opts.spaceBelow != null) {
    style.spaceBelow = { magnitude: opts.spaceBelow, unit: 'PT' }
    fields.push('spaceBelow')
  }
  return {
    updateParagraphStyle: {
      objectId: id,
      style,
      textRange: { type: 'ALL' },
      fields: fields.join(','),
    },
  }
}

function createImageReq(
  id: string, slideId: string, url: string,
  x: number, y: number, w: number, h: number,
) {
  return {
    createImage: {
      objectId: id,
      url,
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: w, unit: 'EMU' },
          height: { magnitude: h, unit: 'EMU' },
        },
        transform: {
          scaleX: 1, scaleY: 1,
          translateX: x, translateY: y,
          unit: 'EMU',
        },
      },
    },
  }
}

function createRect(id: string, slideId: string, x: number, y: number, w: number, h: number, color: RgbColor) {
  return [
    {
      createShape: {
        objectId: id,
        shapeType: 'RECTANGLE',
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width: { magnitude: w, unit: 'EMU' },
            height: { magnitude: h, unit: 'EMU' },
          },
          transform: {
            scaleX: 1, scaleY: 1,
            translateX: x, translateY: y,
            unit: 'EMU',
          },
        },
      },
    },
    {
      updateShapeProperties: {
        objectId: id,
        shapeProperties: {
          shapeBackgroundFill: {
            solidFill: { color: { rgbColor: color } },
          },
        },
        fields: 'shapeBackgroundFill',
      },
    },
  ]
}

function createEllipse(id: string, slideId: string, x: number, y: number, w: number, h: number, color: RgbColor): object[] {
  return [
    {
      createShape: {
        objectId: id,
        shapeType: 'ELLIPSE',
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width: { magnitude: w, unit: 'EMU' },
            height: { magnitude: h, unit: 'EMU' },
          },
          transform: {
            scaleX: 1, scaleY: 1,
            translateX: x, translateY: y,
            unit: 'EMU',
          },
        },
      },
    },
    {
      updateShapeProperties: {
        objectId: id,
        shapeProperties: {
          shapeBackgroundFill: {
            solidFill: { color: { rgbColor: color } },
          },
        },
        fields: 'shapeBackgroundFill',
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Layout variant options — derived from DesignConfig.designStyle
// ---------------------------------------------------------------------------

interface SlideOpts {
  boldAgency: boolean  // Option 2: dramatic dark slides, split panel, corner shapes
  minimal: boolean     // Option 3: hairline rules, all-dark, premium consulting feel
}

// ---------------------------------------------------------------------------
// Slide builders — each returns an array of batchUpdate requests
// ---------------------------------------------------------------------------

// Margins / layout constants (EMU)
const MARGIN_X = 457200      // ~0.5"
const MARGIN_TOP = 400000
const FULL_W = W - MARGIN_X * 2

// Cover slide layout: content zone (left ~65%) + branded right panel (right ~35%)
const PANEL_X        = 5943600             // right brand panel starts at ~65% of slide
const PANEL_W        = W - PANEL_X         // = 3,200,400 (~3.5" wide)
const CONTENT_W      = 5400000             // text column width (leaves ~100k gap before accent line)

// Panel logo layout — shared between titleSlide() (Phase 2 divider/labels) and logoRequests() (Phase 3 images)
// All values vertically center the two-logo block within the available panel height.
const LOGO_SIZE      = 914400              // ~1" square
const LOGO_X         = PANEL_X + Math.round(PANEL_W / 2) - Math.round(LOGO_SIZE / 2)  // 7,086,600
const COVER_CLABEL_Y = 1286350             // client company label (e.g. "STARBUCKS")
const COVER_CLOGO_Y  = 1526350             // client logo image
const COVER_DIV_Y    = 2590750             // thin orange rule between logos
const COVER_PLOGO_Y  = 2922750             // Paramount logo image

/** Slide 1: Title / Cover */
function titleSlide(slideId: string, data: ProposalData, palette: SlidePalette): object[] {
  const panelId       = `${slideId}_panel`
  const vlineId       = `${slideId}_vline`
  const clientLblId   = `${slideId}_clbl`
  const panelDivId    = `${slideId}_pdiv`
  const eyebrowId     = `${slideId}_eyebrow`
  const heroId        = `${slideId}_hero`
  const titleId       = `${slideId}_title`
  const ruleId        = `${slideId}_rule`
  const dateId        = `${slideId}_date`
  const barId         = `${slideId}_bar`
  const bar2Id        = `${slideId}_bar2`

  const labelW = PANEL_W - 300000  // label text width inside the panel (150k padding each side)
  const labelX = PANEL_X + 150000  // label text x (centered in panel via paragraphAlign)

  return [
    bgFill(slideId, palette.primary),

    // Structural bars (full width, drawn first — panel will cover them in right zone)
    ...createRect(barId,  slideId, 0, 0,          W, 60000,  palette.accent),
    ...createRect(bar2Id, slideId, 0, H - 80000,  W, 80000,  palette.primaryDarker),

    // Right brand panel covers the bars in its zone — clean uniform panel background
    ...createRect(panelId, slideId, PANEL_X, 0, PANEL_W, H, palette.primaryLighter),
    // Thin accent vertical line at the split
    ...createRect(vlineId, slideId, PANEL_X, 0, 12000, H, palette.accent),

    // Panel: client company label (above client logo placeholder)
    createTextBox(clientLblId, slideId, labelX, COVER_CLABEL_Y, labelW, 180000),
    ...(data.client.company ? [
      insertText(clientLblId, data.client.company.toUpperCase()),
      styleText(clientLblId, { color: GRAY, fontSize: 10, fontFamily: 'Inter', bold: true }),
      paragraphAlign(clientLblId, 'CENTER'),
    ] : []),

    // Panel: thin accent horizontal rule between the two logos
    ...createRect(panelDivId, slideId, PANEL_X + 300000, COVER_DIV_Y, PANEL_W - 600000, 12000, palette.accent),

    // Left content zone — constrained to CONTENT_W so text stays clear of the panel
    createTextBox(eyebrowId, slideId, MARGIN_X, 180000, CONTENT_W, 200000),
    insertText(eyebrowId, 'PARAMOUNT'),
    styleText(eyebrowId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    // Hero brand line — 52pt, wraps cleanly to 2 lines inside the content zone
    createTextBox(heroId, slideId, MARGIN_X, 600000, CONTENT_W, 1700000),
    insertText(heroId, `${data.client.company} \u00d7 Paramount`),
    styleText(heroId, { color: WHITE, fontSize: 52, fontFamily: 'Montserrat', bold: true }),

    // Project title (supporting, smaller) — adaptive sizing prevents overflow
    createTextBox(titleId, slideId, MARGIN_X, 2400000, CONTENT_W, 800000),
    ...((data.expanded?.editedProjectTitle ?? data.project.title) ? (() => {
      const titleText = data.expanded?.editedProjectTitle ?? data.project.title
      const titleFontSize = adaptiveFontSize(titleText, 800000, CONTENT_W, 22, 16)
      return [
        insertText(titleId, titleText),
        styleText(titleId, { color: GRAY, fontSize: titleFontSize, fontFamily: 'Inter' }),
      ]
    })() : []),

    // Thin accent divider rule
    ...createRect(ruleId, slideId, MARGIN_X, 3280000, CONTENT_W, 18000, palette.accent),

    // Date line
    createTextBox(dateId, slideId, MARGIN_X, 3360000, CONTENT_W, 280000),
    insertText(dateId, `Prepared for ${data.client.company}  \u00b7  ${data.generated.createdDate}`),
    styleText(dateId, { color: GRAY, fontSize: 14, fontFamily: 'Inter' }),
  ]
}

/** Slide 12: Next Steps — numbered action items */
function nextStepsSlide(slideId: string, data: ProposalData, palette: SlidePalette, opts: SlideOpts): object[] {
  const steps = data.expanded.nextSteps ?? []
  if (steps.length === 0) return []  // skip if no steps generated

  const headId  = `${slideId}_head`
  const labelId = `${slideId}_label`
  const barId   = `${slideId}_bar`

  const isDark = opts.boldAgency || opts.minimal
  const bg      = isDark ? palette.primary : LTGRAY
  const headClr = isDark ? palette.accent : palette.primary
  const textClr = isDark ? LTGRAY : { red: 0.25, green: 0.28, blue: 0.38 }

  const reqs: object[] = [bgFill(slideId, bg)]

  if (opts.minimal) {
    reqs.push(
      ...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 4000, palette.primaryLighter),
      ...createRect(barId, slideId, 0, H - 4000, W, 4000, palette.primaryLighter),
    )
  } else {
    reqs.push(...createRect(barId, slideId, 0, H - 50000, W, 50000,
      isDark ? palette.primaryDarker : palette.primary))
    if (opts.boldAgency) {
      reqs.push(...createRect(`${slideId}_acctop`, slideId, 0, 0, W, 60000, palette.accent))
    }
  }

  reqs.push(
    createTextBox(labelId, slideId, MARGIN_X, 300000, FULL_W, 160000),
    insertText(labelId, 'WHAT HAPPENS NEXT'),
    styleText(labelId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 500000, FULL_W, 500000),
    insertText(headId, 'Next Steps'),
    styleText(headId, { color: headClr, fontSize: 32, fontFamily: 'Montserrat', bold: true }),
  )

  // Two-column layout for up to 5 steps
  const visSteps = steps.slice(0, 5)
  const leftSteps  = visSteps.slice(0, Math.ceil(visSteps.length / 2))
  const rightSteps = visSteps.slice(Math.ceil(visSteps.length / 2))
  const colW = FULL_W / 2 - 100000
  const startY = 1200000
  const stepH  = 600000

  const renderColumn = (colSteps: string[], xOffset: number, indexOffset: number) => {
    colSteps.forEach((step, i) => {
      const idx    = i + indexOffset
      const y      = startY + i * stepH
      const numId  = `${slideId}_cn${idx}`
      const txtId  = `${slideId}_ct${idx}`
      const ruleId = `${slideId}_cr${idx}`

      reqs.push(
        createTextBox(numId, slideId, xOffset, y, 300000, stepH),
        insertText(numId, String(idx + 1).padStart(2, '0')),
        styleText(numId, { color: palette.accent, fontSize: 22, fontFamily: 'Montserrat', bold: true }),

        createTextBox(txtId, slideId, xOffset + 380000, y, colW - 380000, stepH - 50000),
        ...(step ? [
          insertText(txtId, step),
          styleText(txtId, { color: textClr, fontSize: 14, fontFamily: 'Inter' }),
        ] : []),

        ...createRect(ruleId, slideId, xOffset, y + stepH - 30000, colW, 2000, { red: 0.85, green: 0.86, blue: 0.88 }),
      )
    })
  }

  renderColumn(leftSteps, MARGIN_X, 0)
  if (rightSteps.length > 0) {
    renderColumn(rightSteps, MARGIN_X + FULL_W / 2 + 100000, leftSteps.length)
  }

  return reqs
}

/** Slide 10: Close / CTA */
function closingSlide(slideId: string, data: ProposalData, palette: SlidePalette, opts: SlideOpts): object[] {
  const headId   = `${slideId}_head`
  const footerId = `${slideId}_footer`
  const barId    = `${slideId}_bar`
  const rule1Id  = `${slideId}_rule1`
  const rule2Id  = `${slideId}_rule2`

  const reqs: object[] = [
    bgFill(slideId, palette.primary),
  ]

  if (opts.boldAgency) {
    // Corner ellipses bleed off the edges for visual drama
    reqs.push(
      ...createEllipse(`${slideId}_el1`, slideId, -800000,      -800000,      2400000, 2400000, palette.primaryLighter),
      ...createEllipse(`${slideId}_el2`, slideId, W - 1600000,  H - 1600000,  2400000, 2400000, palette.primaryLighter),
    )
  }

  if (opts.minimal) {
    reqs.push(
      ...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 4000, palette.primaryLighter),
      ...createRect(barId, slideId, 0, H - 4000, W, 4000, palette.primaryLighter),
    )
  } else {
    reqs.push(...createRect(barId, slideId, 0, H - 80000, W, 80000, palette.primaryDarker))
  }

  reqs.push(
    // Thin accent rules bracket the CTA (logo inserted in Phase 3 sits above them)
    ...createRect(rule1Id, slideId, MARGIN_X, 1280000, FULL_W, 6000, palette.accent),
    ...createRect(rule2Id, slideId, MARGIN_X, 2300000, FULL_W, 6000, palette.accent),

    createTextBox(headId, slideId, MARGIN_X, 1400000, FULL_W, 800000),
    insertText(headId, `Let's build this together.`),
    styleText(headId, { color: palette.accent, fontSize: opts.boldAgency ? 44 : 40, fontFamily: 'Montserrat', bold: true }),
    paragraphAlign(headId, 'CENTER'),
  )

  // Bold-agency: client company name as accent sub-line below the CTA rules
  if (opts.boldAgency && data.client.company) {
    reqs.push(
      createTextBox(`${slideId}_company`, slideId, MARGIN_X, 2420000, FULL_W, 350000),
      insertText(`${slideId}_company`, data.client.company.toUpperCase()),
      styleText(`${slideId}_company`, { color: palette.accent, fontSize: 18, fontFamily: 'Inter', bold: true }),
      paragraphAlign(`${slideId}_company`, 'CENTER'),
    )
  }

  reqs.push(
    createTextBox(footerId, slideId, MARGIN_X, H - 200000, FULL_W, 150000),
    ...(data.generated.slideFooter ? [
      insertText(footerId, data.generated.slideFooter),
      styleText(footerId, { color: GRAY, fontSize: 11, fontFamily: 'Inter' }),
      paragraphAlign(footerId, 'CENTER'),
    ] : []),
  )

  return reqs
}

/** Custom user-added content slide — mirrors the visual style of challengeSlide */
function additionalContentSlide(
  slideId: string,
  title: string,
  bullets: string[],
  palette: SlidePalette,
  opts: SlideOpts,
): object[] {
  const headId   = `${slideId}_head`
  const bodyId   = `${slideId}_body`
  const barId    = `${slideId}_bar`
  const accentId = `${slideId}_accent`

  const isDark    = opts.boldAgency || opts.minimal
  const textColor = isDark ? WHITE : palette.primary
  const accentW   = opts.minimal ? 6000 : 12000

  const BODY_W = FULL_W - 80000
  const BODY_H = 2900000
  const fit = fitBullets(bullets, BODY_W, BODY_H, 18, 10, 8)

  const reqs: object[] = [
    bgFill(slideId, isDark ? palette.primary : WHITE),
    ...createRect(accentId, slideId, 0, 0, accentW, H, palette.accent),
  ]

  if (opts.minimal) {
    reqs.push(
      ...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 4000, palette.primaryLighter),
      ...createRect(barId, slideId, 0, H - 4000, W, 4000, palette.primaryLighter),
    )
  } else {
    reqs.push(...createRect(barId, slideId, 0, H - 50000, W, 50000,
      isDark ? palette.primaryDarker : palette.accent))
  }

  const HEAD_H = 1200000
  const headFontSize = title ? adaptiveFontSize(title, HEAD_H, FULL_W, 36, 22) : 36

  reqs.push(
    createTextBox(headId, slideId, MARGIN_X, MARGIN_TOP, FULL_W, HEAD_H),
    ...(title ? [
      insertText(headId, title),
      styleText(headId, { color: textColor, fontSize: headFontSize, fontFamily: 'Montserrat', bold: true }),
    ] : []),

    createTextBox(bodyId, slideId, MARGIN_X + 80000, 1700000, BODY_W, BODY_H),
    ...(fit.text ? [
      insertText(bodyId, fit.text),
      styleText(bodyId, { color: isDark ? LTGRAY : palette.primary, fontSize: fit.fontSize, fontFamily: 'Inter' }),
      {
        createParagraphBullets: {
          objectId: bodyId,
          textRange: { type: 'ALL' },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      },
      paragraphSpacing(bodyId, { lineSpacing: 140, spaceBelow: 6 }),
    ] : []),
  )

  return reqs
}

// ---------------------------------------------------------------------------
// Persuasion-engine slide builders
// ---------------------------------------------------------------------------

/** Slide 2: The New Reality of Attention — cultural shift / urgency */
function culturalShiftSlide(slideId: string, data: ProposalData, palette: SlidePalette, opts: SlideOpts): object[] {
  const headId  = `${slideId}_head`
  const subId   = `${slideId}_sub`
  const bodyId  = `${slideId}_body`
  const barId   = `${slideId}_bar`

  const bullets = data.expanded?.culturalShift ?? [
    'Media is fragmenting — audiences live across TikTok, streaming, and fan communities, not linear channels',
    'Gen Z doesn\'t watch ads. They watch culture. If your brand isn\'t part of it, you\'re invisible.',
    'Traditional reach metrics mask a deeper problem: attention ≠ engagement',
  ]

  const reqs: object[] = [
    bgFill(slideId, palette.primary),
    ...createRect(barId, slideId, 0, 0, W, 8000, palette.accent),
  ]

  reqs.push(
    createTextBox(subId, slideId, MARGIN_X, 300000, FULL_W, 160000),
    insertText(subId, `${data.client.company.toUpperCase()}  ·  THE ATTENTION CRISIS`),
    styleText(subId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 500000, FULL_W, 600000),
    insertText(headId, 'The New Reality of Attention'),
    styleText(headId, { color: WHITE, fontSize: 40, fontFamily: 'Montserrat', bold: true }),

    createTextBox(bodyId, slideId, MARGIN_X + 80000, 1300000, FULL_W - 80000, 3200000),
    ...(() => {
      const fit = fitBullets(bullets, FULL_W - 80000, 3200000, 18, 10, 6)
      return fit.text ? [
        insertText(bodyId, fit.text),
        styleText(bodyId, { color: LTGRAY, fontSize: fit.fontSize, fontFamily: 'Inter' }),
        {
          createParagraphBullets: {
            objectId: bodyId,
            textRange: { type: 'ALL' },
            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
          },
        },
        paragraphSpacing(bodyId, { lineSpacing: 160, spaceBelow: 8 }),
      ] : []
    })(),
  )

  if (!opts.minimal) {
    reqs.push(...paramountFooter(slideId, palette))
  }

  return reqs
}

/** Slide 3: Why Most Brand Campaigns Fail Today — the reframe moment */
function realProblemSlide(slideId: string, data: ProposalData, palette: SlidePalette, _opts: SlideOpts): object[] {
  const headId  = `${slideId}_head`
  const subId   = `${slideId}_sub`
  const bodyId  = `${slideId}_body`

  const bullets = data.expanded?.realProblem ?? [
    'Interruptive ads don\'t create impact — they create skip buttons',
    'Media spend ≠ cultural relevance. Presence ≠ remembrance.',
    'Brands are buying impressions but not earning attention',
  ]

  return [
    bgFill(slideId, palette.primaryDarker),
    ...createRect(`${slideId}_bar`, slideId, 0, 0, W, 8000, palette.accent),

    createTextBox(subId, slideId, MARGIN_X, 300000, FULL_W, 160000),
    insertText(subId, 'THE REFRAME'),
    styleText(subId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 500000, FULL_W, 700000),
    insertText(headId, 'Why Most Brand Campaigns Fail Today'),
    styleText(headId, { color: WHITE, fontSize: 38, fontFamily: 'Montserrat', bold: true }),

    ...createRect(`${slideId}_rule`, slideId, MARGIN_X, 1300000, FULL_W, 6000, palette.accent),

    createTextBox(bodyId, slideId, MARGIN_X + 80000, 1450000, FULL_W - 80000, 3000000),
    ...(() => {
      const fit = fitBullets(bullets, FULL_W - 80000, 3000000, 20, 10, 6)
      return fit.text ? [
        insertText(bodyId, fit.text),
        styleText(bodyId, { color: LTGRAY, fontSize: fit.fontSize, fontFamily: 'Inter' }),
        {
          createParagraphBullets: {
            objectId: bodyId,
            textRange: { type: 'ALL' },
            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
          },
        },
        paragraphSpacing(bodyId, { lineSpacing: 180, spaceBelow: 10 }),
      ] : []
    })(),

    ...paramountFooter(slideId, palette),
  ]
}

/** Slide 4: What This Is Costing You — quantify the pain */
function costSlide(slideId: string, data: ProposalData, palette: SlidePalette, _opts: SlideOpts): object[] {
  const headId  = `${slideId}_head`
  const subId   = `${slideId}_sub`

  const costs = data.expanded?.costOfInaction ?? [
    'Lost attention — your ads play but nobody remembers',
    'Low brand recall — declining ROI on traditional media',
    'Weak emotional connection — no cultural currency with Gen Z',
  ]

  const cardW = Math.floor((FULL_W - 200000) / 3)
  const cardH = 2000000
  const cardY = 1400000

  const reqs: object[] = [
    bgFill(slideId, palette.primary),
    ...createRect(`${slideId}_bar`, slideId, 0, 0, W, 8000, palette.accent),

    createTextBox(subId, slideId, MARGIN_X, 300000, FULL_W, 160000),
    insertText(subId, `THE COST OF INACTION`),
    styleText(subId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 500000, FULL_W, 600000),
    insertText(headId, 'What This Is Costing You'),
    styleText(headId, { color: WHITE, fontSize: 38, fontFamily: 'Montserrat', bold: true }),
  ]

  costs.slice(0, 3).forEach((cost, i) => {
    const cardX = MARGIN_X + i * (cardW + 100000)
    const cardId = `${slideId}_card${i}`
    const textId = `${slideId}_ctext${i}`
    const textW = cardW - 160000
    const textH = cardH - 200000
    const costFit = fitText(cost, textW, textH, 16, 10)

    reqs.push(
      ...createRect(cardId, slideId, cardX, cardY, cardW, cardH, palette.primaryLighter),
      ...createRect(`${slideId}_crule${i}`, slideId, cardX, cardY, cardW, 8000, palette.accent),
      createTextBox(textId, slideId, cardX + 80000, cardY + 120000, textW, textH),
      insertText(textId, costFit.text),
      styleText(textId, { color: LTGRAY, fontSize: costFit.fontSize, fontFamily: 'Inter' }),
    )
  })

  reqs.push(...paramountFooter(slideId, palette))
  return reqs
}

/** Slide 5: The Money Slide — core insight / reframe thesis */
function coreInsightSlide(slideId: string, data: ProposalData, palette: SlidePalette, _opts: SlideOpts): object[] {
  const headId  = `${slideId}_head`
  const subId   = `${slideId}_sub`
  const bodyId  = `${slideId}_body`

  const insight = data.expanded?.coreInsight ?? 'Winning Brands Don\'t Buy Media — They Join Culture'

  const examples = [
    'Big Brother integrations — brand becomes part of the content, not adjacent to it',
    'VMAs moments — shoppable, social-first, in the cultural conversation',
    'Talent + fandom + live moments = emotional brand equity at scale',
  ]

  return [
    bgFill(slideId, palette.accent),
    ...createRect(`${slideId}_bar`, slideId, 0, 0, W, 12000, palette.primary),

    createTextBox(subId, slideId, MARGIN_X, 350000, FULL_W, 160000),
    insertText(subId, 'THE CORE INSIGHT'),
    styleText(subId, { color: palette.primary, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 600000, FULL_W, 1200000),
    insertText(headId, insight),
    styleText(headId, { color: palette.primary, fontSize: adaptiveFontSize(insight, 1200000, FULL_W, 44, 28), fontFamily: 'Montserrat', bold: true }),

    ...createRect(`${slideId}_rule`, slideId, MARGIN_X, 2000000, Math.round(FULL_W * 0.4), 8000, palette.primary),

    createTextBox(bodyId, slideId, MARGIN_X + 80000, 2200000, FULL_W - 80000, 2400000),
    ...(() => {
      const fit = fitBullets(examples, FULL_W - 80000, 2400000, 16, 10, 6)
      return fit.text ? [
        insertText(bodyId, fit.text),
        styleText(bodyId, { color: palette.primaryDarker, fontSize: fit.fontSize, fontFamily: 'Inter' }),
        {
          createParagraphBullets: {
            objectId: bodyId,
            textRange: { type: 'ALL' },
            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
          },
        },
        paragraphSpacing(bodyId, { lineSpacing: 160, spaceBelow: 8 }),
      ] : []
    })(),

    ...createRect(`${slideId}_fbar`, slideId, 0, H - 60000, W, 60000, palette.primary),
    ...(() => {
      const lblId = `${slideId}_flbl`
      return [
        createTextBox(lblId, slideId, MARGIN_X, H - 56000, FULL_W, 52000),
        insertText(lblId, 'PARAMOUNT  ·  ADVERTISING SOLUTIONS'),
        styleText(lblId, { color: palette.accent, fontSize: 8, fontFamily: 'Inter', bold: true }),
      ]
    })(),
  ]
}

/** Slide 6: How Paramount Turns Brands Into Cultural Moments */
function paramountAdvantageSlide(slideId: string, pm: ParamountMediaContent | undefined, data: ProposalData, palette: SlidePalette, _opts: SlideOpts): object[] {
  const headId  = `${slideId}_head`
  const subId   = `${slideId}_sub`
  const bodyId  = `${slideId}_body`

  const advantages = [
    'IP: Big Brother, VMAs, NFL, GRAMMYs — culture\'s biggest stages',
    'Talent: Named talent partnerships that drive authentic brand connections',
    'Multi-platform distribution: CBS + Paramount+ + MTV + BET + social',
    'Integration formats: Not ads — native content, shoppable moments, fan activations',
  ]

  const reqs: object[] = [
    bgFill(slideId, palette.primary),
    ...createRect(`${slideId}_bar`, slideId, 0, 0, W, 8000, palette.accent),

    createTextBox(subId, slideId, MARGIN_X, 300000, FULL_W, 160000),
    insertText(subId, `${data.client.company.toUpperCase()}  ×  PARAMOUNT`),
    styleText(subId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 500000, FULL_W, 700000),
    insertText(headId, 'How Paramount Turns Brands Into Cultural Moments'),
    styleText(headId, { color: WHITE, fontSize: 36, fontFamily: 'Montserrat', bold: true }),

    ...createRect(`${slideId}_rule`, slideId, MARGIN_X, 1320000, FULL_W, 6000, palette.accent),

    createTextBox(bodyId, slideId, MARGIN_X + 80000, 1450000, FULL_W - 80000, 3000000),
    ...(() => {
      const allBullets = pm?.opportunityStatement ? [pm.opportunityStatement, ...advantages] : advantages
      const fit = fitBullets(allBullets, FULL_W - 80000, 3000000, 17, 10, 6)
      return fit.text ? [
        insertText(bodyId, fit.text),
        styleText(bodyId, { color: LTGRAY, fontSize: fit.fontSize, fontFamily: 'Inter' }),
        {
          createParagraphBullets: {
            objectId: bodyId,
            textRange: { type: 'ALL' },
            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
          },
        },
        paragraphSpacing(bodyId, { lineSpacing: 160, spaceBelow: 8 }),
      ] : []
    })(),
  ]

  reqs.push(...paramountFooter(slideId, palette))
  return reqs
}

/** Slide 7: Proven Impact at Scale — proof points with stats */
function proofSlide(slideId: string, data: ProposalData, palette: SlidePalette, _opts: SlideOpts): object[] {
  const headId  = `${slideId}_head`
  const subId   = `${slideId}_sub`

  const proofPoints: ProofPoint[] = data.expanded?.proofPoints
    ?? data.expanded?.paramountMedia?.proofPoints
    ?? [
      { stat: '+102% brand preference lift', source: 'Dunkin\' × Big Brother S27', context: 'Season-long integration' },
      { stat: '+99% purchase intent lift', source: 'Dunkin\' × VMAs 2025', context: 'Custom talent activation' },
      { stat: '2.5B votes cast', source: 'Big Brother S27', context: 'Most interactive TV franchise in America' },
      { stat: '1B+ social impressions', source: 'VMAs 2025', context: '#1 most social TV event' },
    ]

  const reqs: object[] = [
    bgFill(slideId, WHITE),
    ...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 8000, palette.primary),
    ...createRect(`${slideId}_accent`, slideId, 0, 0, 12000, H, palette.accent),

    createTextBox(subId, slideId, MARGIN_X, 300000, FULL_W, 160000),
    insertText(subId, 'WHEN BRANDS INTEGRATE INTO CULTURE — THIS HAPPENS'),
    styleText(subId, { color: palette.primary, fontSize: 10, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 500000, FULL_W, 500000),
    insertText(headId, 'Proven Impact at Scale'),
    styleText(headId, { color: palette.primary, fontSize: 38, fontFamily: 'Montserrat', bold: true }),
  ]

  const cardW = Math.floor((FULL_W - 100000) / 2)
  const cardH = 1200000
  const startY = 1250000
  const positions = [
    { x: MARGIN_X, y: startY },
    { x: MARGIN_X + cardW + 100000, y: startY },
    { x: MARGIN_X, y: startY + cardH + 80000 },
    { x: MARGIN_X + cardW + 100000, y: startY + cardH + 80000 },
  ]

  proofPoints.slice(0, 4).forEach((pp, i) => {
    const pos = positions[i]
    const cardId = `${slideId}_card${i}`
    const statId = `${slideId}_stat${i}`
    const srcId  = `${slideId}_src${i}`

    reqs.push(
      ...createRect(cardId, slideId, pos.x, pos.y, cardW, cardH, palette.primary),
      ...createRect(`${slideId}_crule${i}`, slideId, pos.x, pos.y, cardW, 8000, palette.accent),

      createTextBox(statId, slideId, pos.x + 80000, pos.y + 100000, cardW - 160000, 600000),
      insertText(statId, pp.stat),
      styleText(statId, { color: palette.accent, fontSize: 24, fontFamily: 'Montserrat', bold: true }),

      createTextBox(srcId, slideId, pos.x + 80000, pos.y + 700000, cardW - 160000, 400000),
      insertText(srcId, `${pp.source}${pp.context ? ` — ${pp.context}` : ''}`),
      styleText(srcId, { color: LTGRAY, fontSize: 12, fontFamily: 'Inter' }),
    )
  })

  reqs.push(...paramountFooter(slideId, palette))
  return reqs
}

/** Slide 8: From Idea to Cultural Moment — 3-step approach */
function howItWorksSlide(slideId: string, data: ProposalData, palette: SlidePalette, _opts: SlideOpts): object[] {
  const headId  = `${slideId}_head`
  const subId   = `${slideId}_sub`

  const steps = data.expanded?.approachSteps ?? [
    'Identify the cultural moment — match your brand to the right Paramount IP',
    'Design native integration — create content that belongs, not interrupts',
    'Amplify across platforms — CBS, Paramount+, social, in-store, shoppable',
  ]

  const stepW = Math.floor((FULL_W - 200000) / 3)
  const stepH = 2200000
  const stepY = 1300000

  const reqs: object[] = [
    bgFill(slideId, palette.primary),
    ...createRect(`${slideId}_bar`, slideId, 0, 0, W, 8000, palette.accent),

    createTextBox(subId, slideId, MARGIN_X, 300000, FULL_W, 160000),
    insertText(subId, 'THE ACTIVATION PLAYBOOK'),
    styleText(subId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 500000, FULL_W, 600000),
    insertText(headId, 'From Idea to Cultural Moment'),
    styleText(headId, { color: WHITE, fontSize: 38, fontFamily: 'Montserrat', bold: true }),
  ]

  steps.slice(0, 3).forEach((step, i) => {
    const stepX = MARGIN_X + i * (stepW + 100000)
    const numId = `${slideId}_num${i}`
    const cardId = `${slideId}_step${i}`
    const textId = `${slideId}_stext${i}`
    const stepTextW = stepW - 160000
    const stepTextH = stepH - 600000
    const stepFit = fitText(step, stepTextW, stepTextH, 14, 10)

    reqs.push(
      ...createRect(cardId, slideId, stepX, stepY, stepW, stepH, palette.primaryLighter),
      ...createRect(`${slideId}_srule${i}`, slideId, stepX, stepY, stepW, 8000, palette.accent),

      createTextBox(numId, slideId, stepX + 80000, stepY + 60000, 300000, 400000),
      insertText(numId, String(i + 1).padStart(2, '0')),
      styleText(numId, { color: palette.accent, fontSize: 32, fontFamily: 'Montserrat', bold: true }),

      createTextBox(textId, slideId, stepX + 80000, stepY + 500000, stepTextW, stepTextH),
      insertText(textId, stepFit.text),
      styleText(textId, { color: LTGRAY, fontSize: stepFit.fontSize, fontFamily: 'Inter' }),
    )
  })

  reqs.push(...paramountFooter(slideId, palette))
  return reqs
}

/** Slide 9: Your Opportunity with Paramount — bespoke client plan */
function customPlanSlide(slideId: string, data: ProposalData, palette: SlidePalette, _opts: SlideOpts): object[] {
  const headId  = `${slideId}_head`
  const subId   = `${slideId}_sub`
  const bodyId  = `${slideId}_body`

  const plan: CustomClientPlan | undefined = data.expanded?.customPlan
  const company = data.client.company

  const bullets: string[] = []
  if (plan) {
    if (plan.recommendedProperties?.length) bullets.push(`Properties: ${plan.recommendedProperties.join(', ')}`)
    if (plan.formats?.length) bullets.push(`Formats: ${plan.formats.join(', ')}`)
    if (plan.audienceMatch) bullets.push(`Audience: ${plan.audienceMatch}`)
    if (plan.timeline) bullets.push(`Timeline: ${plan.timeline}`)
  } else {
    bullets.push(
      'Tailored IP selection based on your audience demographics',
      'Custom integration formats designed for your brand',
      'Specific audience alignment with Paramount properties',
      'Activation timeline synced to your marketing calendar',
    )
  }

  return [
    bgFill(slideId, palette.primary),
    ...createRect(`${slideId}_bar`, slideId, 0, 0, W, 8000, palette.accent),

    createTextBox(subId, slideId, MARGIN_X, 300000, FULL_W, 160000),
    insertText(subId, `CUSTOM PLAN FOR ${company.toUpperCase()}`),
    styleText(subId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 500000, FULL_W, 700000),
    insertText(headId, `Your Opportunity with Paramount`),
    styleText(headId, { color: WHITE, fontSize: 36, fontFamily: 'Montserrat', bold: true }),

    ...createRect(`${slideId}_rule`, slideId, MARGIN_X, 1320000, FULL_W, 6000, palette.accent),

    createTextBox(bodyId, slideId, MARGIN_X + 80000, 1450000, FULL_W - 80000, 3000000),
    ...(() => {
      const fit = fitBullets(bullets, FULL_W - 80000, 3000000, 18, 10, 6)
      return fit.text ? [
        insertText(bodyId, fit.text),
        styleText(bodyId, { color: LTGRAY, fontSize: fit.fontSize, fontFamily: 'Inter' }),
        {
          createParagraphBullets: {
            objectId: bodyId,
            textRange: { type: 'ALL' },
            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
          },
        },
        paragraphSpacing(bodyId, { lineSpacing: 160, spaceBelow: 8 }),
      ] : []
    })(),

    ...paramountFooter(slideId, palette),
  ]
}

/** Slide 10: Investment vs Impact — ROI framing */
function roiFramingSlide(slideId: string, data: ProposalData, pm: ParamountMediaContent | undefined, palette: SlidePalette, _opts: SlideOpts): object[] {
  const headId  = `${slideId}_head`
  const subId   = `${slideId}_sub`

  const tiers = (pm?.investmentTiers || []).slice(0, 3)

  const reqs: object[] = [
    bgFill(slideId, palette.primary),
    ...createRect(`${slideId}_bar`, slideId, 0, 0, W, 8000, palette.accent),

    createTextBox(subId, slideId, MARGIN_X, 280000, FULL_W, 160000),
    insertText(subId, 'INVESTMENT VS IMPACT'),
    styleText(subId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 480000, FULL_W, 500000),
    insertText(headId, 'Investment vs Impact'),
    styleText(headId, { color: WHITE, fontSize: 36, fontFamily: 'Montserrat', bold: true }),
  ]

  if (tiers.length > 0) {
    const cardGap = 100000
    const cardW = Math.floor((FULL_W - cardGap * (tiers.length - 1)) / tiers.length)
    const cardHt = 2800000
    const cardYpos = 1200000

    tiers.forEach((tier: InvestmentTier, i) => {
      const cardX = MARGIN_X + i * (cardW + cardGap)
      const isFeature = i === 1
      const cardBg = isFeature ? palette.accent : palette.primaryLighter
      const nameColor = isFeature ? palette.primary : WHITE
      const budgColor = isFeature ? palette.primaryDarker : palette.accent
      const textColor = isFeature ? palette.primaryDarker : LTGRAY

      const cardId = `${slideId}_card${i}`
      const tierNameId = `${slideId}_tn${i}`
      const budgetId = `${slideId}_tb${i}`
      const inclId = `${slideId}_ti${i}`

      reqs.push(
        ...createRect(cardId, slideId, cardX, cardYpos, cardW, cardHt, cardBg),

        createTextBox(tierNameId, slideId, cardX + 80000, cardYpos + 120000, cardW - 160000, 280000),
        insertText(tierNameId, tier.tierName.toUpperCase()),
        styleText(tierNameId, { color: nameColor, fontSize: 14, fontFamily: 'Inter', bold: true }),
        paragraphAlign(tierNameId, 'CENTER'),

        createTextBox(budgetId, slideId, cardX + 60000, cardYpos + 440000, cardW - 120000, 400000),
        insertText(budgetId, tier.budget),
        styleText(budgetId, { color: budgColor, fontSize: 22, fontFamily: 'Montserrat', bold: true }),
        paragraphAlign(budgetId, 'CENTER'),
      )

      if (tier.inclusions && tier.inclusions.length > 0) {
        const inclW = cardW - 160000
        const inclH = cardHt - 1000000
        const inclFit = fitBullets(tier.inclusions, inclW, inclH, 12, 8, 6)
        if (inclFit.text) {
          reqs.push(
            createTextBox(inclId, slideId, cardX + 80000, cardYpos + 920000, inclW, inclH),
            insertText(inclId, inclFit.text),
            styleText(inclId, { color: textColor, fontSize: inclFit.fontSize, fontFamily: 'Inter' }),
            {
              createParagraphBullets: {
                objectId: inclId,
                textRange: { type: 'ALL' },
                bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
              },
            },
          )
        }
      }
    })
  } else {
    const bodyId = `${slideId}_body`
    const fallbackBullets = [
      `Reach: ${data.client.company} reaches its exact audience through Paramount's 200M+ monthly viewers`,
      'Engagement: Native integrations drive 3.2× higher recall than standard ads',
      'Conversion: QR, app, retail pathways connect cultural moments to measurable business outcomes',
    ]
    reqs.push(
      createTextBox(bodyId, slideId, MARGIN_X + 80000, 1300000, FULL_W - 80000, 3000000),
      insertText(bodyId, fallbackBullets.join('\n')),
      styleText(bodyId, { color: LTGRAY, fontSize: 18, fontFamily: 'Inter' }),
      {
        createParagraphBullets: {
          objectId: bodyId,
          textRange: { type: 'ALL' },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      },
      paragraphSpacing(bodyId, { lineSpacing: 160, spaceBelow: 8 }),
    )
  }

  reqs.push(...paramountFooter(slideId, palette))
  return reqs
}

// ---------------------------------------------------------------------------
// Paramount Media Sales slide builders (Dunkin-style deck)
// ---------------------------------------------------------------------------

/** Shared footer branding — adds "PARAMOUNT" in gold to the bottom of every slide */
function paramountFooter(slideId: string, palette: SlidePalette): object[] {
  const barId   = `${slideId}_pfooter_bar`
  const lblId   = `${slideId}_pfooter_lbl`
  return [
    ...createRect(barId, slideId, 0, H - 60000, W, 60000, palette.primaryDarker),
    createTextBox(lblId, slideId, MARGIN_X, H - 56000, FULL_W, 52000),
    insertText(lblId, 'PARAMOUNT  ·  ADVERTISING SOLUTIONS'),
    styleText(lblId, { color: palette.accent, fontSize: 8, fontFamily: 'Inter', bold: true }),
  ]
}

/** Slides 3 & 4: Paramount IP Alignment — split panel layout */
function ipAlignmentSlide(slideId: string, ip: IPAlignment, index: number, palette: SlidePalette): object[] {
  if (!ip) return []
  const splitX     = Math.round(W * 0.38)
  const leftLblId  = `${slideId}_llbl`
  const leftNetId  = `${slideId}_lnet`
  const leftShowId = `${slideId}_lshow`
  const rightLblId = `${slideId}_rlbl`
  const rightDescId= `${slideId}_rdesc`
  const rightStatId= `${slideId}_rstat`
  const divId      = `${slideId}_div`

  const nums = ['01', '02', '03', '04']

  return [
    bgFill(slideId, palette.primary),
    // Left dark accent panel
    ...createRect(`${slideId}_lpanel`, slideId, 0, 0, splitX, H, palette.primaryDarker),
    ...createRect(divId, slideId, splitX - 8000, 0, 8000, H, palette.accent),

    // Left: property number + network + show name
    createTextBox(leftLblId, slideId, MARGIN_X, 350000, splitX - MARGIN_X * 2, 200000),
    insertText(leftLblId, `PROPERTY ${nums[index] ?? '01'}`),
    styleText(leftLblId, { color: palette.accent, fontSize: 10, fontFamily: 'Inter', bold: true }),

    createTextBox(leftNetId, slideId, MARGIN_X, 600000, splitX - MARGIN_X * 2, 200000),
    insertText(leftNetId, ip.network.toUpperCase()),
    styleText(leftNetId, { color: LTGRAY, fontSize: 12, fontFamily: 'Inter', bold: true }),

    createTextBox(leftShowId, slideId, MARGIN_X, 850000, splitX - MARGIN_X * 2, 2000000),
    insertText(leftShowId, ip.propertyName),
    styleText(leftShowId, { color: WHITE, fontSize: 28, fontFamily: 'Montserrat', bold: true }),

    // Right: why this fits + audience stat
    createTextBox(rightLblId, slideId, splitX + MARGIN_X, 350000, W - splitX - MARGIN_X * 2, 200000),
    insertText(rightLblId, 'WHY THIS FITS'),
    styleText(rightLblId, { color: palette.accent, fontSize: 10, fontFamily: 'Inter', bold: true }),

    createTextBox(rightDescId, slideId, splitX + MARGIN_X, 600000, W - splitX - MARGIN_X * 2, 2400000),
    ...(ip.description ? [
      insertText(rightDescId, ip.description),
      styleText(rightDescId, { color: LTGRAY, fontSize: 17, fontFamily: 'Inter' }),
    ] : []),

    ...createRect(`${slideId}_statrule`, slideId, splitX + MARGIN_X, 3200000, W - splitX - MARGIN_X * 2, 4000, palette.accent),

    createTextBox(rightStatId, slideId, splitX + MARGIN_X, 3270000, W - splitX - MARGIN_X * 2, 400000),
    ...(ip.audienceStat ? [
      insertText(rightStatId, ip.audienceStat),
      styleText(rightStatId, { color: palette.accent, fontSize: 14, fontFamily: 'Inter', bold: true }),
    ] : []),

    ...paramountFooter(slideId, palette),
  ]
}

/** Slide 5: Gen Z Audience Intelligence — stat grid */
function audienceSlide(slideId: string, pm: ParamountMediaContent, data: ProposalData, palette: SlidePalette): object[] {
  const insights = (pm.audienceInsights || []).slice(0, 4)
  const labelId  = `${slideId}_label`
  const headId   = `${slideId}_head`

  const reqs: object[] = [
    bgFill(slideId, palette.primary),
    ...createRect(`${slideId}_bar`, slideId, 0, 0, W, 8000, palette.accent),

    createTextBox(labelId, slideId, MARGIN_X, 280000, FULL_W, 160000),
    insertText(labelId, `${data.client.company.toUpperCase()}  ·  AUDIENCE INTELLIGENCE`),
    styleText(labelId, { color: palette.accent, fontSize: 10, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 480000, FULL_W, 500000),
    insertText(headId, 'Why Your Audience Is Here'),
    styleText(headId, { color: WHITE, fontSize: 36, fontFamily: 'Montserrat', bold: true }),
  ]

  // 2×2 stat card grid
  const cardW  = FULL_W / 2 - 60000
  const cardH  = 1300000
  const startY = 1200000
  const positions = [
    { x: MARGIN_X, y: startY },
    { x: MARGIN_X + cardW + 120000, y: startY },
    { x: MARGIN_X, y: startY + cardH + 80000 },
    { x: MARGIN_X + cardW + 120000, y: startY + cardH + 80000 },
  ]

  insights.forEach((stat, i) => {
    const pos     = positions[i]
    const cardId  = `${slideId}_card${i}`
    const textId  = `${slideId}_ctext${i}`
    const ruleId  = `${slideId}_crule${i}`

    reqs.push(
      ...createRect(cardId, slideId, pos.x, pos.y, cardW, cardH, palette.primaryLighter),
      ...createRect(ruleId, slideId, pos.x, pos.y, cardW, 8000, palette.accent),
      createTextBox(textId, slideId, pos.x + 80000, pos.y + 100000, cardW - 160000, cardH - 150000),
      ...(stat ? [
        insertText(textId, stat),
        styleText(textId, { color: LTGRAY, fontSize: 14, fontFamily: 'Inter' }),
      ] : []),
    )
  })

  reqs.push(...paramountFooter(slideId, palette))
  return reqs
}

/** Slides 6 & 7: Integration Concepts — split layout */
function integrationConceptSlide(slideId: string, concept: IntegrationConcept, index: number, palette: SlidePalette): object[] {
  if (!concept) return []
  const splitX     = Math.round(W * 0.42)
  const numId      = `${slideId}_num`
  const leftTitleId= `${slideId}_ltitle`
  const leftPropId = `${slideId}_lprop`
  const rightLblId = `${slideId}_rlbl`
  const rightMechId= `${slideId}_rmech`
  const rightOutId = `${slideId}_rout`

  const nums = ['01', '02', '03']

  return [
    bgFill(slideId, WHITE),
    ...createRect(`${slideId}_lpanel`, slideId, 0, 0, splitX, H, palette.primary),
    ...createRect(`${slideId}_div`, slideId, splitX, 0, 12000, H, palette.accent),

    // Left: concept number + property
    createTextBox(numId, slideId, MARGIN_X, 280000, splitX - MARGIN_X * 2, 300000),
    insertText(numId, `INTEGRATION ${nums[index] ?? '01'}`),
    styleText(numId, { color: palette.accent, fontSize: 10, fontFamily: 'Inter', bold: true }),

    createTextBox(leftPropId, slideId, MARGIN_X, 600000, splitX - MARGIN_X * 2, 250000),
    insertText(leftPropId, concept.property.toUpperCase()),
    styleText(leftPropId, { color: LTGRAY, fontSize: 12, fontFamily: 'Inter', bold: true }),

    createTextBox(leftTitleId, slideId, MARGIN_X, 900000, splitX - MARGIN_X * 2, 2000000),
    insertText(leftTitleId, concept.conceptTitle),
    styleText(leftTitleId, { color: WHITE, fontSize: 24, fontFamily: 'Montserrat', bold: true }),

    // Right: mechanic + outcome
    createTextBox(rightLblId, slideId, splitX + MARGIN_X + 12000, 280000, W - splitX - MARGIN_X * 2 - 12000, 160000),
    insertText(rightLblId, 'THE ACTIVATION'),
    styleText(rightLblId, { color: palette.accent, fontSize: 10, fontFamily: 'Inter', bold: true }),

    createTextBox(rightMechId, slideId, splitX + MARGIN_X + 12000, 500000, W - splitX - MARGIN_X * 2 - 12000, 2500000),
    ...(concept.mechanic ? (() => {
      const mechW = W - splitX - MARGIN_X * 2 - 12000
      const mechFit = fitText(concept.mechanic, mechW, 2500000, 17, 10)
      return [
        insertText(rightMechId, mechFit.text),
        styleText(rightMechId, { color: palette.primary, fontSize: mechFit.fontSize, fontFamily: 'Inter' }),
      ]
    })() : []),

    ...createRect(`${slideId}_outrule`, slideId, splitX + MARGIN_X + 12000, 3200000, W - splitX - MARGIN_X * 2 - 12000, 4000, palette.primary),

    createTextBox(rightOutId, slideId, splitX + MARGIN_X + 12000, 3280000, W - splitX - MARGIN_X * 2 - 12000, 500000),
    ...(concept.outcome ? [
      insertText(rightOutId, `OUTCOME: ${concept.outcome}`),
      styleText(rightOutId, { color: palette.primary, fontSize: 12, fontFamily: 'Inter', bold: true }),
    ] : []),

    ...paramountFooter(slideId, palette),
  ]
}

/** Slide 8: Talent Partnerships */
function talentSlide(slideId: string, pm: ParamountMediaContent, palette: SlidePalette): object[] {
  const talent  = (pm.talentOpportunities || []).slice(0, 4)
  const labelId = `${slideId}_label`
  const headId  = `${slideId}_head`

  const reqs: object[] = [
    bgFill(slideId, palette.primary),
    ...createRect(`${slideId}_bar`, slideId, 0, 0, W, 8000, palette.accent),

    createTextBox(labelId, slideId, MARGIN_X, 300000, FULL_W, 160000),
    insertText(labelId, 'TALENT PARTNERSHIPS'),
    styleText(labelId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 500000, FULL_W, 500000),
    insertText(headId, 'Named Talent Opportunities'),
    styleText(headId, { color: WHITE, fontSize: 36, fontFamily: 'Montserrat', bold: true }),
  ]

  // Individual talent items with accent number
  talent.forEach((item, i) => {
    const y      = 1250000 + i * 780000
    const numId  = `${slideId}_tn${i}`
    const ruleId = `${slideId}_tr${i}`
    const txtId  = `${slideId}_tt${i}`

    reqs.push(
      createTextBox(numId, slideId, MARGIN_X, y, 350000, 600000),
      insertText(numId, String(i + 1).padStart(2, '0')),
      styleText(numId, { color: palette.accent, fontSize: 32, fontFamily: 'Montserrat', bold: true }),

      createTextBox(txtId, slideId, MARGIN_X + 420000, y + 80000, FULL_W - 420000, 520000),
      ...(item ? [
        insertText(txtId, item),
        styleText(txtId, { color: LTGRAY, fontSize: 16, fontFamily: 'Inter' }),
      ] : []),

      ...createRect(ruleId, slideId, MARGIN_X + 420000, y + 620000, FULL_W - 420000, 2000, palette.primaryLighter),
    )
  })

  reqs.push(...paramountFooter(slideId, palette))
  return reqs
}

/** Slide 9: Programming Calendar */
function programmingCalendarSlide(slideId: string, pm: ParamountMediaContent, palette: SlidePalette): object[] {
  const items   = (pm.programmingCalendar || []).slice(0, 5)
  const labelId = `${slideId}_label`
  const headId  = `${slideId}_head`

  const reqs: object[] = [
    bgFill(slideId, palette.primary),
    ...createRect(`${slideId}_bar`, slideId, 0, 0, W, 8000, palette.accent),

    createTextBox(labelId, slideId, MARGIN_X, 280000, FULL_W, 160000),
    insertText(labelId, 'PROGRAMMING CALENDAR 2026'),
    styleText(labelId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 480000, FULL_W, 460000),
    insertText(headId, 'Your Brand in the Cultural Moment'),
    styleText(headId, { color: WHITE, fontSize: 34, fontFamily: 'Montserrat', bold: true }),
  ]

  // Column headers
  const colXs   = [MARGIN_X, MARGIN_X + 2800000, MARGIN_X + 4200000, MARGIN_X + 5800000]
  const headers = ['TENTPOLE', 'DATE', 'REACH', 'YOUR OPPORTUNITY']
  const colWs   = [2600000, 1200000, 1400000, FULL_W - 5800000]

  reqs.push(...createRect(`${slideId}_hdr_rule`, slideId, MARGIN_X, 1070000, FULL_W, 4000, palette.accent))
  headers.forEach((h, i) => {
    const hId = `${slideId}_hdr${i}`
    reqs.push(
      createTextBox(hId, slideId, colXs[i], 1090000, colWs[i], 180000),
      insertText(hId, h),
      styleText(hId, { color: palette.accent, fontSize: 9, fontFamily: 'Inter', bold: true }),
    )
  })
  reqs.push(...createRect(`${slideId}_hdr_rule2`, slideId, MARGIN_X, 1280000, FULL_W, 2000, palette.primaryLighter))

  items.forEach((item, i) => {
    const rowY  = 1340000 + i * 640000
    const rowBg = i % 2 === 0 ? palette.primaryLighter : palette.primary

    reqs.push(...createRect(`${slideId}_rowbg${i}`, slideId, MARGIN_X - 60000, rowY - 40000, FULL_W + 120000, 600000, rowBg))

    const rowData: (CalendarItem[keyof CalendarItem])[] = [item.tentpole, item.date, item.reach, item.opportunity]
    rowData.forEach((val, j) => {
      const cId = `${slideId}_c${i}${j}`
      reqs.push(
        createTextBox(cId, slideId, colXs[j], rowY, colWs[j], 560000),
        ...(val ? [
          insertText(cId, String(val)),
          styleText(cId, { color: j === 0 ? WHITE : LTGRAY, fontSize: j === 0 ? 13 : 12, fontFamily: j === 0 ? 'Montserrat' : 'Inter', bold: j === 0 }),
        ] : []),
      )
    })
  })

  reqs.push(...paramountFooter(slideId, palette))
  return reqs
}

/** Slide 10: Measurement Framework */
function measurementSlide(slideId: string, pm: ParamountMediaContent, palette: SlidePalette): object[] {
  const items   = (pm.measurementFramework || []).slice(0, 4)
  const labelId = `${slideId}_label`
  const headId  = `${slideId}_head`

  const reqs: object[] = [
    bgFill(slideId, WHITE),
    ...createRect(`${slideId}_bar`, slideId, 0, 0, 12000, H, palette.accent),
    ...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 8000, palette.primary),

    createTextBox(labelId, slideId, MARGIN_X, 300000, FULL_W, 160000),
    insertText(labelId, `ACCOUNTABILITY & MEASUREMENT`),
    styleText(labelId, { color: palette.primary, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 500000, FULL_W, 500000),
    insertText(headId, 'We Prove It Works'),
    styleText(headId, { color: palette.primary, fontSize: 36, fontFamily: 'Montserrat', bold: true }),
  ]

  items.forEach((item, i) => {
    const cardX   = MARGIN_X + (i % 2) * (FULL_W / 2 + 80000)
    const cardY   = i < 2 ? 1250000 : 2700000
    const cardW   = FULL_W / 2 - 80000
    const cardH   = 1200000
    const cardId  = `${slideId}_card${i}`
    const textId  = `${slideId}_ctext${i}`

    reqs.push(
      ...createRect(cardId, slideId, cardX, cardY, cardW, cardH, palette.primary),
      ...createRect(`${slideId}_crule${i}`, slideId, cardX, cardY, cardW, 8000, palette.accent),
      createTextBox(textId, slideId, cardX + 80000, cardY + 120000, cardW - 160000, cardH - 160000),
      ...(item ? [
        insertText(textId, item),
        styleText(textId, { color: WHITE, fontSize: 14, fontFamily: 'Inter' }),
      ] : []),
    )
  })

  reqs.push(...paramountFooter(slideId, palette))
  return reqs
}

/** Slide 13: Appendix */
function appendixSlide(slideId: string, pm: ParamountMediaContent, palette: SlidePalette): object[] {
  const items   = pm.appendixItems || []
  const labelId = `${slideId}_label`
  const headId  = `${slideId}_head`
  const bodyId  = `${slideId}_body`

  return [
    bgFill(slideId, palette.primaryDarker),
    ...createRect(`${slideId}_bar`, slideId, 0, 0, W, 8000, palette.accent),

    createTextBox(labelId, slideId, MARGIN_X, 300000, FULL_W, 160000),
    insertText(labelId, 'APPENDIX'),
    styleText(labelId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 500000, FULL_W, 500000),
    insertText(headId, 'Supporting Data & Case Studies'),
    styleText(headId, { color: WHITE, fontSize: 34, fontFamily: 'Montserrat', bold: true }),

    createTextBox(bodyId, slideId, MARGIN_X + 80000, 1200000, FULL_W - 80000, 3400000),
    ...(() => {
      const fit = fitBullets(items, FULL_W - 80000, 3400000, 16, 10, 8)
      return fit.text ? [
        insertText(bodyId, fit.text),
        styleText(bodyId, { color: LTGRAY, fontSize: fit.fontSize, fontFamily: 'Inter' }),
        {
          createParagraphBullets: {
            objectId: bodyId,
            textRange: { type: 'ALL' },
            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
          },
        },
      ] : []
    })(),

    ...paramountFooter(slideId, palette),
  ]
}

// ---------------------------------------------------------------------------
// Logo helpers
// ---------------------------------------------------------------------------

const PARAMOUNT_AD_LOGO_URL = 'https://rfp-proposal-generator-kappa.vercel.app/paramount-advertising-logo.png'
// Google faviconV2 returns direct PNG at up to 256px — no redirects, reliable with Google Slides API.
// The older s2/favicons maxed at 128px. faviconV2 doubles the resolution at the same zero-auth cost.
// ClearBit's free logo API was deprecated (HubSpot acquisition) and now returns 302 redirects
// which the Google Slides createImage endpoint does not follow, resulting in blank images.
const FAVICON_V2 = 'https://t1.gstatic.com/faviconV2'

function logoUrl(domain: string): string {
  return `${FAVICON_V2}?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=256`
}

function getClientDomain(data: ProposalData): string | null {
  if (data.client.companyDomain) return data.client.companyDomain
  const guess = data.client.company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
  return guess || null
}

function logoRequests(coverSlideId: string, closeSlideId: string, data: ProposalData): object[] {
  const reqs: object[] = []
  // LOGO_SIZE and LOGO_X are module-level constants derived from the panel layout,
  // keeping Phase 3 images pixel-perfect with Phase 2 labels and divider.

  const clientDomain = getClientDomain(data)

  if (clientDomain) {
    // Client logo — aligned to the label drawn above it in Phase 2
    reqs.push(
      createImageReq(
        `${coverSlideId}_clogo`, coverSlideId,
        logoUrl(clientDomain),
        LOGO_X, COVER_CLOGO_Y, LOGO_SIZE, LOGO_SIZE,
      ),
    )
  }

  // Paramount Advertising logo — full branded image replaces small favicon
  const paramLogoW = 2000000
  const paramLogoH = 1600000
  const paramLogoX = PANEL_X + Math.round((PANEL_W - paramLogoW) / 2)
  reqs.push(
    createImageReq(
      `${coverSlideId}_plogo`, coverSlideId,
      PARAMOUNT_AD_LOGO_URL,
      paramLogoX, COVER_PLOGO_Y, paramLogoW, paramLogoH,
    ),
  )

  // Paramount Advertising logo on closing slide (centered, above the bracketing rules)
  const closeLogoW = 1800000
  const closeLogoH = 1440000
  reqs.push(
    createImageReq(
      `${closeSlideId}_plogo`, closeSlideId,
      PARAMOUNT_AD_LOGO_URL,
      Math.round(W / 2 - closeLogoW / 2), 700000, closeLogoW, closeLogoH,
    ),
  )

  return reqs
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function createGoogleSlidesPresentation(
  data: ProposalData,
  getToken: TokenGetter,
  designConfig?: DesignConfig,
): Promise<CreateSlidesResult> {
  const hasParamountMedia = !!data.expanded?.paramountMedia?.opportunityStatement
  const defaultTheme = hasParamountMedia ? 'paramount' : 'navy-gold'

  const palette = designConfig?.customBrandHex
    ? derivePaletteFromHex(designConfig.customBrandHex)
    : (!designConfig?.disableBrandDetection ? getBrandPalette(data.client.company) : null)
      ?? PALETTE_MAP[designConfig?.colorTheme ?? defaultTheme]
      ?? PALETTE_MAP[defaultTheme]

  const designStyle = designConfig?.designStyle ?? 'standard'
  const opts: SlideOpts = {
    boldAgency: designStyle === 'bold-agency',
    minimal:    designStyle === 'executive-minimal',
  }

  const makeHeaders = (token: string) => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  })

  // Phase 1: Create empty presentation (with retry)
  const { presentationId, defaultSlideId } = await withBackoff(
    async (token) => {
      const createResp = await fetch(SLIDES_API, {
        method: 'POST',
        headers: makeHeaders(token),
        body: JSON.stringify({ title: data.project.title }),
      })
      if (!createResp.ok) throw await toApiError(createResp)
      const pres = await createResp.json()
      return {
        presentationId: pres.presentationId as string,
        defaultSlideId: pres.slides?.[0]?.objectId as string,
      }
    },
    getToken,
  )

  const p  = data
  const e  = data.expanded
  const pm = e.paramountMedia

  let orderedSlides: { id: string; reqs: () => object[] }[]

  const deckType = e.deckType ?? (hasParamountMedia ? 'paramount-rfp' : 'generic')

  if (deckType === 'paramount-rfp' && hasParamountMedia && pm) {
    // ── Paramount Persuasion-Engine Deck ──────────────────────────────────
    const ip0  = pm.paramountIPAlignments?.[0]
    const ip1  = pm.paramountIPAlignments?.[1]
    const con0 = pm.integrationConcepts?.[0]
    const con1 = pm.integrationConcepts?.[1]

    orderedSlides = [
      { id: 'pm01_cover',      reqs: () => titleSlide('pm01_cover', p, palette) },
      { id: 'pm02_culture',    reqs: () => culturalShiftSlide('pm02_culture', p, palette, opts) },
      { id: 'pm03_problem',    reqs: () => realProblemSlide('pm03_problem', p, palette, opts) },
      { id: 'pm04_cost',       reqs: () => costSlide('pm04_cost', p, palette, opts) },
      { id: 'pm05_insight',    reqs: () => coreInsightSlide('pm05_insight', p, palette, opts) },
      { id: 'pm06_advantage',  reqs: () => paramountAdvantageSlide('pm06_advantage', pm, p, palette, opts) },
      ...(ip0 ? [{ id: 'pm07_ip1', reqs: () => ipAlignmentSlide('pm07_ip1', ip0, 0, palette) }] : []),
      ...(ip1 ? [{ id: 'pm08_ip2', reqs: () => ipAlignmentSlide('pm08_ip2', ip1, 1, palette) }] : []),
      { id: 'pm09_proof',      reqs: () => proofSlide('pm09_proof', p, palette, opts) },
      { id: 'pm10_howit',      reqs: () => howItWorksSlide('pm10_howit', p, palette, opts) },
      ...(con0 ? [{ id: 'pm11_con1', reqs: () => integrationConceptSlide('pm11_con1', con0, 0, palette) }] : []),
      ...(con1 ? [{ id: 'pm12_con2', reqs: () => integrationConceptSlide('pm12_con2', con1, 1, palette) }] : []),
      { id: 'pm13_plan',       reqs: () => customPlanSlide('pm13_plan', p, palette, opts) },
      { id: 'pm14_audience',   reqs: () => audienceSlide('pm14_audience', pm, p, palette) },
      { id: 'pm15_talent',     reqs: () => talentSlide('pm15_talent', pm, palette) },
      { id: 'pm16_calendar',   reqs: () => programmingCalendarSlide('pm16_calendar', pm, palette) },
      { id: 'pm17_roi',        reqs: () => roiFramingSlide('pm17_roi', p, pm, palette, opts) },
      { id: 'pm18_measure',    reqs: () => measurementSlide('pm18_measure', pm, palette) },
      { id: 'pm19_next',       reqs: () => nextStepsSlide('pm19_next', { ...p, expanded: { ...e, nextSteps: pm.nextSteps } }, palette, opts) },
      { id: 'pm20_close',      reqs: () => closingSlide('pm20_close', p, palette, opts) },
      { id: 'pm21_appendix',   reqs: () => appendixSlide('pm21_appendix', pm, palette) },
      ...(e.additionalSlides ?? []).map((s, i) => {
        const key = `additional_${i}`
        const slideId = `pm_add${i}`
        const resolvedTitle = e.customTitles?.[key] ?? s.title
        return {
          id: slideId,
          reqs: () => additionalContentSlide(slideId, resolvedTitle, s.bullets ?? [], palette, opts),
        }
      }),
    ].filter(s => s.reqs().length > 0)

  } else if (deckType === 'paramount-showcase' && e.showcaseContent) {
    // ── Paramount Showcase Deck (free-form IP/portfolio request) ───────────
    const sc: ShowcaseContent = e.showcaseContent

    orderedSlides = [
      // Cover slide using the showcase title
      {
        id: 'sc01_cover',
        reqs: () => titleSlide('sc01_cover', {
          ...p,
          project: { ...p.project, title: sc.showcaseTitle },
        }, palette),
      },
      // Content slides — each FlexibleSlide becomes an additionalContentSlide
      ...sc.slides.map((s: FlexibleSlide, i: number) => {
        const slideId = `sc${String(i + 2).padStart(2, '0')}_${s.slideKey}`
        return {
          id: slideId,
          reqs: () => additionalContentSlide(slideId, s.title, s.bullets ?? [], palette, opts),
        }
      }),
      // Audience insights slide
      ...(sc.audienceInsights && sc.audienceInsights.length > 0 ? [{
        id: 'sc_audience',
        reqs: () => additionalContentSlide('sc_audience', 'Audience Insights', sc.audienceInsights!, palette, opts),
      }] : []),
      // Measurement slide
      ...(sc.measurementFramework && sc.measurementFramework.length > 0 ? [{
        id: 'sc_measure',
        reqs: () => additionalContentSlide('sc_measure', 'Measurement Framework', sc.measurementFramework!, palette, opts),
      }] : []),
      // User-added additional slides
      ...(e.additionalSlides ?? []).map((s, i) => {
        const key = `additional_${i}`
        const slideId = `sc_add${i}`
        const resolvedTitle = e.customTitles?.[key] ?? s.title
        return {
          id: slideId,
          reqs: () => additionalContentSlide(slideId, resolvedTitle, s.bullets ?? [], palette, opts),
        }
      }),
    ].filter(s => s.reqs().length > 0)

  } else if (deckType === 'generic' && e.flexibleSlides && e.flexibleSlides.length > 0) {
    // ── Generic Flexible Deck (free-form non-Paramount request) ────────────
    orderedSlides = [
      { id: 'gn01_cover', reqs: () => titleSlide('gn01_cover', p, palette) },
      ...e.flexibleSlides!.map((s: FlexibleSlide, i: number) => {
        const slideId = `gn${String(i + 2).padStart(2, '0')}_${s.slideKey}`
        return {
          id: slideId,
          reqs: () => additionalContentSlide(slideId, s.title, s.bullets ?? [], palette, opts),
        }
      }),
      ...(e.additionalSlides ?? []).map((s, i) => {
        const key = `additional_${i}`
        const slideId = `gn_add${i}`
        const resolvedTitle = e.customTitles?.[key] ?? s.title
        return {
          id: slideId,
          reqs: () => additionalContentSlide(slideId, resolvedTitle, s.bullets ?? [], palette, opts),
        }
      }),
    ].filter(s => s.reqs().length > 0)

  } else {
    // ── Persuasion-Engine Consulting Deck (structured RFP) ──────────────────
    const hasNextSteps = (e.nextSteps?.length ?? 0) > 0

    orderedSlides = [
      { id: 's01_cover',    reqs: () => titleSlide('s01_cover', p, palette) },
      { id: 's02_culture',  reqs: () => culturalShiftSlide('s02_culture', p, palette, opts) },
      { id: 's03_problem',  reqs: () => realProblemSlide('s03_problem', p, palette, opts) },
      { id: 's04_cost',     reqs: () => costSlide('s04_cost', p, palette, opts) },
      { id: 's05_insight',  reqs: () => coreInsightSlide('s05_insight', p, palette, opts) },
      { id: 's06_advantage',reqs: () => paramountAdvantageSlide('s06_advantage', undefined, p, palette, opts) },
      { id: 's07_proof',    reqs: () => proofSlide('s07_proof', p, palette, opts) },
      { id: 's08_howit',    reqs: () => howItWorksSlide('s08_howit', p, palette, opts) },
      { id: 's09_plan',     reqs: () => customPlanSlide('s09_plan', p, palette, opts) },
      { id: 's10_roi',      reqs: () => roiFramingSlide('s10_roi', p, undefined, palette, opts) },
      ...(hasNextSteps ? [{ id: 's11_next', reqs: () => nextStepsSlide('s11_next', p, palette, opts) }] : []),
      { id: 's12_close',    reqs: () => closingSlide('s12_close', p, palette, opts) },
      ...(e.additionalSlides ?? []).map((s, i) => {
        const key = `additional_${i}`
        const slideId = `s_add${i}`
        const resolvedTitle = e.customTitles?.[key] ?? s.title
        return {
          id: slideId,
          reqs: () => additionalContentSlide(slideId, resolvedTitle, s.bullets ?? [], palette, opts),
        }
      }),
    ].filter(s => {
      const r = s.reqs()
      return r.length > 0
    })
  }

  const slideRequests: object[] = []

  if (defaultSlideId) {
    slideRequests.push({ deleteObject: { objectId: defaultSlideId } })
  }

  orderedSlides.forEach((slide, i) => {
    slideRequests.push({
      createSlide: {
        objectId: slide.id,
        insertionIndex: i,
        slideLayoutReference: { predefinedLayout: 'BLANK' },
      },
    })
  })

  const populationRequests: object[] = orderedSlides.flatMap(s => s.reqs())

  await withBackoff(async (token) => {
    const batchResp = await fetch(`${SLIDES_API}/${presentationId}:batchUpdate`, {
      method: 'POST',
      headers: makeHeaders(token),
      body: JSON.stringify({ requests: [...slideRequests, ...populationRequests] }),
    })
    if (!batchResp.ok) throw await toApiError(batchResp)
  }, getToken)

  // Phase 3: Insert logos (separate request so failures don't break the deck)
  const coverSlideId = orderedSlides[0].id
  const closeSlideId = orderedSlides[orderedSlides.length - 1]?.id ?? 's13_close'
  try {
    const freshToken = await getToken()
    const logoReqs = logoRequests(coverSlideId, closeSlideId, p)
    if (logoReqs.length > 0) {
      const logoResp = await fetch(`${SLIDES_API}/${presentationId}:batchUpdate`, {
        method: 'POST',
        headers: makeHeaders(freshToken),
        body: JSON.stringify({ requests: logoReqs }),
      })
      if (!logoResp.ok) {
        const logoErr = await logoResp.json().catch(() => ({}))
        console.warn('[Slides] Logo insertion failed:', (logoErr as Record<string, Record<string, string>>)?.error?.message || logoResp.statusText)
      }
    }
  } catch (e) {
    console.warn('[Slides] Logo insertion error:', e)
  }

  return {
    presentationId,
    presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
    title: data.project.title,
  }
}
