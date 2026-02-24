/**
 * Google Slides REST API integration
 *
 * Two-phase approach:
 *   1. POST /v1/presentations — create empty presentation
 *   2. POST /v1/presentations/{id}:batchUpdate — build all slides in one atomic request
 *
 * No Vite proxy needed — Google Slides API supports CORS with OAuth Bearer tokens.
 */

import type { ProposalData } from '../types/proposal'

const SLIDES_API = 'https://slides.googleapis.com/v1/presentations'

// Standard 16:9 widescreen in EMU (1 inch = 914400 EMU)
// 10" × 5.625" = 9144000 × 5143500 EMU
const W = 9144000  // slide width
const H = 5143500  // slide height

// Paramount brand palette (RGB 0–1 floats)
const NAVY   = { red: 0.051, green: 0.122, blue: 0.251 }  // #0D1F40
const ORANGE = { red: 0.949, green: 0.451, blue: 0.129 }  // #F27321
const WHITE  = { red: 1, green: 1, blue: 1 }
const LTGRAY = { red: 0.96, green: 0.96, blue: 0.97 }     // #F5F5F7
const GRAY   = { red: 0.45, green: 0.48, blue: 0.54 }

export interface CreateSlidesResult {
  presentationId: string
  presentationUrl: string
  title: string
}

// ---------------------------------------------------------------------------
// Low-level request builders
// ---------------------------------------------------------------------------

type RgbColor = { red: number; green: number; blue: number }

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
        foregroundColor: { opaqueColor: { rgbColor: opts.color ?? NAVY } },
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

// ---------------------------------------------------------------------------
// Slide builders — each returns an array of batchUpdate requests
// ---------------------------------------------------------------------------

// Margins / layout constants (EMU)
const MARGIN_X = 457200      // ~0.5"
const MARGIN_TOP = 400000
const FULL_W = W - MARGIN_X * 2

/** Slide 1: Title / Cover */
function titleSlide(slideId: string, data: ProposalData): object[] {
  const titleId = `${slideId}_title`
  const subId   = `${slideId}_sub`
  const dateId  = `${slideId}_date`
  const barId   = `${slideId}_bar`
  const bar2Id  = `${slideId}_bar2`

  return [
    bgFill(slideId, NAVY),
    ...createRect(barId, slideId, 0, 0, W, 60000, ORANGE),
    ...createRect(bar2Id, slideId, 0, H - 80000, W, 80000, { red: 0.035, green: 0.09, blue: 0.2 }),

    createTextBox(subId, slideId, MARGIN_X, 300000, FULL_W, 220000),
    insertText(subId, 'Paramount'),
    styleText(subId, { color: ORANGE, fontSize: 13, fontFamily: 'Inter', bold: true }),

    createTextBox(titleId, slideId, MARGIN_X, 550000, FULL_W, 1500000),
    insertText(titleId, data.project.title),
    styleText(titleId, { color: WHITE, fontSize: 48, fontFamily: 'Montserrat', bold: true }),

    createTextBox(dateId, slideId, MARGIN_X, 2200000, FULL_W, 400000),
    insertText(dateId, `Prepared for ${data.client.company}  ·  ${data.generated.createdDate}`),
    styleText(dateId, { color: GRAY, fontSize: 14, fontFamily: 'Inter' }),
  ]
}

/** Slide 2: The Challenge — bullet list of problems */
function challengeSlide(slideId: string, data: ProposalData): object[] {
  const headId = `${slideId}_head`
  const bodyId = `${slideId}_body`
  const barId  = `${slideId}_bar`
  const problems = data.content.problems.filter(p => p.trim())

  return [
    bgFill(slideId, WHITE),
    ...createRect(barId, slideId, 0, H - 50000, W, 50000, ORANGE),

    createTextBox(headId, slideId, MARGIN_X, MARGIN_TOP, FULL_W, 500000),
    insertText(headId, 'The Challenge'),
    styleText(headId, { color: NAVY, fontSize: 36, fontFamily: 'Montserrat', bold: true }),

    createTextBox(bodyId, slideId, MARGIN_X, 1050000, FULL_W, 3500000),
    insertText(bodyId, problems.join('\n')),
    styleText(bodyId, { color: NAVY, fontSize: 20, fontFamily: 'Inter' }),
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
    ...createRect(barId, slideId, 0, H - 50000, W, 50000, NAVY),
  ]

  if (accent) {
    reqs.push(...createRect(accentId, slideId, 0, 0, 20000, H, ORANGE))
  }

  reqs.push(
    createTextBox(labelId, slideId, MARGIN_X + xOff, 300000, FULL_W, 180000),
    insertText(labelId, label),
    styleText(labelId, { color: ORANGE, fontSize: 11, fontFamily: 'Inter', bold: true }),

    createTextBox(headId, slideId, MARGIN_X + xOff, 520000, FULL_W - xOff, 1000000),
    insertText(headId, headline),
    styleText(headId, { color: NAVY, fontSize: 24, fontFamily: 'Montserrat', bold: true }),

    createTextBox(bodyId, slideId, MARGIN_X + xOff, 1650000, FULL_W - xOff, 3100000),
    insertText(bodyId, body),
    styleText(bodyId, { color: { red: 0.25, green: 0.28, blue: 0.38 }, fontSize: 16, fontFamily: 'Inter' }),
  )

  return reqs
}

