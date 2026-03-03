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
import { getBrandPalette } from './brandColors'

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
  // Option 3: Executive Minimal — near-black with warm platinum accent
  'executive-dark': {
    primary:        { red: 0.055, green: 0.055, blue: 0.065 },  // #0E0E10 near-black
    primaryLighter: { red: 0.12,  green: 0.12,  blue: 0.14  },  // dark charcoal (hairline rules)
    primaryDarker:  { red: 0.03,  green: 0.03,  blue: 0.04  },  // deepest tone
    accent:         { red: 0.85,  green: 0.82,  blue: 0.75  },  // warm platinum/champagne
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
// Layout variant options — derived from DesignConfig.designStyle
// ---------------------------------------------------------------------------

interface SlideOpts {
  boldAgency: boolean  // Option 2: dramatic dark slides, split panel, corner shapes
  minimal: boolean     // Option 3: hairline rules, all-dark, premium consulting feel
}

// Decorative large background number ("01", "02") — purely visual, low-contrast watermark
function decorativeNumber(id: string, slideId: string, num: string, color: RgbColor): object[] {
  return [
    createTextBox(id, slideId, W - 2800000, H - 1800000, 2600000, 1800000),
    insertText(id, num),
    styleText(id, { color, fontSize: 160, fontFamily: 'Montserrat', bold: true }),
    paragraphAlign(id, 'END'),
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
    ...(data.client.company ? [
      insertText(clientLblId, data.client.company.toUpperCase()),
      styleText(clientLblId, { color: GRAY, fontSize: 10, fontFamily: 'Inter', bold: true }),
      paragraphAlign(clientLblId, 'CENTER'),
    ] : []),

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

    // Project title (supporting, smaller) — user edits in Refine tab take priority
    createTextBox(titleId, slideId, MARGIN_X, 2400000, CONTENT_W, 500000),
    ...((data.expanded?.editedProjectTitle ?? data.project.title) ? [
      insertText(titleId, data.expanded?.editedProjectTitle ?? data.project.title),
      styleText(titleId, { color: GRAY, fontSize: 22, fontFamily: 'Inter' }),
    ] : []),

    // Thin accent divider rule
    ...createRect(ruleId, slideId, MARGIN_X, 2960000, CONTENT_W, 18000, palette.accent),

    // Date line
    createTextBox(dateId, slideId, MARGIN_X, 3040000, CONTENT_W, 280000),
    insertText(dateId, `Prepared for ${data.client.company}  \u00b7  ${data.generated.createdDate}`),
    styleText(dateId, { color: GRAY, fontSize: 14, fontFamily: 'Inter' }),
  ]
}

/** Slide 2: The Challenge — bullet list of problems */
function challengeSlide(slideId: string, data: ProposalData, palette: SlidePalette, opts: SlideOpts): object[] {
  const headId   = `${slideId}_head`
  const bodyId   = `${slideId}_body`
  const barId    = `${slideId}_bar`
  const accentId = `${slideId}_accent`
  const problems = (data.expanded?.editedProblems ?? data.content.problems).filter(p => p.trim())

  const isDark = opts.boldAgency || opts.minimal
  const textColor = isDark ? WHITE : palette.primary
  const accentW   = opts.minimal ? 6000 : 12000

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

  reqs.push(
    createTextBox(headId, slideId, MARGIN_X, MARGIN_TOP, FULL_W, 600000),
    insertText(headId, 'The Challenge'),
    styleText(headId, { color: textColor, fontSize: 36, fontFamily: 'Montserrat', bold: true }),

    createTextBox(bodyId, slideId, MARGIN_X + 80000, 1100000, FULL_W - 80000, 3500000),
    ...(problems.length ? [
      insertText(bodyId, problems.join('\n')),
      styleText(bodyId, { color: isDark ? LTGRAY : palette.primary, fontSize: 20, fontFamily: 'Inter' }),
      {
        createParagraphBullets: {
          objectId: bodyId,
          textRange: { type: 'ALL' },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      },
    ] : []),
  )

  return reqs
}

/** Slide 3 / 4 / 7 / 8: Problem or benefit deep dive — headline + expanded copy */
function problemDeepDive(
  slideId: string,
  label: string,
  headline: string,
  body: string,
  palette: SlidePalette,
  accent = true,
  opts: SlideOpts = { boldAgency: false, minimal: false },
  slideIndex = 0,
): object[] {
  const labelId  = `${slideId}_label`
  const headId   = `${slideId}_head`
  const bodyId   = `${slideId}_body`
  const barId    = `${slideId}_bar`
  const accentId = `${slideId}_accent`

  // Bold-agency makes problem slides dark; benefit slides keep standard treatment
  const isDark = (opts.boldAgency && accent) || opts.minimal
  const headColor = isDark ? WHITE : palette.primary
  const bodyColor = isDark ? LTGRAY : { red: 0.25, green: 0.28, blue: 0.38 }
  const xOff = accent ? 80000 : 0

  const reqs: object[] = [
    bgFill(slideId, isDark ? palette.primary : WHITE),
  ]

  if (opts.minimal) {
    reqs.push(
      ...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 4000, palette.primaryLighter),
      ...createRect(barId, slideId, 0, H - 4000, W, 4000, palette.primaryLighter),
    )
    if (accent) {
      reqs.push(...createRect(accentId, slideId, 0, 0, 6000, H, palette.accent))
    }
  } else {
    reqs.push(...createRect(barId, slideId, 0, H - 50000, W, 50000,
      isDark ? palette.primaryDarker : palette.primary))
    if (accent) {
      reqs.push(...createRect(accentId, slideId, 0, 0, 20000, H, palette.accent))
    } else {
      reqs.push(...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 8000, palette.accent))
    }
  }

  // Bold-agency: low-contrast watermark number behind problem slide content
  if (opts.boldAgency && accent) {
    const nums = ['01', '02', '03', '04']
    reqs.push(...decorativeNumber(`${slideId}_wm`, slideId, nums[slideIndex] ?? '01', palette.primaryLighter))
  }

  reqs.push(
    createTextBox(labelId, slideId, MARGIN_X + xOff, 300000, FULL_W, 180000),
    ...(label ? [insertText(labelId, label), styleText(labelId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true })] : []),

    createTextBox(headId, slideId, MARGIN_X + xOff, 520000, FULL_W - xOff, 1100000),
    ...(headline ? [insertText(headId, headline), styleText(headId, { color: headColor, fontSize: 24, fontFamily: 'Montserrat', bold: true })] : []),

    createTextBox(bodyId, slideId, MARGIN_X + xOff, 1750000, FULL_W - xOff, 3000000),
    ...(body ? [insertText(bodyId, body), styleText(bodyId, { color: bodyColor, fontSize: 16, fontFamily: 'Inter' })] : []),
  )

  return reqs
}

