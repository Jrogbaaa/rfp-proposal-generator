import html2canvas from 'html2canvas'
import type { SlideData } from '../data/slideContent'
import { SLIDE_W, SLIDE_H } from './design/system'
import { ALL_LAYOUTS, defaultLayoutFor, type SlideOverrides } from './design/vocabulary'

const GEMINI_PROXY = '/api/gemini/generate-content'

/** Max concurrent vision calls. Gemini Flash handles many in parallel; cap
 *  conservatively so we don't trigger upstream rate limits on a 12+ slide deck. */
const REVIEW_CONCURRENCY = 4

export interface DesignFeedback {
  overrides: SlideOverrides
  qualityScore: number
  qualityScoreAfter: number
  commentary: string
}

/**
 * Capture a slide DOM element as a base64 PNG suitable for Gemini vision.
 *
 * Waits for document.fonts.ready BEFORE rasterizing — otherwise html2canvas
 * captures fallback-font metrics and the AI sees text that doesn't match
 * what the user sees.
 */
export async function captureSlideElement(el: HTMLElement): Promise<string> {
  if (typeof document !== 'undefined' && 'fonts' in document && document.fonts?.ready) {
    try { await document.fonts.ready } catch { /* swallow — proceed with fallback */ }
  }
  const canvas = await html2canvas(el, {
    width: SLIDE_W,
    height: SLIDE_H,
    scale: 0.5, // 960x540 output — sufficient for vision, half the bytes
    useCORS: true,
    logging: false,
    backgroundColor: null,
  })
  return canvas.toDataURL('image/png').replace('data:image/png;base64,', '')
}

const REVIEW_SYSTEM_PROMPT = `You are a senior presentation designer reviewing one slide at a time.

Your job: pick a layout and emphasis that follow this rubric, then return ONLY a JSON object.

DESIGN RUBRIC (enforce strictly):
1. No filler. Every element earns its place. If a bullet is generic ("leverage synergies"), tighten or drop it.
2. Less is more. If a slide has 6+ bullets, cap to 4-5 and pick a denser layout (content-stat-grid, content-list).
3. No data slop. Do NOT promote a number unless it is a real, specific stat (e.g. "47%", "$2.4B", "12x"). Round numbers and generic counts are NOT promoted_stat material.
4. Hero the strongest token. If a bullet contains a striking specific stat, surface it as promoted_stat and switch to a stat-grid or title-stat layout. Otherwise leave promoted_stat null.
5. One accent gesture per slide is already enforced structurally — you do NOT pick accents. You pick LAYOUT, EMPHASIS, DENSITY, TONE, and (optionally) TIGHTENING.
6. The 24px-floor on body type is structural; you do not pick font sizes.
7. Type variety is structural; you do not pick fonts.

LAYOUT VARIANTS (pick exactly one):
- title-editorial    — serif headline, generous whitespace. Default for title slides.
- title-stat         — single big number + caption. Use ONLY if there is a real stat in the slide.
- section-numeral    — section divider with a giant numeral. Use for type='section' only.
- content-list       — title + numbered bullet list. Default for content slides with 3-6 bullets.
- content-two-up     — two parallel ideas side by side. Use when exactly 2 bullets compare or oppose.
- content-quote      — pulled quote with attribution. Use only when a bullet IS a quotation.
- content-stat-grid  — 2-4 stat tiles. Use only when 2-4 bullets each contain a real stat.
- content-timeline   — ordered steps. Use only when bullets describe a sequence ("first… then… finally").
- impact-statement   — one sentence, very large, ink background. Use for type='impact', or for a content slide with exactly one important bullet.
- closing-cta        — closing slide CTA. Use for type='closing' only.

EMPHASIS:
- "title"     — the headline is the hero (default for most content)
- "firstWord" — promote the first word/phrase of the title typographically
- "number"    — a numeric token in content is promoted (must set promoted_stat too)
- "none"      — even hierarchy, no token promoted

DENSITY: "sparse" (1-2 elements), "balanced" (3-5), "dense" (6+, rare).
TONE:    "editorial" (default), "corporate" (more structured), "minimal" (maximum restraint).

REWRITING:
- If the title is wordy, you MAY return a tighter title_text (≤8 words). Otherwise null.
- If a bullet is filler or generic, you MAY return tightened bullet_rewrites — SAME COUNT as input, each ≤80 chars. Otherwise null.
- If you can extract a sharper eyebrow (≤4 words, ALL CAPS implied — return mixed case is fine), return it. Otherwise null.

SCORING:
Score the CURRENT render (before your changes) against these criteria, 1-10:
- decorative_density (1=cluttered, 10=intentional)
- type_hierarchy    (1=flat, 10=clear primary/secondary/tertiary)
- whitespace_ratio  (1=cramped, 10=generous)
- content_density   (1=stuffed, 10=earned every element)
- anti_trope        (1=hits multiple AI slop tropes, 10=clean)
Return quality_score = the LOWEST of these five.
Estimate quality_score_after assuming your overrides are applied.

Commentary: ONE short sentence (<=100 chars) describing the most important change.

Return ONLY this JSON shape, no markdown, no explanation:
{
  "layout_variant": "...",
  "emphasis": "title" | "firstWord" | "number" | "none",
  "density": "sparse" | "balanced" | "dense",
  "tone": "editorial" | "corporate" | "minimal",
  "eyebrow": string | null,
  "title_text": string | null,
  "bullet_rewrites": string[] | null,
  "max_bullets": number | null,
  "promoted_stat": { "value": string, "caption": string } | null,
  "quality_score": number,
  "quality_score_after": number,
  "commentary": string
}`

