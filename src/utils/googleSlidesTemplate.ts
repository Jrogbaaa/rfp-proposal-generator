/**
 * Template-based Google Slides builder — clear-and-fill approach
 *
 * Copies the template for its visual design, auto-discovers slide roles from
 * {{PLACEHOLDER}} markers, then clears text and injects content from the same
 * SlideData[] that powers the preview — ensuring 1:1 parity.
 *
 * Flow:
 *   1. POST drive/v3/files/{TEMPLATE_ID}/copy — duplicate template
 *   2. GET  slides/v1/presentations/{id}      — read slide + shape structure
 *   3. Auto-discover slide roles from placeholder patterns
 *   4. Build SlideData[] via buildSlidesFromData(data) — same as preview
 *   5. Map each SlideData to a template slide (direct match or duplicate)
 *   6. POST batchUpdate — clear text + insert app content + delete unused slides
 *   7. POST batchUpdate — insert logos
 *
 * Typography and decorative elements are inherited from the template.
 * Content comes from SlideData[], including all user edits.
 */

import type { ProposalData } from '../types/proposal'
import type { SlideData } from '../data/slideContent'
import type { CreateSlidesResult } from './googleSlides'
import { buildSlidesFromData } from './slideBuilder'

const TEMPLATE_ID = '1brp4caHLITlfqqFiYUs9fNLhC_1tgWDJBzKF-0QHLf8'
const DRIVE_API   = 'https://www.googleapis.com/drive/v3/files'
const SLIDES_API  = 'https://slides.googleapis.com/v1/presentations'

const W = 9_144_000
const H = 6_858_000
const FAVICON_V2 = 'https://t1.gstatic.com/faviconV2'
const PARAMOUNT_DOMAIN = 'paramount.com'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TextRunStyle {
  fontFamily?: string
  fontSize?: { magnitude?: number; unit?: string }
  foregroundColor?: {
    opaqueColor?: { rgbColor?: { red?: number; green?: number; blue?: number } }
  }
  bold?: boolean
}

interface PageElement {
  objectId: string
  shape?: {
    text?: {
      textElements?: Array<{
        textRun?: { content?: string; style?: TextRunStyle }
        paragraphMarker?: object
      }>
    }
  }
  size?: { width?: { magnitude?: number }; height?: { magnitude?: number } }
  transform?: {
    translateX?: number
    translateY?: number
    scaleX?: number
    scaleY?: number
  }
}

interface TemplateSlide {
  objectId: string
  pageElements: PageElement[]
}

interface ContentShapeInfo {
  objectId: string
  translateY: number
  style?: TextRunStyle
}

// ---------------------------------------------------------------------------
// Shape utilities
// ---------------------------------------------------------------------------

function getAllText(el: PageElement): string {
  return (el.shape?.text?.textElements ?? [])
    .map(te => te.textRun?.content ?? '')
    .join('')
    .trim()
}

function hasPlaceholder(text: string): boolean {
  return text.includes('{{')
}

function captureStyle(el: PageElement): TextRunStyle | undefined {
  const run = (el.shape?.text?.textElements ?? []).find(te => te.textRun?.style)
  return run?.textRun?.style
}

function shapeY(el: PageElement): number {
  return el.transform?.translateY ?? 0
}

function shapeArea(el: PageElement): number {
  return (el.size?.width?.magnitude ?? 0) * (el.size?.height?.magnitude ?? 0)
}

function hasTextContent(el: PageElement): boolean {
  return (el.shape?.text?.textElements ?? []).some(
    te => te.textRun?.content && te.textRun.content.trim().length > 0,
  )
}

const STATIC_TEXT_PATTERNS = ['lorem ipsum', 'feedback date']