/** Slide 5: Problems 3 & 4 combined */
function problemsCombined(slideId: string, data: ProposalData, palette: SlidePalette, opts: SlideOpts): object[] {
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
  const isDark = opts.boldAgency || opts.minimal
  const headColor = isDark ? WHITE : palette.primary
  const bodyColor = isDark ? LTGRAY : { red: 0.25, green: 0.28, blue: 0.38 }
  const divColor  = isDark ? palette.primaryLighter : { red: 0.9, green: 0.91, blue: 0.93 }

  const reqs: object[] = [
    bgFill(slideId, isDark ? palette.primary : WHITE),
    ...createRect(divId, slideId, W / 2 - 15000, MARGIN_TOP, 30000, H - MARGIN_TOP - 50000, divColor),
  ]

  if (opts.minimal) {
    reqs.push(
      ...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 4000, palette.primaryLighter),
      ...createRect(barId, slideId, 0, H - 4000, W, 4000, palette.primaryLighter),
    )
  } else {
    reqs.push(...createRect(barId, slideId, 0, H - 50000, W, 50000,
      isDark ? palette.primaryDarker : palette.primary))
  }

  reqs.push(
    createTextBox(head1Id, slideId, MARGIN_X, MARGIN_TOP, colW, 700000),
    ...(p3 ? [insertText(head1Id, p3), styleText(head1Id, { color: headColor, fontSize: 20, fontFamily: 'Montserrat', bold: true })] : []),

    createTextBox(body1Id, slideId, MARGIN_X, 1300000, colW, 3300000),
    ...(e3 ? [insertText(body1Id, e3), styleText(body1Id, { color: bodyColor, fontSize: 14, fontFamily: 'Inter' })] : []),

    createTextBox(head2Id, slideId, W / 2 + 80000, MARGIN_TOP, colW, 700000),
    ...(p4 ? [insertText(head2Id, p4), styleText(head2Id, { color: headColor, fontSize: 20, fontFamily: 'Montserrat', bold: true })] : []),

    createTextBox(body2Id, slideId, W / 2 + 80000, 1300000, colW, 3300000),
    ...(e4 ? [insertText(body2Id, e4), styleText(body2Id, { color: bodyColor, fontSize: 14, fontFamily: 'Inter' })] : []),
  )

  return reqs
}

