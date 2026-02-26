/**
 * Google Slides REST API integration
 *
 * Two-phase approach:
 *   1. POST /v1/presentations — create empty presentation
 *   2. POST /v1/presentations/{id}:batchUpdate — build all slides in one atomic request
 *
 * No Vite proxy needed — Google Slides API supports CORS with OAuth Bearer tokens.
 */

import type { ProposalData, DesignConfig } from '../types/proposal'

const SLIDES_API = 'https://slides.googleapis.com/v1/presentations'

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
const COVER_PLABEL_Y = 2682750             // "PARAMOUNT" label
const COVER_PLOGO_Y  = 2922750             // Paramount logo image

/** Slide 1: Title / Cover */
function titleSlide(slideId: string, data: ProposalData, palette: SlidePalette): object[] {
  const panelId       = `${slideId}_panel`
  const vlineId       = `${slideId}_vline`
  const clientLblId   = `${slideId}_clbl`
  const panelDivId    = `${slideId}_pdiv`
  const partnerLblId  = `${slideId}_plbl`
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
    insertText(clientLblId, data.client.company.toUpperCase()),
    styleText(clientLblId, { color: GRAY, fontSize: 10, fontFamily: 'Inter', bold: true }),
    paragraphAlign(clientLblId, 'CENTER'),

    // Panel: thin accent horizontal rule between the two logos
    ...createRect(panelDivId, slideId, PANEL_X + 300000, COVER_DIV_Y, PANEL_W - 600000, 12000, palette.accent),

    // Panel: "PARAMOUNT" label (above Paramount logo placeholder)
    createTextBox(partnerLblId, slideId, labelX, COVER_PLABEL_Y, labelW, 180000),
    insertText(partnerLblId, 'PARAMOUNT'),
    styleText(partnerLblId, { color: palette.accent, fontSize: 10, fontFamily: 'Inter', bold: true }),
    paragraphAlign(partnerLblId, 'CENTER'),

    // Left content zone — constrained to CONTENT_W so text stays clear of the panel
    createTextBox(eyebrowId, slideId, MARGIN_X, 180000, CONTENT_W, 200000),
    insertText(eyebrowId, 'PARAMOUNT'),
    styleText(eyebrowId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    // Hero brand line — 52pt, wraps cleanly to 2 lines inside the content zone
    createTextBox(heroId, slideId, MARGIN_X, 600000, CONTENT_W, 1700000),
    insertText(heroId, `${data.client.company} \u00d7 Paramount`),
    styleText(heroId, { color: WHITE, fontSize: 52, fontFamily: 'Montserrat', bold: true }),

    // Project title (supporting, smaller)
    createTextBox(titleId, slideId, MARGIN_X, 2400000, CONTENT_W, 500000),
    insertText(titleId, data.project.title),
    styleText(titleId, { color: GRAY, fontSize: 22, fontFamily: 'Inter' }),

    // Thin accent divider rule
    ...createRect(ruleId, slideId, MARGIN_X, 2960000, CONTENT_W, 18000, palette.accent),

    // Date line
    createTextBox(dateId, slideId, MARGIN_X, 3040000, CONTENT_W, 280000),
    insertText(dateId, `Prepared for ${data.client.company}  \u00b7  ${data.generated.createdDate}`),
    styleText(dateId, { color: GRAY, fontSize: 14, fontFamily: 'Inter' }),
  ]
}

/** Slide 2: The Challenge — bullet list of problems */
function challengeSlide(slideId: string, data: ProposalData, palette: SlidePalette): object[] {
  const headId   = `${slideId}_head`
  const bodyId   = `${slideId}_body`
  const barId    = `${slideId}_bar`
  const accentId = `${slideId}_accent`
  const problems = data.content.problems.filter(p => p.trim())

  return [
    bgFill(slideId, WHITE),
    ...createRect(barId,    slideId, 0, H - 50000, W, 50000, palette.accent),
    // Thin left accent bar echoing the problem deep-dive slides
    ...createRect(accentId, slideId, 0, 0, 12000, H, palette.accent),

    createTextBox(headId, slideId, MARGIN_X, MARGIN_TOP, FULL_W, 600000),
    insertText(headId, 'The Challenge'),
    styleText(headId, { color: palette.primary, fontSize: 36, fontFamily: 'Montserrat', bold: true }),

    // Shifted right to clear the left accent bar, with extra top spacing
    createTextBox(bodyId, slideId, MARGIN_X + 80000, 1100000, FULL_W - 80000, 3500000),
    insertText(bodyId, problems.join('\n')),
    styleText(bodyId, { color: palette.primary, fontSize: 20, fontFamily: 'Inter' }),
    {
      createParagraphBullets: {
        objectId: bodyId,
        textRange: { type: 'ALL' },
        bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
      },
    },
  ]
}