function isStaticText(text: string): boolean {
  const lower = text.toLowerCase()
  return STATIC_TEXT_PATTERNS.some(p => lower.includes(p))
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
// Auto-discovery: placeholder patterns → slide roles
// ---------------------------------------------------------------------------

const PLACEHOLDER_ROLE: Record<string, string> = {
  COMPANY_NAME: 'title', HEADLINE: 'title', SUBTITLE: 'title', DATE: 'title',
  OPPORTUNITY_TITLE: 'challenge', OPPORTUNITY_BODY: 'challenge',
  APPROACH_TITLE: 'approach', APPROACH_STEP_1: 'approach',
  APPROACH_STEP_2: 'approach', APPROACH_STEP_3: 'approach',
  BENEFITS_TITLE: 'solution',
  BENEFIT_TITLE_1: 'solution', BENEFIT_TITLE_2: 'solution', BENEFIT_TITLE_3: 'solution',
  BENEFIT_BODY_1: 'solution', BENEFIT_BODY_2: 'solution', BENEFIT_BODY_3: 'solution',
  METRIC_LABEL_1: 'solution', METRIC_LABEL_2: 'solution', METRIC_LABEL_3: 'solution',
  INVESTMENT_TITLE: 'investment',
  INVESTMENT_ITEM_1: 'investment', INVESTMENT_ITEM_2: 'investment',
  INVESTMENT_ITEM_3: 'investment', INVESTMENT_ITEM_4: 'investment',
  INVESTMENT_ITEM_5: 'investment', INVESTMENT_ITEM_6: 'investment',
  METRICS_TITLE: 'metrics', METRICS_BODY: 'metrics', METRIC_VALUE: 'metrics',
  METRIC_COL_1: 'metrics', METRIC_COL_2: 'metrics', METRIC_COL_3: 'metrics',
  METRIC_BODY_1: 'metrics', METRIC_BODY_2: 'metrics', METRIC_BODY_3: 'metrics',
  NEXT_STEPS_TITLE: 'nextSteps', NEXT_STEPS_SUBTITLE: 'nextSteps',
  NEXT_STEPS_BODY_1: 'nextSteps',
  PILL_1: 'nextSteps', PILL_2: 'nextSteps', PILL_3: 'nextSteps',
  PILL_4: 'nextSteps', PILL_5: 'nextSteps', PILL_6: 'nextSteps',
}

/**
 * Which template layout to duplicate when an app slide has no direct template match.
 * Maps slideKey → the template role whose design should be cloned.
 */
const LAYOUT_AFFINITY: Record<string, string> = {
  title: 'title',
  challenge: 'challenge',
  prob1: 'challenge',
  prob2: 'challenge',
  prob34: 'challenge',
  solution: 'solution',
  approach: 'approach',
  ben1: 'solution',
  ben2: 'solution',
  ben34: 'solution',
  investment: 'investment',
  nextSteps: 'nextSteps',
  closing: 'nextSteps',
}

function discoverRole(slide: TemplateSlide): string | null {
  const counts: Record<string, number> = {}
  for (const el of slide.pageElements ?? []) {
    const text = getAllText(el)
    for (const m of text.matchAll(/\{\{(\w+)\}\}/g)) {
      const role = PLACEHOLDER_ROLE[m[1]]
      if (role) counts[role] = (counts[role] ?? 0) + 1
    }
  }
  const entries = Object.entries(counts)
  if (entries.length === 0) return null
  return entries.sort((a, b) => b[1] - a[1])[0][0]
}

/**
 * Find content shapes on a template slide.
 *
 * Primary detection: shapes whose text contains {{...}} patterns.
 * Fallback (for templates with empty text boxes): the two largest text shapes.
 *
 * Returns shapes sorted top-to-bottom by Y position.
 */
function getContentShapes(slide: TemplateSlide): ContentShapeInfo[] {
  const elements = slide.pageElements ?? []

  let shapes = elements.filter(el => hasPlaceholder(getAllText(el)))

  if (shapes.length === 0) {
    shapes = elements
      .filter(el => hasTextContent(el))
      .filter(el => !isStaticText(getAllText(el)))
      .sort((a, b) => shapeArea(b) - shapeArea(a))
      .slice(0, 2)
  }

  return shapes
    .sort((a, b) => shapeY(a) - shapeY(b))
    .map(el => ({
      objectId: el.objectId,
      translateY: shapeY(el),
      style: captureStyle(el),
    }))
}

// ---------------------------------------------------------------------------
// Batch request helpers
// ---------------------------------------------------------------------------

function deleteTextReq(objectId: string): object {
  return { deleteText: { objectId, textRange: { type: 'ALL' } } }
}

function insertTextReq(objectId: string, text: string): object {
  return { insertText: { objectId, insertionIndex: 0, text } }
}

function autoFitRequest(objectId: string): object {
  return {
    updateShapeProperties: {
      objectId,
      shapeProperties: { autofit: { autofitType: 'TEXT_AUTOFIT' } },
      fields: 'autofit',
    },
  }
}

function applyStyleReq(objectId: string, style: TextRunStyle): object {
  const fields: string[] = []
  const s: Record<string, unknown> = {}
  if (style.fontFamily) { s.fontFamily = style.fontFamily; fields.push('fontFamily') }
  if (style.fontSize) { s.fontSize = style.fontSize; fields.push('fontSize') }
  if (style.foregroundColor) { s.foregroundColor = style.foregroundColor; fields.push('foregroundColor') }
  if (style.bold !== undefined) { s.bold = style.bold; fields.push('bold') }
  if (fields.length === 0) return {}
  return {
    updateTextStyle: {
      objectId,
      style: s,
      textRange: { type: 'ALL' },
      fields: fields.join(','),
    },
  }
}

// ---------------------------------------------------------------------------
// Fill logic: clear content shapes and insert SlideData content
// ---------------------------------------------------------------------------

/**
 * Short headline labels for deep-dive slides.
 * These go into the large display-font headline box (designed for 2-3 word titles).
 * The actual problem/benefit text + expansion is combined into the body box below.
 */
const DEEP_DIVE_LABEL: Record<string, string> = {
  prob1:  'Challenge 01',
  prob2:  'Challenge 02',
  prob34: 'Challenges 3 & 4',
  ben1:   'Outcome 01',
  ben2:   'Outcome 02',
  ben34:  'Benefits 3 & 4',
}

/**
 * Build requests to clear and fill a template slide's content shapes
 * with the corresponding SlideData content.
 *
 * Content distribution across shapes (sorted top-to-bottom):
 *
 *   Deep-dive slides (prob1/prob2/ben1/ben2/prob34/ben34):
 *     Shape 0 (large headline box): short label e.g. "Challenge 01"
 *     Last shape (body box):        title + bullets joined
 *
 *   All other slides:
 *     Shape 0: slide.title
 *     Shape 1: slide.subtitle (if present)
 *     Last shape: bullets joined with newlines
 *
 * TEXT_AUTOFIT is applied to every filled shape to prevent overflow.
 */
function fillSlideRequests(
  shapes: ContentShapeInfo[],
  appSlide: SlideData,
): object[] {
  if (shapes.length === 0) return []

  const key = appSlide.slideKey ?? ''
  const deepDiveLabel = DEEP_DIVE_LABEL[key]

  let items: string[]
  if (deepDiveLabel) {
    // Large headline box: concise label (fits the display font)
    // Body box: full title + expansion bullets combined
    const bodyParts = [appSlide.title]
    if (appSlide.subtitle) bodyParts.push(appSlide.subtitle)
    if (appSlide.bullets.length > 0) bodyParts.push(appSlide.bullets.join('\n'))
    items = [deepDiveLabel, bodyParts.join('\n\n')]
  } else {
    items = [appSlide.title]
    if (appSlide.subtitle) items.push(appSlide.subtitle)
    if (appSlide.bullets.length > 0) items.push(appSlide.bullets.join('\n'))
  }

  const reqs: object[] = []

  for (let i = 0; i < shapes.length; i++) {
    reqs.push(deleteTextReq(shapes[i].objectId))

    let text = ''
    if (i < items.length && i < shapes.length - 1) {
      text = items[i]
    } else if (i === shapes.length - 1) {
      text = items.slice(Math.min(i, items.length - 1)).join('\n')
    }

    if (text) {
      reqs.push(insertTextReq(shapes[i].objectId, text))
      const styleReq = shapes[i].style ? applyStyleReq(shapes[i].objectId, shapes[i].style!) : null
      if (styleReq && Object.keys(styleReq).length > 0) reqs.push(styleReq)
    }

    // Shrink text to fit the box — prevents overflow on all slide types
    reqs.push(autoFitRequest(shapes[i].objectId))
  }

  return reqs
}

/**
 * Build requests to duplicate a template slide for an app slide that
 * has no direct template counterpart, then clear and fill the duplicate.
 */
function duplicateAndFillRequests(
  sourceSlide: TemplateSlide,
  sourceShapes: ContentShapeInfo[],
  appSlide: SlideData,
  newSlideId: string,
): object[] {
  const objectIdMap: Record<string, string> = {
    [sourceSlide.objectId]: newSlideId,
  }

  const newShapes: ContentShapeInfo[] = sourceShapes.map((shape, i) => {
    const newId = `${newSlideId}_s${i}`
    objectIdMap[shape.objectId] = newId
    return { ...shape, objectId: newId }
  })

  const reqs: object[] = [
    { duplicateObject: { objectId: sourceSlide.objectId, objectIds: objectIdMap } },
  ]

  reqs.push(...fillSlideRequests(newShapes, appSlide))
  return reqs
}

// ---------------------------------------------------------------------------
// Logo requests (carried over from the original builder)
// ---------------------------------------------------------------------------

function findShape(elements: PageElement[], ...candidates: string[]): PageElement | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')
  for (const c of candidates) {
    const found = elements.find(el => norm(getAllText(el)).includes(norm(c)))
    if (found) return found
  }
  return undefined
}

