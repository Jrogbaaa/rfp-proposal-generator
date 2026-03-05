/**
 * Template-based Google Slides builder
 *
 * Three-phase approach:
 *   1. POST drive.googleapis.com/v3/files/{TEMPLATE_ID}/copy — duplicate the template
 *   2. GET  slides.googleapis.com/v1/presentations/{id}      — read shape objectIds
 *   3. POST slides.googleapis.com/v1/presentations/{id}:batchUpdate — delete/reorder/populate
 *
 * Typography and visual design are inherited from the template — no style manipulation needed.
 */

import type { ProposalData } from '../types/proposal'
import type { CreateSlidesResult } from './googleSlides'

const TEMPLATE_ID = '1Hu53M6vbJRH4XaXJzyo6V30b8vxteN_sv2NO4FQfzHo'
const DRIVE_API   = 'https://www.googleapis.com/drive/v3/files'
const SLIDES_API  = 'https://slides.googleapis.com/v1/presentations'

// Template slide indices (0-based) to KEEP, in desired proposal order:
// Cover → Opportunity → Approach → Benefits → Investment → Metrics → Next Steps
const KEEP_INDICES_IN_ORDER = [0, 5, 3, 11, 12, 9, 17] as const

// All other 18 template slides are deleted
const DELETE_INDICES = [1, 2, 4, 6, 7, 8, 10, 13, 14, 15, 16]

// Logo constants (EMU — 1 inch = 914,400 EMU)
const W = 9_144_000
const H = 6_858_000
const FAVICON_V2 = 'https://t1.gstatic.com/faviconV2'
const PARAMOUNT_DOMAIN = 'paramount.com'

// ---------------------------------------------------------------------------
// Shape utilities
// ---------------------------------------------------------------------------

interface PageElement {
  objectId: string
  shape?: {
    text?: {
      textElements?: Array<{ textRun?: { content?: string } }>
    }
  }
  size?: { width?: { magnitude?: number }; height?: { magnitude?: number } }
  transform?: { translateX?: number; translateY?: number; scaleX?: number; scaleY?: number }
}

function getAllText(el: PageElement): string {
  return (el.shape?.text?.textElements ?? [])
    .map(te => te.textRun?.content ?? '')
    .join('')
    .trim()
}

function findShape(elements: PageElement[], ...candidates: string[]): PageElement | undefined {
  const needle = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  for (const candidate of candidates) {
    const found = elements.find(el =>
      needle(getAllText(el)).includes(needle(candidate))
    )
    if (found) return found
  }
  return undefined
}

// ---------------------------------------------------------------------------
// batchUpdate request builders
// ---------------------------------------------------------------------------

/** Replace all text in a shape while inheriting the template's existing typography. */
function replaceText(objectId: string, newText: string): object[] {
  if (!newText?.trim()) return []
  return [
    { deleteText: { objectId, textRange: { type: 'ALL' } } },
    { insertText: { objectId, insertionIndex: 0, text: newText } },
  ]
}