/** Slide 3 / 4: Problem deep dive — headline + expanded copy */
function problemDeepDive(
  slideId: string,
  label: string,
  headline: string,
  body: string,
  palette: SlidePalette,
  accent = true
): object[] {
  const labelId = `${slideId}_label`
  const headId  = `${slideId}_head`
  const bodyId  = `${slideId}_body`
  const barId   = `${slideId}_bar`
  const accentId = `${slideId}_accent`

  const xOff = accent ? 80000 : 0
  const reqs: object[] = [
    bgFill(slideId, WHITE),
    ...createRect(barId, slideId, 0, H - 50000, W, 50000, palette.primary),
  ]

  if (accent) {
    reqs.push(...createRect(accentId, slideId, 0, 0, 20000, H, palette.accent))
  } else {
    // Hairline accent top bar on benefit slides
    reqs.push(...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 8000, palette.accent))
  }

  reqs.push(
    createTextBox(labelId, slideId, MARGIN_X + xOff, 300000, FULL_W, 180000),
    ...(label ? [insertText(labelId, label), styleText(labelId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true })] : []),

    // Taller headline box so multi-line headlines don't crowd the body
    createTextBox(headId, slideId, MARGIN_X + xOff, 520000, FULL_W - xOff, 1100000),
    ...(headline ? [insertText(headId, headline), styleText(headId, { color: palette.primary, fontSize: 24, fontFamily: 'Montserrat', bold: true })] : []),

    // Body pushed down to give headline breathing room
    createTextBox(bodyId, slideId, MARGIN_X + xOff, 1750000, FULL_W - xOff, 3000000),
    ...(body ? [insertText(bodyId, body), styleText(bodyId, { color: { red: 0.25, green: 0.28, blue: 0.38 }, fontSize: 16, fontFamily: 'Inter' })] : []),
  )

  return reqs
}

/** Slide 5: Problems 3 & 4 combined */
function problemsCombined(slideId: string, data: ProposalData, palette: SlidePalette): object[] {
  const head1Id = `${slideId}_h1`
  const body1Id = `${slideId}_b1`
  const head2Id = `${slideId}_h2`
  const body2Id = `${slideId}_b2`
  const barId   = `${slideId}_bar`
  const divId   = `${slideId}_div`

  const p3 = data.content.problems[2] || ''
  const p4 = data.content.problems[3] || ''
  const e3 = data.expanded.problemExpansions[2] || ''
  const e4 = data.expanded.problemExpansions[3] || ''

  const colW = W / 2 - MARGIN_X - 80000

  return [
    bgFill(slideId, WHITE),
    ...createRect(barId, slideId, 0, H - 50000, W, 50000, palette.primary),
    ...createRect(divId, slideId, W / 2 - 15000, MARGIN_TOP, 30000, H - MARGIN_TOP - 50000, { red: 0.9, green: 0.91, blue: 0.93 }),

    createTextBox(head1Id, slideId, MARGIN_X, MARGIN_TOP, colW, 700000),
    ...(p3 ? [insertText(head1Id, p3), styleText(head1Id, { color: palette.primary, fontSize: 20, fontFamily: 'Montserrat', bold: true })] : []),

    createTextBox(body1Id, slideId, MARGIN_X, 1300000, colW, 3300000),
    ...(e3 ? [insertText(body1Id, e3), styleText(body1Id, { color: { red: 0.25, green: 0.28, blue: 0.38 }, fontSize: 14, fontFamily: 'Inter' })] : []),

    createTextBox(head2Id, slideId, W / 2 + 80000, MARGIN_TOP, colW, 700000),
    ...(p4 ? [insertText(head2Id, p4), styleText(head2Id, { color: palette.primary, fontSize: 20, fontFamily: 'Montserrat', bold: true })] : []),

    createTextBox(body2Id, slideId, W / 2 + 80000, 1300000, colW, 3300000),
    ...(e4 ? [insertText(body2Id, e4), styleText(body2Id, { color: { red: 0.25, green: 0.28, blue: 0.38 }, fontSize: 14, fontFamily: 'Inter' })] : []),
  ]
}