/** Slide 6: The Solution — bullet list of benefits */
function solutionSlide(slideId: string, data: ProposalData, palette: SlidePalette, opts: SlideOpts): object[] {
  const headId    = `${slideId}_head`
  const bodyId    = `${slideId}_body`
  const barId     = `${slideId}_bar`
  const ellipseId = `${slideId}_ellipse`
  const benefits  = data.content.benefits.filter(b => b.trim())

  // Bold-agency: split panel — left 40% accent color, right 60% primary
  if (opts.boldAgency) {
    const splitX       = Math.round(W * 0.4)  // 3,657,600 EMU
    const leftLblId    = `${slideId}_lbl`
    const leftPanelId  = `${slideId}_lpanel`
    const rightPanelId = `${slideId}_rpanel`
    const divId        = `${slideId}_div`

    return [
      ...createRect(leftPanelId,  slideId, 0,      0, splitX,     H, palette.accent),
      ...createRect(rightPanelId, slideId, splitX, 0, W - splitX, H, palette.primary),
      ...createRect(divId,        slideId, splitX, 0, 12000,       H, palette.primaryLighter),

      // "THE SOLUTION" label in left panel
      createTextBox(leftLblId, slideId, MARGIN_X, MARGIN_TOP, splitX - MARGIN_X * 2, 200000),
      insertText(leftLblId, 'THE SOLUTION'),
      styleText(leftLblId, { color: WHITE, fontSize: 11, fontFamily: 'Inter', bold: true }),

      // Large headline in left panel
      createTextBox(headId, slideId, MARGIN_X, 900000, splitX - MARGIN_X * 2, 2200000),
      insertText(headId, 'The Solution'),
      styleText(headId, { color: WHITE, fontSize: 44, fontFamily: 'Montserrat', bold: true }),

      // Benefits list in right panel
      createTextBox(bodyId, slideId, splitX + MARGIN_X, MARGIN_TOP, W - splitX - MARGIN_X * 2, 4500000),
      ...(benefits.length ? [
        insertText(bodyId, benefits.join('\n')),
        styleText(bodyId, { color: WHITE, fontSize: 20, fontFamily: 'Inter' }),
        {
          createParagraphBullets: {
            objectId: bodyId,
            textRange: { type: 'ALL' },
            bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
          },
        },
      ] : []),
    ]
  }

  const reqs: object[] = [
    bgFill(slideId, palette.primary),
  ]

  if (opts.minimal) {
    reqs.push(
      ...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 4000, palette.primaryLighter),
      ...createRect(barId, slideId, 0, H - 4000, W, 4000, palette.primaryLighter),
    )
  } else {
    reqs.push(
      ...createEllipse(ellipseId, slideId, W - 1800000, -300000, 2400000, 2400000, palette.primaryLighter),
      ...createRect(barId, slideId, 0, H - 50000, W, 50000, palette.accent),
    )
  }

  reqs.push(
    createTextBox(headId, slideId, MARGIN_X, MARGIN_TOP, FULL_W, 500000),
    insertText(headId, 'The Solution'),
    styleText(headId, { color: palette.accent, fontSize: 36, fontFamily: 'Montserrat', bold: true }),

    createTextBox(bodyId, slideId, MARGIN_X, 1050000, FULL_W, 3500000),
    ...(benefits.length ? [
      insertText(bodyId, benefits.join('\n')),
      styleText(bodyId, { color: WHITE, fontSize: 20, fontFamily: 'Inter' }),
      {
        createParagraphBullets: {
          objectId: bodyId,
          textRange: { type: 'ALL' },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      },
    ] : []),
  )

  return reqs
}