function buildLogoRequests(
  coverSlideId: string,
  coverElements: PageElement[],
  allSlideIds: string[],
  data: ProposalData,
): object[] {
  const reqs: object[] = []
  const PARAM_SIZE = 457_200
  const MARGIN = 200_000

  for (const pageObjectId of allSlideIds) {
    reqs.push({
      createImage: {
        url: logoUrl(PARAMOUNT_DOMAIN),
        elementProperties: {
          pageObjectId,
          size: {
            width: { magnitude: PARAM_SIZE, unit: 'EMU' },
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

  const domain = getClientDomain(data)
  if (!domain) return reqs

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
          url: logoUrl(domain),
          elementProperties: {
            pageObjectId: coverSlideId,
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

  const presentation = await getResp.json() as { slides?: TemplateSlide[] }
  const templateSlides = presentation.slides ?? []

  // ── Phase 3: Build app slides from same source as preview ────────────────
  const appSlides = buildSlidesFromData(data)
  console.log(`[TemplateSlides] Template: ${templateSlides.length} slides | App: ${appSlides.length} slides`)

  // ── Phase 4: Auto-discover template slide roles ──────────────────────────
  const roleToTemplateIndex = new Map<string, number>()
  const templateRoles = new Map<number, string>()

  for (let i = 0; i < templateSlides.length; i++) {
    const role = discoverRole(templateSlides[i])
    if (role) {
      templateRoles.set(i, role)
      if (!roleToTemplateIndex.has(role)) {
        roleToTemplateIndex.set(role, i)
      }
    }
    console.log(`[TemplateSlides]   slide ${i} (${templateSlides[i].objectId}): role=${role ?? 'none'}`)
  }

  // Heuristic: if no 'closing' role discovered, treat the last slide with
  // text shapes (that isn't already assigned) as the closing layout.
  if (!roleToTemplateIndex.has('closing')) {
    for (let i = templateSlides.length - 1; i >= 0; i--) {
      if (!templateRoles.has(i) && templateSlides[i].pageElements?.some(el => hasTextContent(el))) {
        templateRoles.set(i, 'closing')
        roleToTemplateIndex.set('closing', i)
        console.log(`[TemplateSlides]   slide ${i}: heuristic role=closing`)
        break
      }
    }
  }

  // Pre-compute content shapes for every template slide (used for both
  // direct fills and as duplication sources).
  const shapeCache = new Map<number, ContentShapeInfo[]>()
  for (let i = 0; i < templateSlides.length; i++) {
    shapeCache.set(i, getContentShapes(templateSlides[i]))
  }

  // ── Phase 5: Build all batchUpdate requests ──────────────────────────────
  const staticDeleteReqs: object[] = []
  const duplicateReqs: object[] = []
  const clearFillReqs: object[] = []
  const slideDeleteReqs: object[] = []

  const finalSlideOrder: string[] = []
  const usedTemplateIndices = new Set<number>()
  let dupCounter = 0

  // Delete static text shapes on ALL template slides first
  for (const tSlide of templateSlides) {
    for (const el of tSlide.pageElements ?? []) {
      const text = getAllText(el)
      if (text && isStaticText(text) && !hasPlaceholder(text)) {
        staticDeleteReqs.push({ deleteObject: { objectId: el.objectId } })
      }
    }
  }

  // Process each app slide in order
  for (const appSlide of appSlides) {
    const key = appSlide.slideKey ?? ''
    const affinity = LAYOUT_AFFINITY[key] ?? 'challenge'

    // Try to find a directly-matching, unused template slide
    const directIndex = roleToTemplateIndex.get(key)
    const canDirectMatch = directIndex !== undefined && !usedTemplateIndices.has(directIndex)

    if (canDirectMatch) {
      usedTemplateIndices.add(directIndex!)
      const shapes = shapeCache.get(directIndex!) ?? []
      clearFillReqs.push(...fillSlideRequests(shapes, appSlide))
      finalSlideOrder.push(templateSlides[directIndex!].objectId)
      console.log(`[TemplateSlides]   "${key}" → direct match slide ${directIndex}`)
    } else {
      // No direct match — duplicate a suitable template layout
      const sourceIndex = roleToTemplateIndex.get(affinity)
        ?? roleToTemplateIndex.get('challenge')
        ?? roleToTemplateIndex.values().next().value

      if (sourceIndex === undefined) {
        console.warn(`[TemplateSlides]   "${key}" → no layout source available, skipping`)
        continue
      }

      const sourceSlide = templateSlides[sourceIndex]
      const sourceShapes = shapeCache.get(sourceIndex) ?? []
      const newSlideId = `dup_${key.replace(/[^a-zA-Z0-9_]/g, '_')}_${dupCounter++}`

      duplicateReqs.push(
        ...duplicateAndFillRequests(sourceSlide, sourceShapes, appSlide, newSlideId),
      )
      finalSlideOrder.push(newSlideId)
      console.log(`[TemplateSlides]   "${key}" → duplicate from slide ${sourceIndex} as ${newSlideId}`)
    }
  }

  // Delete all template slides not directly used
  for (let i = 0; i < templateSlides.length; i++) {
    if (!usedTemplateIndices.has(i)) {
      slideDeleteReqs.push({ deleteObject: { objectId: templateSlides[i].objectId } })
    }
  }

  // Reorder slides to match the app's slide order.
  // updateSlidesPosition requires slideObjectIds to be in the CURRENT presentation
  // order — not the desired order. To avoid this constraint, move one slide at a
  // time (single-element arrays are always valid), processing in reverse so each
  // slide lands at insertionIndex 0 and pushes previously-placed slides down.
  const reorderReqs: object[] = [...finalSlideOrder].reverse().map(slideId => ({
    updateSlidesPosition: { slideObjectIds: [slideId], insertionIndex: 0 },
  }))

  // Assemble requests in the correct execution order:
  //   1. Delete static text shapes
  //   2. Duplicate slides (creates new slides with template design)
  //   3. Clear + fill content shapes (both originals and duplicates)
  //   4. Delete unused template slides
  //   5. Reorder final slides
  const allRequests = [
    ...staticDeleteReqs,
    ...duplicateReqs,
    ...clearFillReqs,
    ...slideDeleteReqs,
    ...reorderReqs,
  ]

  // ── Phase 6: Execute main batchUpdate ────────────────────────────────────
  if (allRequests.length > 0) {
    const batchResp = await fetch(`${SLIDES_API}/${presentationId}:batchUpdate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requests: allRequests }),
    })

    if (!batchResp.ok) {
      const err = await batchResp.json().catch(() => ({}))
      throw new Error(`batchUpdate failed: ${(err as any)?.error?.message || batchResp.statusText}`)
    }
  }

  // ── Phase 7: Logo insertion (best-effort, non-fatal) ─────────────────────
  try {
    const readResp = await fetch(`${SLIDES_API}/${presentationId}`, { headers })
    if (readResp.ok) {
      const pres = await readResp.json() as { slides?: TemplateSlide[] }
      const finalSlides = pres.slides ?? []
      const allSlideIds = finalSlides.map(s => s.objectId)
      const coverSlideId = finalSlides[0]?.objectId ?? ''
      const coverElements = finalSlides[0]?.pageElements ?? []

      const logoReqs = buildLogoRequests(coverSlideId, coverElements, allSlideIds, data)
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
    }
  } catch (e) {
    console.warn('[TemplateSlides] Logo insertion error (non-fatal):', e)
  }

  console.log(`[TemplateSlides] Done — ${finalSlideOrder.length} slides in final deck`)

  return {
    presentationId,
    presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
    title: data.project.title,
  }
}