/** Slide 6: The Solution — bullet list of benefits */
function solutionSlide(slideId: string, data: ProposalData, palette: SlidePalette): object[] {
  const headId    = `${slideId}_head`
  const bodyId    = `${slideId}_body`
  const barId     = `${slideId}_bar`
  const ellipseId = `${slideId}_ellipse`
  const benefits = data.content.benefits.filter(b => b.trim())

  return [
    bgFill(slideId, palette.primary),
    // Decorative ellipse bleeds off top-right corner for visual depth
    ...createEllipse(ellipseId, slideId, W - 1800000, -300000, 2400000, 2400000, palette.primaryLighter),
    ...createRect(barId, slideId, 0, H - 50000, W, 50000, palette.accent),

    createTextBox(headId, slideId, MARGIN_X, MARGIN_TOP, FULL_W, 500000),
    insertText(headId, 'The Solution'),
    styleText(headId, { color: palette.accent, fontSize: 36, fontFamily: 'Montserrat', bold: true }),

    createTextBox(bodyId, slideId, MARGIN_X, 1050000, FULL_W, 3500000),
    insertText(bodyId, benefits.join('\n')),
    styleText(bodyId, { color: WHITE, fontSize: 20, fontFamily: 'Inter' }),
    {
      createParagraphBullets: {
        objectId: bodyId,
        textRange: { type: 'ALL' },
        bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
      },
    },
  ]
}

/** Slide 9: Investment & Timeline */
function investmentSlide(slideId: string, data: ProposalData, palette: SlidePalette): object[] {
  const headId   = `${slideId}_head`
  const totalId  = `${slideId}_total`
  const timeId   = `${slideId}_time`
  const m1Id     = `${slideId}_m1`
  const m2Id     = `${slideId}_m2`
  const m3Id     = `${slideId}_m3`
  const barId    = `${slideId}_bar`

  return [
    bgFill(slideId, LTGRAY),
    ...createRect(barId, slideId, 0, H - 50000, W, 50000, palette.primary),

    createTextBox(headId, slideId, MARGIN_X, MARGIN_TOP, FULL_W, 500000),
    insertText(headId, 'Investment & Timeline'),
    styleText(headId, { color: palette.primary, fontSize: 36, fontFamily: 'Montserrat', bold: true }),

    createTextBox(totalId, slideId, MARGIN_X, 1050000, FULL_W / 2, 400000),
    insertText(totalId, `Total Investment: ${data.project.totalValue}`),
    styleText(totalId, { color: palette.accent, fontSize: 24, fontFamily: 'Inter', bold: true }),

    createTextBox(timeId, slideId, MARGIN_X, 1550000, FULL_W / 2, 300000),
    insertText(timeId, `Timeline: ${data.project.duration}`),
    styleText(timeId, { color: palette.primary, fontSize: 18, fontFamily: 'Inter' }),

    createTextBox(m1Id, slideId, MARGIN_X, 2100000, FULL_W, 300000),
    insertText(m1Id, `Month 1: ${data.project.monthOneInvestment}`),
    styleText(m1Id, { color: palette.primary, fontSize: 16, fontFamily: 'Inter' }),

    createTextBox(m2Id, slideId, MARGIN_X, 2500000, FULL_W, 300000),
    insertText(m2Id, `Month 2: ${data.project.monthTwoInvestment}`),
    styleText(m2Id, { color: palette.primary, fontSize: 16, fontFamily: 'Inter' }),

    createTextBox(m3Id, slideId, MARGIN_X, 2900000, FULL_W, 300000),
    insertText(m3Id, `Month 3: ${data.project.monthThreeInvestment}`),
    styleText(m3Id, { color: palette.primary, fontSize: 16, fontFamily: 'Inter' }),
  ]
}

/** Slide 10: Close / CTA */
function closingSlide(slideId: string, data: ProposalData, palette: SlidePalette): object[] {
  const headId   = `${slideId}_head`
  const footerId = `${slideId}_footer`
  const barId    = `${slideId}_bar`
  const rule1Id  = `${slideId}_rule1`
  const rule2Id  = `${slideId}_rule2`

  return [
    bgFill(slideId, palette.primary),
    ...createRect(barId, slideId, 0, H - 80000, W, 80000, palette.primaryDarker),

    // Thin accent rules bracket the CTA text (logo sits above them, inserted in Phase 3)
    ...createRect(rule1Id, slideId, MARGIN_X, 1280000, FULL_W, 6000, palette.accent),
    ...createRect(rule2Id, slideId, MARGIN_X, 2300000, FULL_W, 6000, palette.accent),

    createTextBox(headId, slideId, MARGIN_X, 1400000, FULL_W, 800000),
    insertText(headId, `Let's build this together, ${data.client.firstName}.`),
    styleText(headId, { color: palette.accent, fontSize: 40, fontFamily: 'Montserrat', bold: true }),
    paragraphAlign(headId, 'CENTER'),

    createTextBox(footerId, slideId, MARGIN_X, H - 200000, FULL_W, 150000),
    insertText(footerId, data.generated.slideFooter),
    styleText(footerId, { color: GRAY, fontSize: 11, fontFamily: 'Inter' }),
    paragraphAlign(footerId, 'CENTER'),
  ]
}

// ---------------------------------------------------------------------------
// Logo helpers
// ---------------------------------------------------------------------------