function truncate(text: string, max: number): string {
  if (!text || text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + '…'
}

function logoUrl(domain: string): string {
  return `${FAVICON_V2}?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=256`
}

function getClientDomain(data: ProposalData): string | null {
  if (data.client.companyDomain) return data.client.companyDomain
  const guess = data.client.company.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com'
  return guess || null
}

// ---------------------------------------------------------------------------
// Per-slide content mappers
// ---------------------------------------------------------------------------

function mapCoverSlide(elements: PageElement[], data: ProposalData): object[] {
  const ops: object[] = []

  const companyEl = findShape(elements, 'COMPANY NAME', 'company name')
  if (companyEl) {
    ops.push(...replaceText(companyEl.objectId, data.client.company.toUpperCase()))
  } else {
    console.warn('[TemplateSlides] Cover: could not find COMPANY NAME shape')
  }

  // "Investor Pitch Deck" headline — replace with project title
  const headlineEl = findShape(elements, 'Investor', 'Investor Pitch')
  if (headlineEl) {
    ops.push(...replaceText(headlineEl.objectId, data.project.title || 'Media Proposal'))
  } else {
    console.warn('[TemplateSlides] Cover: could not find headline shape')
  }

  // "Subtitle" line — tagline
  const subtitleEl = findShape(elements, 'Subtitle')
  if (subtitleEl) {
    ops.push(...replaceText(subtitleEl.objectId, `A Proposal for ${data.client.company}`))
  }

  // "Date" line
  const dateEl = findShape(elements, 'Date')
  if (dateEl) {
    ops.push(...replaceText(dateEl.objectId, data.generated.createdDate))
  }

  return ops
}

function mapChallengeSlide(elements: PageElement[], data: ProposalData): object[] {
  const ops: object[] = []

  const titleEl = findShape(elements, 'Growth', 'Growth Strategy')
  if (titleEl) {
    ops.push(...replaceText(titleEl.objectId, 'The\nOpportunity'))
  } else {
    console.warn('[TemplateSlides] Challenge: could not find title shape')
  }

  // Find the long Lorem ipsum body — look for the largest text block
  const bodyEls = elements
    .filter(el => getAllText(el).toLowerCase().includes('lorem ipsum'))
    .sort((a, b) => getAllText(b).length - getAllText(a).length)
  const bodyEl = bodyEls[0]
  if (bodyEl) {
    const text = data.expanded.problemExpansions[0] || data.content.problems[0] || ''
    ops.push(...replaceText(bodyEl.objectId, truncate(text, 450)))
  }

  return ops
}

function mapApproachSlide(elements: PageElement[], data: ProposalData): object[] {
  const ops: object[] = []

  const titleEl = findShape(elements, 'What Makes', 'Us Unique')
  if (titleEl) {
    ops.push(...replaceText(titleEl.objectId, 'Our\nApproach'))
  } else {
    console.warn('[TemplateSlides] Approach: could not find title shape')
  }

  // Bullet point text box (contains "●" characters)
  const bulletEl = findShape(elements, '●', '•')
  if (bulletEl) {
    const steps = (data.expanded.approachSteps ?? []).slice(0, 3)
    if (steps.length > 0) {
      ops.push(...replaceText(bulletEl.objectId, steps.join('\n')))
    }
  } else {
    console.warn('[TemplateSlides] Approach: could not find bullet shape')
  }

  return ops
}

function mapBenefitsSlide(elements: PageElement[], data: ProposalData): object[] {
  const ops: object[] = []

  const titleEl = findShape(elements, 'Business Model')
  if (titleEl) {
    ops.push(...replaceText(titleEl.objectId, 'What You Get'))
  }

  // 3 "Lorem Ipsum Title" heading shapes — benefit titles
  const loremTitleEls = elements
    .filter(el => {
      const t = getAllText(el).toLowerCase()
      return t.includes('lorem ipsum title') || (t.startsWith('lorem ipsum') && t.length < 30)
    })
    .slice(0, 3)

  loremTitleEls.forEach((el, i) => {
    const benefit = data.content.benefits[i] || ''
    if (benefit) ops.push(...replaceText(el.objectId, benefit))
  })

  // 3 Lorem ipsum body shapes — benefit descriptions
  const loremBodyEls = elements
    .filter(el => {
      const t = getAllText(el).toLowerCase()
      return t.includes('lorem ipsum') && t.length > 30 && !t.includes('title') && !t.includes('business model')
    })
    .sort((a, b) => getAllText(a).length - getAllText(b).length)
    .slice(0, 3)

  loremBodyEls.forEach((el, i) => {
    const expansion = data.expanded.benefitExpansions[i] || ''
    if (expansion) ops.push(...replaceText(el.objectId, truncate(expansion, 200)))
  })

  // 3 "Text Here Title" metric label cells
  const metricLabels = ['REACH', 'ENGAGE', 'CONVERT']
  const textHereEls = elements
    .filter(el => getAllText(el).toLowerCase().includes('text here'))
    .slice(0, 3)

  textHereEls.forEach((el, i) => {
    ops.push(...replaceText(el.objectId, metricLabels[i]))
  })

  return ops
}

function mapInvestmentSlide(elements: PageElement[], data: ProposalData): object[] {
  const ops: object[] = []

  const titleEl = findShape(elements, 'Headline', 'Headline Title Here')
  if (titleEl) {
    ops.push(...replaceText(titleEl.objectId, 'Investment\n& Scope'))
  }

  // 6 Lorem ipsum items — use approach steps + investment details
  const steps = data.expanded.approachSteps ?? []
  const investmentItems = [
    data.project.duration ? `Timeline: ${data.project.duration}` : 'Phased delivery',
    data.project.totalValue ? `Total: ${data.project.totalValue}` : 'Flexible scope',
    'Ongoing support & optimization',
  ]
  const allItems = [...steps, ...investmentItems].slice(0, 6)

  const loremEls = elements
    .filter(el => getAllText(el).toLowerCase().includes('lorem ipsum'))
    .slice(0, 6)

  loremEls.forEach((el, i) => {
    const item = allItems[i] || ''
    if (item) ops.push(...replaceText(el.objectId, truncate(item, 100)))
  })

  return ops
}

function mapMetricsSlide(elements: PageElement[], data: ProposalData): object[] {
  const ops: object[] = []

  const inventoryEl = findShape(elements, 'INVENTORY')
  if (inventoryEl) ops.push(...replaceText(inventoryEl.objectId, 'REACH'))

  const researchEl = findShape(elements, 'RESEARCH')
  if (researchEl) ops.push(...replaceText(researchEl.objectId, 'ENGAGE'))

  const marketingEl = findShape(elements, 'MARKETING')
  if (marketingEl) ops.push(...replaceText(marketingEl.objectId, 'CONVERT'))

  const headlineEl = findShape(elements, 'Headline Title')
  if (headlineEl) ops.push(...replaceText(headlineEl.objectId, 'Measuring\nSuccess'))

  const bodyEls = elements
    .filter(el => getAllText(el).toLowerCase().includes('lorem ipsum'))
    .sort((a, b) => getAllText(b).length - getAllText(a).length)
  if (bodyEls[0]) {
    ops.push(...replaceText(
      bodyEls[0].objectId,
      'Track what matters at every stage: reach, engagement, and conversion.',
    ))
  }

  const moneyEl = findShape(elements, '$000', '000.000')
  if (moneyEl) {
    ops.push(...replaceText(moneyEl.objectId, data.project.totalValue || 'TBD'))
  }

  return ops
}

function mapNextStepsSlide(elements: PageElement[], data: ProposalData): object[] {
  const ops: object[] = []

  const titleEl = findShape(elements, 'Headline', 'Title Here')
  if (titleEl) ops.push(...replaceText(titleEl.objectId, 'Next\nSteps'))

  const subtitleEl = findShape(elements, 'Lorem Ipsum SubTitle', 'SubTitle')
  if (subtitleEl) {
    ops.push(...replaceText(subtitleEl.objectId, data.project.title || "Let's get started"))
  }

  // Body paragraphs — nextSteps[0] and [1]
  const bodyEls = elements
    .filter(el => {
      const t = getAllText(el).toLowerCase()
      return t.includes('lorem ipsum') && t.length > 40 && !t.includes('subtitle')
    })
    .sort((a, b) => getAllText(b).length - getAllText(a).length)
    .slice(0, 2)

  const nextSteps = data.expanded.nextSteps ?? []
  bodyEls.forEach((el, i) => {
    const step = nextSteps[i]
    if (step) ops.push(...replaceText(el.objectId, truncate(step, 200)))
  })

  // 6 "LOREM IPSUM TITLE HERE" pill/tag shapes — action items
  const pillEls = elements
    .filter(el => getAllText(el).toLowerCase().includes('lorem ipsum title here'))
    .slice(0, 6)

  const pillItems = nextSteps.slice(2, 8)
  pillEls.forEach((el, i) => {
    const item = pillItems[i]
    if (item) ops.push(...replaceText(el.objectId, truncate(item, 40)))
  })

  return ops
}

// ---------------------------------------------------------------------------
// Logo requests
// ---------------------------------------------------------------------------

/**
 * Build logo batchUpdate requests:
 * - Paramount logo: bottom-right corner of EVERY slide
 * - Client logo: replaces "LOGO HERE" placeholder on cover slide
 */
function buildTemplateLogoRequests(
  coverElements: PageElement[],
  coverSlideId: string,
  allSlideIds: string[],
  data: ProposalData,
): object[] {
  const reqs: object[] = []

  const paramountUrl = logoUrl(PARAMOUNT_DOMAIN)
  const PARAM_SIZE   = 457_200   // 0.5" — small enough not to crowd content
  const MARGIN       = 200_000   // 0.22" from edges

  // ── Paramount logo — bottom-right of every slide ─────────────────────────
  for (const pageObjectId of allSlideIds) {
    reqs.push({
      createImage: {
        url: paramountUrl,
        elementProperties: {
          pageObjectId,
          size: {
            width:  { magnitude: PARAM_SIZE, unit: 'EMU' },
            height: { magnitude: PARAM_SIZE, unit: 'EMU' },
          },
          transform: {
            scaleX: 1, scaleY: 1,
            translateX: W - PARAM_SIZE - MARGIN,
            translateY: H - PARAM_SIZE - MARGIN,
            unit: 'EMU',
          },
        },
      },
    })
  }

  // ── Client logo — replace "LOGO HERE" placeholder on cover ───────────────
  const domain = getClientDomain(data)
  if (!domain) return reqs

  const clientUrl = logoUrl(domain)
  const logoEl = findShape(coverElements, 'LOGO HERE', 'logo here')
  if (logoEl) {
    const x = logoEl.transform?.translateX ?? 6_400_000
    const y = logoEl.transform?.translateY ?? 1_500_000
    const w = logoEl.size?.width?.magnitude ?? 914_400
    const h = logoEl.size?.height?.magnitude ?? 914_400
    reqs.push(
      { deleteObject: { objectId: logoEl.objectId } },
      {
        createImage: {
          url: clientUrl,
          elementProperties: {
            pageObjectId: coverSlideId,
            size: {
              width:  { magnitude: w, unit: 'EMU' },
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
    )
  }

  return reqs
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function createTemplatePresentation(
  data: ProposalData,
  accessToken: string,
): Promise<CreateSlidesResult> {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  }

  // ── Phase 1: Copy the template ───────────────────────────────────────────
  const copyResp = await fetch(`${DRIVE_API}/${TEMPLATE_ID}/copy`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: data.project.title || 'New Proposal' }),
  })

  if (!copyResp.ok) {
    const err = await copyResp.json().catch(() => ({}))
    const msg = (err as any)?.error?.message || copyResp.statusText
    throw new Error(
      `Template copy failed (${copyResp.status}): ${msg}. ` +
      `If "insufficientPermissions", change 'drive.file' to 'drive' in googleAuth.ts.`,
    )
  }

  const { id: presentationId } = await copyResp.json() as { id: string }
  if (!presentationId) throw new Error('Drive copy returned no file id')

  // ── Phase 2: Read copied presentation structure ──────────────────────────
  const getResp = await fetch(`${SLIDES_API}/${presentationId}`, { headers })

  if (!getResp.ok) {
    const err = await getResp.json().catch(() => ({}))
    throw new Error(`Failed to read presentation: ${(err as any)?.error?.message || getResp.statusText}`)
  }

  const presentation = await getResp.json() as { slides?: Array<{ objectId: string; pageElements: PageElement[] }> }
  const allSlides = presentation.slides ?? []

  // Extract objectIds for the slides we care about
  const keepSlideIds = KEEP_INDICES_IN_ORDER.map(i => allSlides[i]?.objectId).filter(Boolean) as string[]
  const deleteSlideIds = DELETE_INDICES.map(i => allSlides[i]?.objectId).filter((id): id is string => Boolean(id))

  const coverSlideId  = allSlides[0]?.objectId ?? ''
  const coverElements = allSlides[0]?.pageElements ?? []

  // ── Phase 3: Build batchUpdate ───────────────────────────────────────────
  const requests: object[] = []

  // 3a: Delete unwanted slides
  for (const objectId of deleteSlideIds) {
    requests.push({ deleteObject: { objectId } })
  }

  // 3b: Reorder remaining slides into proposal order
  if (keepSlideIds.length > 0) {
    requests.push({
      updateSlidesPosition: {
        slideObjectIds: keepSlideIds,
        insertionIndex: 0,
      },
    })
  }

  // 3c: Text replacements per slide (mappers indexed same as KEEP_INDICES_IN_ORDER)
  const mappers = [
    mapCoverSlide,
    mapChallengeSlide,
    mapApproachSlide,
    mapBenefitsSlide,
    mapInvestmentSlide,
    mapMetricsSlide,
    mapNextStepsSlide,
  ]

  KEEP_INDICES_IN_ORDER.forEach((templateIndex, proposalOrder) => {
    const slide = allSlides[templateIndex]
    if (!slide) return
    const mapper = mappers[proposalOrder]
    if (mapper) requests.push(...mapper(slide.pageElements, data))
  })

  // 3d: Execute main batchUpdate
  const batchResp = await fetch(`${SLIDES_API}/${presentationId}:batchUpdate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ requests }),
  })

  if (!batchResp.ok) {
    const err = await batchResp.json().catch(() => ({}))
    throw new Error(`batchUpdate failed: ${(err as any)?.error?.message || batchResp.statusText}`)
  }

  // ── Phase 4: Logo insertion (best-effort, non-fatal) ─────────────────────
  try {
    const logoReqs = buildTemplateLogoRequests(coverElements, coverSlideId, keepSlideIds, data)
    if (logoReqs.length > 0) {
      const logoResp = await fetch(`${SLIDES_API}/${presentationId}:batchUpdate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ requests: logoReqs }),
      })
      if (!logoResp.ok) {
        const err = await logoResp.json().catch(() => ({}))
        console.warn('[TemplateSlides] Logo insertion failed:', (err as any)?.error?.message)
      }
    }
  } catch (e) {
    console.warn('[TemplateSlides] Logo insertion error (non-fatal):', e)
  }

  return {
    presentationId,
    presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
    title: data.project.title,
  }
}
