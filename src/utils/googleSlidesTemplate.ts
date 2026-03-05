/**
 * Template-based Google Slides builder
 *
 * Three-phase approach:
 *   1. POST drive.googleapis.com/v3/files/{TEMPLATE_ID}/copy — duplicate the template
 *   2. GET  slides.googleapis.com/v1/presentations/{id}      — read slide objectIds
 *   3. POST slides.googleapis.com/v1/presentations/{id}:batchUpdate — delete/reorder/populate
 *
 * Typography and visual design are inherited from the template.
 * Content is injected via replaceAllText using {{PLACEHOLDER}} markers baked into the template.
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
// Shape utilities (kept for logo placement)
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

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')

function findShape(elements: PageElement[], ...candidates: string[]): PageElement | undefined {
  for (const candidate of candidates) {
    const found = elements.find(el => norm(getAllText(el)).includes(norm(candidate)))
    if (found) return found
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

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
// Content replacement — replaceAllText for every {{PLACEHOLDER}} in template
// ---------------------------------------------------------------------------

function buildReplaceRequests(data: ProposalData): object[] {
  const { client, project, content, expanded, generated } = data
  const steps     = expanded.approachSteps ?? []
  const nextSteps = expanded.nextSteps ?? []
  const investmentItems = [
    ...steps,
    project.duration   ? `Timeline: ${project.duration}`   : 'Phased delivery',
    project.totalValue ? `Total: ${project.totalValue}`     : 'Flexible scope',
    'Ongoing support & optimization',
  ].slice(0, 6)

  const r = (text: string, replacement: string) => ({
    replaceAllText: {
      containsText: { text, matchCase: true },
      replaceText: replacement,
    },
  })

  return [
    // Cover
    r('{{COMPANY_NAME}}', client.company.toUpperCase()),
    r('{{HEADLINE}}',     project.title || 'Media Proposal'),
    r('{{SUBTITLE}}',     `A Proposal for ${client.company}`),
    r('{{DATE}}',         generated.createdDate),
    // Opportunity
    r('{{OPPORTUNITY_TITLE}}', 'The\nOpportunity'),
    r('{{OPPORTUNITY_BODY}}',  truncate(expanded.problemExpansions[0] || content.problems[0] || '', 450)),
    // Approach
    r('{{APPROACH_TITLE}}',   'Our\nApproach'),
    r('{{APPROACH_STEP_1}}',  truncate(steps[0] ?? '', 120)),
    r('{{APPROACH_STEP_2}}',  truncate(steps[1] ?? '', 120)),
    r('{{APPROACH_STEP_3}}',  truncate(steps[2] ?? '', 120)),
    // Benefits
    r('{{BENEFITS_TITLE}}',  'What You Get'),
    r('{{BENEFIT_TITLE_1}}', truncate(content.benefits[0] ?? '', 60)),
    r('{{BENEFIT_TITLE_2}}', truncate(content.benefits[1] ?? '', 60)),
    r('{{BENEFIT_TITLE_3}}', truncate(content.benefits[2] ?? '', 60)),
    r('{{BENEFIT_BODY_1}}',  truncate(expanded.benefitExpansions[0] ?? '', 200)),
    r('{{BENEFIT_BODY_2}}',  truncate(expanded.benefitExpansions[1] ?? '', 200)),
    r('{{BENEFIT_BODY_3}}',  truncate(expanded.benefitExpansions[2] ?? '', 200)),
    r('{{METRIC_LABEL_1}}',  'REACH'),
    r('{{METRIC_LABEL_2}}',  'ENGAGE'),
    r('{{METRIC_LABEL_3}}',  'CONVERT'),
    // Investment
    r('{{INVESTMENT_TITLE}}',  'Investment\n& Scope'),
    r('{{INVESTMENT_ITEM_1}}', truncate(investmentItems[0] ?? '', 100)),
    r('{{INVESTMENT_ITEM_2}}', truncate(investmentItems[1] ?? '', 100)),
    r('{{INVESTMENT_ITEM_3}}', truncate(investmentItems[2] ?? '', 100)),
    r('{{INVESTMENT_ITEM_4}}', truncate(investmentItems[3] ?? '', 100)),
    r('{{INVESTMENT_ITEM_5}}', truncate(investmentItems[4] ?? '', 100)),
    r('{{INVESTMENT_ITEM_6}}', truncate(investmentItems[5] ?? '', 100)),
    // Metrics
    r('{{METRICS_TITLE}}',  'Measuring\nSuccess'),
    r('{{METRICS_BODY}}',   'Track what matters at every stage: reach, engagement, and conversion.'),
    r('{{METRIC_VALUE}}',   project.totalValue || 'TBD'),
    r('{{METRIC_COL_1}}',   'REACH'),
    r('{{METRIC_COL_2}}',   'ENGAGE'),
    r('{{METRIC_COL_3}}',   'CONVERT'),
    r('{{METRIC_BODY_1}}',  'Impressions, reach, and brand awareness'),
    r('{{METRIC_BODY_2}}',  'Click-through, engagement rate, time on site'),
    r('{{METRIC_BODY_3}}',  'Conversions, pipeline, and revenue impact'),
    // Next Steps
    r('{{NEXT_STEPS_TITLE}}',    'Next\nSteps'),
    r('{{NEXT_STEPS_SUBTITLE}}', project.title || "Let's get started"),
    r('{{NEXT_STEPS_BODY_1}}',   truncate(nextSteps[0] ?? '', 200)),
    r('{{PILL_1}}', truncate(nextSteps[1] ?? '', 40)),
    r('{{PILL_2}}', truncate(nextSteps[2] ?? '', 40)),
    r('{{PILL_3}}', truncate(nextSteps[3] ?? '', 40)),
    r('{{PILL_4}}', truncate(nextSteps[4] ?? '', 40)),
    r('{{PILL_5}}', truncate(nextSteps[5] ?? '', 40)),
    r('{{PILL_6}}', truncate(nextSteps[6] ?? '', 40)),
  ].filter(req => (req as any).replaceAllText.replaceText !== '')
}

// ---------------------------------------------------------------------------
// Logo requests
// ---------------------------------------------------------------------------

/**
 * Build logo batchUpdate requests:
 * - Paramount logo: bottom-right corner of EVERY slide
 * - Client logo: replaces "LOGO HERE" placeholder on cover slide (if present)
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

  const keepSlideIds  = KEEP_INDICES_IN_ORDER.map(i => allSlides[i]?.objectId).filter(Boolean) as string[]
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

  // 3c: Replace all {{PLACEHOLDER}} tokens across the presentation
  requests.push(...buildReplaceRequests(data))

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