/** Slide 5: Problems 3 & 4 combined */
function problemsCombined(slideId: string, data: ProposalData): object[] {
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
    ...createRect(barId, slideId, 0, H - 50000, W, 50000, NAVY),
    ...createRect(divId, slideId, W / 2 - 15000, MARGIN_TOP, 30000, H - MARGIN_TOP - 50000, { red: 0.9, green: 0.91, blue: 0.93 }),

    createTextBox(head1Id, slideId, MARGIN_X, MARGIN_TOP, colW, 700000),
    insertText(head1Id, p3),
    styleText(head1Id, { color: NAVY, fontSize: 20, fontFamily: 'Montserrat', bold: true }),

    createTextBox(body1Id, slideId, MARGIN_X, 1200000, colW, 3400000),
    insertText(body1Id, e3),
    styleText(body1Id, { color: { red: 0.25, green: 0.28, blue: 0.38 }, fontSize: 14, fontFamily: 'Inter' }),

    createTextBox(head2Id, slideId, W / 2 + 80000, MARGIN_TOP, colW, 700000),
    insertText(head2Id, p4),
    styleText(head2Id, { color: NAVY, fontSize: 20, fontFamily: 'Montserrat', bold: true }),

    createTextBox(body2Id, slideId, W / 2 + 80000, 1200000, colW, 3400000),
    insertText(body2Id, e4),
    styleText(body2Id, { color: { red: 0.25, green: 0.28, blue: 0.38 }, fontSize: 14, fontFamily: 'Inter' }),
  ]
}