const PARAMOUNT_DOMAIN = 'paramount.com'
// Google's favicon service returns direct PNG (no redirect) — reliable with Google Slides API.
// ClearBit's free logo API was deprecated after HubSpot acquisition and now returns 302
// redirects which the Google Slides createImage endpoint does not follow, resulting in blank images.
const FAVICON_API = 'https://www.google.com/s2/favicons'

function logoUrl(domain: string): string {
  return `${FAVICON_API}?domain=${domain}&sz=128`
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

  // Paramount logo — aligned to its label and divider drawn in Phase 2
  reqs.push(
    createImageReq(
      `${coverSlideId}_plogo`, coverSlideId,
      logoUrl(PARAMOUNT_DOMAIN),
      LOGO_X, COVER_PLOGO_Y, LOGO_SIZE, LOGO_SIZE,
    ),
  )

  // Paramount logo on closing slide (centered, above the bracketing rules)
  const closeLogoSize = 686000
  reqs.push(
    createImageReq(
      `${closeSlideId}_plogo`, closeSlideId,
      logoUrl(PARAMOUNT_DOMAIN),
      Math.round(W / 2 - closeLogoSize / 2), 800000, closeLogoSize, closeLogoSize,
    ),
  )

  return reqs
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function createGoogleSlidesPresentation(
  data: ProposalData,
  accessToken: string,
  designConfig?: DesignConfig
): Promise<CreateSlidesResult> {
  const palette = PALETTE_MAP[designConfig?.colorTheme ?? 'navy-gold'] ?? PALETTE_MAP['navy-gold']

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  }

  // Phase 1: Create empty presentation
  const createResp = await fetch(SLIDES_API, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: data.project.title }),
  })

  if (!createResp.ok) {
    const err = await createResp.json().catch(() => ({}))
    throw new Error(`Failed to create presentation: ${err?.error?.message || createResp.statusText}`)
  }

  const presentation = await createResp.json()
  const presentationId: string = presentation.presentationId
  const defaultSlideId: string = presentation.slides?.[0]?.objectId

  // Phase 2: Build all slides via batchUpdate
  const slideIds = [
    's01_cover', 's02_challenge', 's03_prob1', 's04_prob2',
    's05_prob34', 's06_solution', 's07_ben1', 's08_ben23',
    's09_invest', 's10_close',
  ]

  const p = data
  const e = data.expanded

  const slideRequests: object[] = []

  if (defaultSlideId) {
    slideRequests.push({ deleteObject: { objectId: defaultSlideId } })
  }

  for (let i = 0; i < slideIds.length; i++) {
    slideRequests.push({
      createSlide: {
        objectId: slideIds[i],
        insertionIndex: i,
        slideLayoutReference: { predefinedLayout: 'BLANK' },
      },
    })
  }

  const populationRequests: object[] = [
    ...titleSlide(slideIds[0], p, palette),
    ...challengeSlide(slideIds[1], p, palette),
    ...problemDeepDive(slideIds[2], 'CHALLENGE 01', p.content.problems[0] || '', e.problemExpansions[0] || '', palette),
    ...problemDeepDive(slideIds[3], 'CHALLENGE 02', p.content.problems[1] || '', e.problemExpansions[1] || '', palette),
    ...problemsCombined(slideIds[4], p, palette),
    ...solutionSlide(slideIds[5], p, palette),
    ...problemDeepDive(slideIds[6], 'BENEFIT 01', p.content.benefits[0] || '', e.benefitExpansions[0] || '', palette, false),
    ...problemDeepDive(slideIds[7], 'BENEFIT 02', p.content.benefits[1] || '', e.benefitExpansions[1] || '', palette, false),
    ...investmentSlide(slideIds[8], p, palette),
    ...closingSlide(slideIds[9], p, palette),
  ]

  const batchResp = await fetch(`${SLIDES_API}/${presentationId}:batchUpdate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ requests: [...slideRequests, ...populationRequests] }),
  })

  if (!batchResp.ok) {
    const err = await batchResp.json().catch(() => ({}))
    throw new Error(`Failed to build slides: ${err?.error?.message || batchResp.statusText}`)
  }

  // Phase 3: Insert logos (separate request so failures don't break the deck)
  try {
    const logoReqs = logoRequests(slideIds[0], slideIds[9], p)
    if (logoReqs.length > 0) {
      const logoResp = await fetch(`${SLIDES_API}/${presentationId}:batchUpdate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ requests: logoReqs }),
      })
      if (!logoResp.ok) {
        const logoErr = await logoResp.json().catch(() => ({}))
        console.warn('[Slides] Logo insertion failed:', logoErr?.error?.message || logoResp.statusText)
      }
    }
  } catch (e) {
    // Logo insertion is best-effort — don't throw, but log so it's diagnosable
    console.warn('[Slides] Logo insertion error:', e)
  }

  return {
    presentationId,
    presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
    title: data.project.title,
  }
}