/** Slide 7: Our Approach — numbered methodology steps */
function approachSlide(slideId: string, data: ProposalData, palette: SlidePalette, opts: SlideOpts): object[] {
  const steps = data.expanded.approachSteps ?? []
  if (steps.length === 0) return []   // skip if no steps generated

  const headId   = `${slideId}_head`
  const labelId  = `${slideId}_label`
  const barId    = `${slideId}_bar`

  const isDark = opts.boldAgency || opts.minimal
  const bg      = isDark ? palette.primary : WHITE
  const headClr = isDark ? WHITE : palette.primary

  const reqs: object[] = [bgFill(slideId, bg)]

  if (opts.minimal) {
    reqs.push(
      ...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 4000, palette.primaryLighter),
      ...createRect(barId, slideId, 0, H - 4000, W, 4000, palette.primaryLighter),
    )
  } else {
    reqs.push(...createRect(barId, slideId, 0, H - 50000, W, 50000,
      isDark ? palette.primaryDarker : palette.primary))
    if (!isDark) {
      reqs.push(...createRect(`${slideId}_accent`, slideId, 0, 0, 12000, H, palette.accent))
    }
  }

  // "OUR APPROACH" eyebrow label
  reqs.push(
    createTextBox(labelId, slideId, MARGIN_X, 300000, FULL_W, 180000),
    insertText(labelId, 'OUR APPROACH'),
    styleText(labelId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X, 500000, FULL_W, 500000),
    insertText(headId, 'How We Deliver'),
    styleText(headId, { color: headClr, fontSize: 32, fontFamily: 'Montserrat', bold: true }),
  )

  // Numbered step cards — up to 4 steps arranged horizontally
  const visSteps = steps.slice(0, 4)
  const colW = Math.floor(FULL_W / visSteps.length) - 60000
  const cardH = 2000000
  const cardY = 1250000
  const textColor = isDark ? LTGRAY : { red: 0.25, green: 0.28, blue: 0.38 }

  visSteps.forEach((step, i) => {
    const cardX = MARGIN_X + i * (colW + 60000)
    const numId   = `${slideId}_n${i}`
    const ruleId  = `${slideId}_r${i}`
    const textId  = `${slideId}_t${i}`

    // Accent-colored step number
    reqs.push(
      createTextBox(numId, slideId, cardX, cardY, 300000, 400000),
      insertText(numId, String(i + 1).padStart(2, '0')),
      styleText(numId, { color: palette.accent, fontSize: 28, fontFamily: 'Montserrat', bold: true }),

      // Thin accent rule under number
      ...createRect(ruleId, slideId, cardX, cardY + 430000, colW, 4000, palette.accent),

      // Step description
      createTextBox(textId, slideId, cardX, cardY + 490000, colW, cardH - 490000),
      ...(step ? [
        insertText(textId, step),
        styleText(textId, { color: textColor, fontSize: 14, fontFamily: 'Inter' }),
      ] : []),
    )
  })

  return reqs
}