/** Slide 6: The Solution — bullet list of benefits */
function solutionSlide(slideId: string, data: ProposalData): object[] {
  const headId = `${slideId}_head`
  const bodyId = `${slideId}_body`
  const barId  = `${slideId}_bar`
  const benefits = data.content.benefits.filter(b => b.trim())

  return [
    bgFill(slideId, NAVY),
    ...createRect(barId, slideId, 0, H - 50000, W, 50000, ORANGE),

    createTextBox(headId, slideId, MARGIN_X, MARGIN_TOP, FULL_W, 500000),
    insertText(headId, 'The Solution'),
    styleText(headId, { color: ORANGE, fontSize: 36, fontFamily: 'Montserrat', bold: true }),

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
function investmentSlide(slideId: string, data: ProposalData): object[] {
  const headId   = `${slideId}_head`
  const totalId  = `${slideId}_total`
  const timeId   = `${slideId}_time`
  const m1Id     = `${slideId}_m1`
  const m2Id     = `${slideId}_m2`
  const m3Id     = `${slideId}_m3`
  const barId    = `${slideId}_bar`

  return [
    bgFill(slideId, LTGRAY),
    ...createRect(barId, slideId, 0, H - 50000, W, 50000, NAVY),

    createTextBox(headId, slideId, MARGIN_X, MARGIN_TOP, FULL_W, 500000),
    insertText(headId, 'Investment & Timeline'),
    styleText(headId, { color: NAVY, fontSize: 36, fontFamily: 'Montserrat', bold: true }),

    createTextBox(totalId, slideId, MARGIN_X, 1050000, FULL_W / 2, 400000),
    insertText(totalId, `Total Investment: ${data.project.totalValue}`),
    styleText(totalId, { color: ORANGE, fontSize: 24, fontFamily: 'Inter', bold: true }),

    createTextBox(timeId, slideId, MARGIN_X, 1550000, FULL_W / 2, 300000),
    insertText(timeId, `Timeline: ${data.project.duration}`),
    styleText(timeId, { color: NAVY, fontSize: 18, fontFamily: 'Inter' }),

    createTextBox(m1Id, slideId, MARGIN_X, 2100000, FULL_W, 300000),
    insertText(m1Id, `Month 1: ${data.project.monthOneInvestment}`),
    styleText(m1Id, { color: NAVY, fontSize: 16, fontFamily: 'Inter' }),

    createTextBox(m2Id, slideId, MARGIN_X, 2500000, FULL_W, 300000),
    insertText(m2Id, `Month 2: ${data.project.monthTwoInvestment}`),
    styleText(m2Id, { color: NAVY, fontSize: 16, fontFamily: 'Inter' }),

    createTextBox(m3Id, slideId, MARGIN_X, 2900000, FULL_W, 300000),
    insertText(m3Id, `Month 3: ${data.project.monthThreeInvestment}`),
    styleText(m3Id, { color: NAVY, fontSize: 16, fontFamily: 'Inter' }),
  ]
}

/** Slide 10: Close / CTA */
function closingSlide(slideId: string, data: ProposalData): object[] {
  const headId   = `${slideId}_head`
  const subId    = `${slideId}_sub`
  const footerId = `${slideId}_footer`
  const barId    = `${slideId}_bar`

  return [
    bgFill(slideId, NAVY),
    ...createRect(barId, slideId, 0, H - 80000, W, 80000, { red: 0.035, green: 0.09, blue: 0.2 }),

    createTextBox(headId, slideId, MARGIN_X, 1400000, FULL_W, 800000),
    insertText(headId, `Let's build this together, ${data.client.firstName}.`),
    styleText(headId, { color: ORANGE, fontSize: 40, fontFamily: 'Montserrat', bold: true }),
    paragraphAlign(headId, 'CENTER'),

    createTextBox(subId, slideId, MARGIN_X, 2400000, FULL_W, 400000),
    insertText(subId, 'Paramount'),
    styleText(subId, { color: WHITE, fontSize: 16, fontFamily: 'Inter' }),
    paragraphAlign(subId, 'CENTER'),

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
const LOGO_API = 'https://logo.clearbit.com'

function getClientDomain(data: ProposalData): string | null {
  if (data.client.companyDomain) return data.client.companyDomain
  const guess = data.client.company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
  return guess || null
}

function logoRequests(coverSlideId: string, closeSlideId: string, data: ProposalData): object[] {
  const reqs: object[] = []
  const LOGO_H = 457200   // ~0.5"
  const LOGO_W = 1371600  // ~1.5" (rectangular aspect)

  reqs.push(
    createImageReq(
      `${coverSlideId}_plogo`, coverSlideId,
      `${LOGO_API}/${PARAMOUNT_DOMAIN}`,
      W - MARGIN_X - LOGO_W, 200000, LOGO_W, LOGO_H,
    ),
  )

  const clientDomain = getClientDomain(data)
  if (clientDomain) {
    reqs.push(
      createImageReq(
        `${coverSlideId}_clogo`, coverSlideId,
        `${LOGO_API}/${clientDomain}`,
        W - MARGIN_X - LOGO_W, H - 80000 - LOGO_H - 100000, LOGO_W, LOGO_H,
      ),
    )
  }

  reqs.push(
    createImageReq(
      `${closeSlideId}_plogo`, closeSlideId,
      `${LOGO_API}/${PARAMOUNT_DOMAIN}`,
      W / 2 - LOGO_W / 2, 600000, LOGO_W, LOGO_H,
    ),
  )

  return reqs
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function createGoogleSlidesPresentation(
  data: ProposalData,
  accessToken: string
): Promise<CreateSlidesResult> {
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
    ...titleSlide(slideIds[0], p),
    ...challengeSlide(slideIds[1], p),
    ...problemDeepDive(slideIds[2], 'CHALLENGE 01', p.content.problems[0] || '', e.problemExpansions[0] || ''),
    ...problemDeepDive(slideIds[3], 'CHALLENGE 02', p.content.problems[1] || '', e.problemExpansions[1] || ''),
    ...problemsCombined(slideIds[4], p),
    ...solutionSlide(slideIds[5], p),
    ...problemDeepDive(slideIds[6], 'BENEFIT 01', p.content.benefits[0] || '', e.benefitExpansions[0] || '', false),
    ...problemDeepDive(slideIds[7], 'BENEFIT 02', p.content.benefits[1] || '', e.benefitExpansions[1] || '', false),
    ...investmentSlide(slideIds[8], p),
    ...closingSlide(slideIds[9], p),
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
      await fetch(`${SLIDES_API}/${presentationId}:batchUpdate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ requests: logoReqs }),
      })
    }
  } catch {
    // Logo insertion is best-effort — don't throw
  }

  return {
    presentationId,
    presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
    title: data.project.title,
  }
}