interface RawReview {
  layout_variant?: string
  emphasis?: string
  density?: string
  tone?: string
  eyebrow?: string | null
  title_text?: string | null
  bullet_rewrites?: string[] | null
  max_bullets?: number | null
  promoted_stat?: { value?: string; caption?: string } | null
  quality_score?: number
  quality_score_after?: number
  commentary?: string
}

function coerceFeedback(parsed: RawReview, slide: SlideData): DesignFeedback {
  const overrides: SlideOverrides = {}

  const layout = parsed.layout_variant
  if (layout && (ALL_LAYOUTS as string[]).includes(layout)) {
    overrides.layoutVariant = layout as SlideOverrides['layoutVariant']
  } else {
    overrides.layoutVariant = defaultLayoutFor(slide)
  }

  if (parsed.emphasis && ['title', 'firstWord', 'number', 'none'].includes(parsed.emphasis)) {
    overrides.emphasis = parsed.emphasis as SlideOverrides['emphasis']
  }
  if (parsed.density && ['sparse', 'balanced', 'dense'].includes(parsed.density)) {
    overrides.density = parsed.density as SlideOverrides['density']
  }
  if (parsed.tone && ['editorial', 'corporate', 'minimal'].includes(parsed.tone)) {
    overrides.tone = parsed.tone as SlideOverrides['tone']
  }
  if (typeof parsed.eyebrow === 'string' && parsed.eyebrow.trim()) {
    overrides.eyebrow = parsed.eyebrow.trim()
  }
  if (typeof parsed.title_text === 'string' && parsed.title_text.trim()) {
    overrides.titleText = parsed.title_text.trim()
  }
  if (Array.isArray(parsed.bullet_rewrites) && parsed.bullet_rewrites.length === slide.bullets.length) {
    overrides.bulletRewrites = parsed.bullet_rewrites.map(s => String(s).trim()).filter(Boolean)
    if (overrides.bulletRewrites.length !== slide.bullets.length) {
      delete overrides.bulletRewrites  // count mismatch, reject
    }
  }
  if (typeof parsed.max_bullets === 'number' && parsed.max_bullets > 0) {
    overrides.maxBullets = Math.min(parsed.max_bullets, slide.bullets.length)
  }
  if (parsed.promoted_stat && typeof parsed.promoted_stat.value === 'string' && parsed.promoted_stat.value.trim()) {
    overrides.promotedStat = {
      value: parsed.promoted_stat.value.trim(),
      caption: (parsed.promoted_stat.caption ?? '').trim(),
    }
  }

  const score = clampScore(parsed.quality_score, 6)
  const after = clampScore(parsed.quality_score_after, Math.min(10, score + 1))
  const commentary = (parsed.commentary ?? 'Design reviewed').slice(0, 140)

  return { overrides, qualityScore: score, qualityScoreAfter: after, commentary }
}

function clampScore(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? Math.round(n) : NaN
  if (!Number.isFinite(v)) return fallback
  return Math.max(1, Math.min(10, v))
}

export async function reviewSlideDesign(
  imageBase64: string,
  slide: SlideData,
): Promise<DesignFeedback> {
  const userPrompt = `Slide context:
- Type: ${slide.type}
- Title: "${slide.title}"
- Subtitle/eyebrow: ${slide.subtitle ? `"${slide.subtitle}"` : 'none'}
- Bullet count: ${slide.bullets.length}
- Bullets: ${JSON.stringify(slide.bullets)}

Return ONLY the JSON object specified.`

  const body = {
    systemInstruction: { parts: [{ text: REVIEW_SYSTEM_PROMPT }] },
    contents: [
      {
        parts: [
          { inlineData: { mimeType: 'image/png', data: imageBase64 } },
          { text: userPrompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingLevel: 'low' },
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  }

  const resp = await fetch(GEMINI_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    console.warn('[designReview] Gemini returned', resp.status)
    return {
      overrides: { layoutVariant: defaultLayoutFor(slide) },
      qualityScore: 6,
      qualityScoreAfter: 7,
      commentary: 'Design reviewed (fallback)',
    }
  }

  const data = await resp.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  try {
    const parsed = JSON.parse(text) as RawReview
    return coerceFeedback(parsed, slide)
  } catch {
    return {
      overrides: { layoutVariant: defaultLayoutFor(slide) },
      qualityScore: 6,
      qualityScoreAfter: 7,
      commentary: 'Design reviewed (parse fallback)',
    }
  }
}

/**
 * Promise.all with a concurrency cap. Keeps the deck reviewable in roughly
 * `ceil(n / REVIEW_CONCURRENCY) * single-call-latency`, ~6s for a 12-slide deck
 * vs 30s+ serial.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * Reviews every slide in parallel (capped at REVIEW_CONCURRENCY).
 * Streams per-slide commentary back to the UI via onProgress as each completes.
 */
export async function runDesignLoop(
  slides: SlideData[],
  getElement: (index: number) => HTMLElement | null,
  onProgress: (info: { slideIndex: number; total: number; commentary: string; score: number; scoreAfter: number }) => void,
): Promise<SlideOverrides[]> {
  const overridesMap: SlideOverrides[] = slides.map(s => ({ layoutVariant: defaultLayoutFor(s) }))
  const total = slides.length

  await mapWithConcurrency(slides, REVIEW_CONCURRENCY, async (slide, idx) => {
    const el = getElement(idx)
    if (!el) return

    try {
      const base64 = await captureSlideElement(el)
      const feedback = await reviewSlideDesign(base64, slide)
      overridesMap[idx] = feedback.overrides
      onProgress({
        slideIndex: idx,
        total,
        commentary: feedback.commentary,
        score: feedback.qualityScore,
        scoreAfter: feedback.qualityScoreAfter,
      })
    } catch (err) {
      console.warn('[designReview] Failed slide', idx, err)
    }
  })

  return overridesMap
}