/** Slide 10: Benefits 3 & 4 combined (mirrors problemsCombined) */
function benefitsCombined(slideId: string, data: ProposalData, palette: SlidePalette, opts: SlideOpts): object[] {
  const b3 = (data.expanded.editedBenefits?.[2] ?? data.content.benefits[2]) || ''
  const b4 = (data.expanded.editedBenefits?.[3] ?? data.content.benefits[3]) || ''
  const e3 = data.expanded.benefitExpansions[2] || ''
  const e4 = data.expanded.benefitExpansions[3] || ''

  if (!b3 && !b4) return []  // skip if no benefits 3 & 4

  const head1Id = `${slideId}_h1`
  const body1Id = `${slideId}_b1`
  const head2Id = `${slideId}_h2`
  const body2Id = `${slideId}_b2`
  const barId   = `${slideId}_bar`
  const divId   = `${slideId}_div`
  const lblId   = `${slideId}_lbl`

  const colW = W / 2 - MARGIN_X - 80000
  const isDark = opts.minimal  // bold-agency keeps light bg for benefits (matches benefit deep-dives)
  const headColor = isDark ? WHITE : palette.primary
  const bodyColor = isDark ? LTGRAY : { red: 0.25, green: 0.28, blue: 0.38 }
  const divColor  = isDark ? palette.primaryLighter : { red: 0.9, green: 0.91, blue: 0.93 }

  const reqs: object[] = [
    bgFill(slideId, isDark ? palette.primary : WHITE),
    ...createRect(divId, slideId, W / 2 - 15000, MARGIN_TOP, 30000, H - MARGIN_TOP - 50000, divColor),
  ]

  if (opts.minimal) {
    reqs.push(
      ...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 4000, palette.primaryLighter),
      ...createRect(barId, slideId, 0, H - 4000, W, 4000, palette.primaryLighter),
    )
  } else {
    reqs.push(
      ...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 8000, palette.accent),
      ...createRect(barId, slideId, 0, H - 50000, W, 50000, palette.primary),
    )
  }

  reqs.push(
    createTextBox(lblId, slideId, MARGIN_X, 220000, FULL_W, 160000),
    insertText(lblId, 'BENEFIT 03 & 04'),
    styleText(lblId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(head1Id, slideId, MARGIN_X, MARGIN_TOP + 120000, colW, 700000),
    ...(b3 ? [insertText(head1Id, b3), styleText(head1Id, { color: headColor, fontSize: 20, fontFamily: 'Montserrat', bold: true })] : []),

    createTextBox(body1Id, slideId, MARGIN_X, 1400000, colW, 3200000),
    ...(e3 ? [insertText(body1Id, e3), styleText(body1Id, { color: bodyColor, fontSize: 14, fontFamily: 'Inter' })] : []),

    createTextBox(head2Id, slideId, W / 2 + 80000, MARGIN_TOP + 120000, colW, 700000),
    ...(b4 ? [insertText(head2Id, b4), styleText(head2Id, { color: headColor, fontSize: 20, fontFamily: 'Montserrat', bold: true })] : []),

    createTextBox(body2Id, slideId, W / 2 + 80000, 1400000, colW, 3200000),
    ...(e4 ? [insertText(body2Id, e4), styleText(body2Id, { color: bodyColor, fontSize: 14, fontFamily: 'Inter' })] : []),
  )

  return reqs
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

/** Slide 11: Investment & Timeline — visual card grid */
function investmentSlide(slideId: string, data: ProposalData, palette: SlidePalette, opts: SlideOpts): object[] {
  const headId  = `${slideId}_head`
  const totalId = `${slideId}_total`
  const timeId  = `${slideId}_time`
  const barId   = `${slideId}_bar`

  // Minimal goes full dark; bold-agency keeps light LTGRAY background for visual relief
  const isDark     = opts.minimal
  const headColor  = isDark ? WHITE : palette.primary
  const valueColor = isDark ? LTGRAY : palette.primary

  const reqs: object[] = [
    bgFill(slideId, isDark ? palette.primary : LTGRAY),
  ]

  if (opts.minimal) {
    reqs.push(
      ...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 4000, palette.primaryLighter),
      ...createRect(barId, slideId, 0, H - 4000, W, 4000, palette.primaryLighter),
    )
  } else {
    reqs.push(...createRect(barId, slideId, 0, H - 50000, W, 50000, palette.primary))
    if (opts.boldAgency) {
      reqs.push(...createRect(`${slideId}_topbar`, slideId, 0, 0, W, 60000, palette.accent))
    }
  }

  reqs.push(
    createTextBox(headId, slideId, MARGIN_X, MARGIN_TOP, FULL_W, 500000),
    insertText(headId, 'Investment & Timeline'),
    styleText(headId, { color: headColor, fontSize: 36, fontFamily: 'Montserrat', bold: true }),

    createTextBox(totalId, slideId, MARGIN_X, 1050000, FULL_W / 2, 400000),
    insertText(totalId, `Total Investment: ${data.project.totalValue}`),
    styleText(totalId, { color: palette.accent, fontSize: 24, fontFamily: 'Inter', bold: true }),

    createTextBox(timeId, slideId, MARGIN_X, 1550000, FULL_W / 2, 300000),
    insertText(timeId, `Timeline: ${data.project.duration}`),
    styleText(timeId, { color: valueColor, fontSize: 18, fontFamily: 'Inter' }),
  )

  // Month cards — 3 side-by-side colored rectangles
  const months = [
    { label: 'Month 1', value: data.project.monthOneInvestment },
    { label: 'Month 2', value: data.project.monthTwoInvestment },
    { label: 'Month 3', value: data.project.monthThreeInvestment },
  ].filter(m => m.value)

  if (months.length > 0) {
    const cardGap  = 80000
    const cardW    = Math.floor((FULL_W - cardGap * (months.length - 1)) / months.length)
    const cardH    = 1300000
    const cardY    = 2100000
    const cardBg   = isDark ? palette.primaryLighter : palette.primary

    months.forEach((month, i) => {
      const cardX     = MARGIN_X + i * (cardW + cardGap)
      const cardId    = `${slideId}_card${i}`
      const mLblId    = `${slideId}_mlbl${i}`
      const mValId    = `${slideId}_mval${i}`

      reqs.push(
        ...createRect(cardId, slideId, cardX, cardY, cardW, cardH, cardBg),

        createTextBox(mLblId, slideId, cardX + 100000, cardY + 150000, cardW - 200000, 280000),
        insertText(mLblId, month.label.toUpperCase()),
        styleText(mLblId, { color: palette.accent, fontSize: 11, fontFamily: 'Inter', bold: true }),
        paragraphAlign(mLblId, 'CENTER'),

        createTextBox(mValId, slideId, cardX + 60000, cardY + 480000, cardW - 120000, 600000),
        insertText(mValId, month.value),
        styleText(mValId, { color: WHITE, fontSize: 20, fontFamily: 'Inter', bold: true }),
        paragraphAlign(mValId, 'CENTER'),
      )
    })
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
    insertText(headId, `Let's build this together, ${data.client.firstName}.`),
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

// ---------------------------------------------------------------------------
// Logo helpers
// ---------------------------------------------------------------------------

const PARAMOUNT_DOMAIN = 'paramount.com'
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
  // Option 1: Brand Color Intelligence — auto-detect palette from company name
  const brandPalette = !designConfig?.disableBrandDetection
    ? getBrandPalette(data.client.company)
    : null
  const palette = brandPalette
    ?? PALETTE_MAP[designConfig?.colorTheme ?? 'navy-gold']
    ?? PALETTE_MAP['navy-gold']

  // Option 2 / 3: Layout variant
  const designStyle = designConfig?.designStyle ?? 'standard'
  const opts: SlideOpts = {
    boldAgency: designStyle === 'bold-agency',
    minimal:    designStyle === 'executive-minimal',
  }

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
  // Base 13-slide deck:
  //  1 Cover  2 Challenge  3 Prob1  4 Prob2  5 Prob3&4
  //  6 Solution  7 Approach  8 Ben1  9 Ben2  10 Ben3&4
  //  11 Investment  12 NextSteps  13 Close
  const slideIds = [
    's01_cover',    's02_challenge', 's03_prob1',  's04_prob2',
    's05_prob34',   's06_solution',  's07_approach','s08_ben1',
    's09_ben2',     's10_ben34',     's11_invest',  's12_next',
    's13_close',
  ]

  const p = data
  const e = data.expanded

  // Approach and NextSteps slides are optional — skip if LLM returned no content
  const hasApproach  = (e.approachSteps?.length ?? 0) > 0
  const hasNextSteps = (e.nextSteps?.length ?? 0) > 0

  // Build the final ordered list, filtering empty optional slides
  const orderedSlides = [
    { id: 's01_cover',    reqs: () => titleSlide(slideIds[0], p, palette) },
    { id: 's02_challenge',reqs: () => challengeSlide(slideIds[1], p, palette, opts) },
    { id: 's03_prob1',    reqs: () => problemDeepDive(slideIds[2], 'CHALLENGE 01', p.content.problems[0] || '', e.problemExpansions[0] || '', palette, true, opts, 0) },
    { id: 's04_prob2',    reqs: () => problemDeepDive(slideIds[3], 'CHALLENGE 02', p.content.problems[1] || '', e.problemExpansions[1] || '', palette, true, opts, 1) },
    { id: 's05_prob34',   reqs: () => problemsCombined(slideIds[4], p, palette, opts) },
    { id: 's06_solution', reqs: () => solutionSlide(slideIds[5], p, palette, opts) },
    ...(hasApproach ? [{ id: 's07_approach', reqs: () => approachSlide(slideIds[6], p, palette, opts) }] : []),
    { id: 's08_ben1',     reqs: () => problemDeepDive(slideIds[7], 'BENEFIT 01', p.content.benefits[0] || '', e.benefitExpansions[0] || '', palette, false, opts, 0) },
    { id: 's09_ben2',     reqs: () => problemDeepDive(slideIds[8], 'BENEFIT 02', p.content.benefits[1] || '', e.benefitExpansions[1] || '', palette, false, opts, 1) },
    { id: 's10_ben34',    reqs: () => benefitsCombined(slideIds[9], p, palette, opts) },
    { id: 's11_invest',   reqs: () => investmentSlide(slideIds[10], p, palette, opts) },
    ...(hasNextSteps ? [{ id: 's12_next', reqs: () => nextStepsSlide(slideIds[11], p, palette, opts) }] : []),
    { id: 's13_close',    reqs: () => closingSlide(slideIds[12], p, palette, opts) },
  ].filter(s => {
    const r = s.reqs()
    return r.length > 0  // benefitsCombined / approachSlide / nextStepsSlide return [] when empty
  })

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
  const coverSlideId = orderedSlides[0].id
  const closeSlideId = orderedSlides[orderedSlides.length - 1].id
  try {
    const logoReqs = logoRequests(coverSlideId, closeSlideId, p)
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
