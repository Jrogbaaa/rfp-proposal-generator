import html2canvas from 'html2canvas'
import type { SlideData } from '../data/slideContent'
import type { SlideOverrides } from '../components/SlideCanvasRenderer'

const GEMINI_PROXY = '/api/gemini/generate-content'

export interface DesignFeedback {
  overrides: SlideOverrides
  qualityScore: number
  commentary: string
}

export async function captureSlideElement(el: HTMLElement): Promise<string> {
  const canvas = await html2canvas(el, {
    width: 960,
    height: 540,
    scale: 1,
    useCORS: true,
    logging: false,
    backgroundColor: null,
  })
  return canvas.toDataURL('image/png').replace('data:image/png;base64,', '')
}

export async function reviewSlideDesign(
  imageBase64: string,
  slide: SlideData,
): Promise<DesignFeedback> {
  const prompt = `You are a professional presentation design critic. Review this slide screenshot carefully.

Slide metadata:
- Type: ${slide.type}
- Title: "${slide.title}"
- Bullet count: ${slide.bullets.length}

Return ONLY valid JSON with no markdown, no explanation, no extra text:
{
  "titleTooLong": boolean,
  "suggestedTitleText": string or null,
  "tooManyBullets": boolean,
  "maxBullets": number or null,
  "titleFontSize": number or null,
  "bodyFontSize": number or null,
  "qualityScore": number between 1 and 10,
  "commentary": "one short sentence describing the main improvement made"
}

Rules:
- If the title fits well, set suggestedTitleText to null
- If bullets > 4 for a content slide, set tooManyBullets true and maxBullets to 3 or 4
- For title slides, titleFontSize should be 36-44pt. For content slides 24-30pt.
- For body text on content slides, 15-18pt is ideal
- qualityScore reflects the slide BEFORE improvements
- Keep commentary to 1 sentence, under 80 characters`

  const body = {
    contents: [
      {
        parts: [
          { inlineData: { mimeType: 'image/png', data: imageBase64 } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  }

  const resp = await fetch(GEMINI_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    console.warn('[designReview] Gemini returned', resp.status)
    return { overrides: {}, qualityScore: 7, commentary: 'Design reviewed' }
  }

  const data = await resp.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  try {
    const parsed = JSON.parse(text) as {
      titleTooLong?: boolean
      suggestedTitleText?: string | null
      tooManyBullets?: boolean
      maxBullets?: number | null
      titleFontSize?: number | null
      bodyFontSize?: number | null
      qualityScore?: number
      commentary?: string
    }

    const overrides: SlideOverrides = {}
    if (parsed.suggestedTitleText) overrides.titleText = parsed.suggestedTitleText
    if (parsed.tooManyBullets && parsed.maxBullets) overrides.maxBullets = parsed.maxBullets
    if (parsed.titleFontSize) overrides.titleFontSize = parsed.titleFontSize
    if (parsed.bodyFontSize) overrides.bodyFontSize = parsed.bodyFontSize

    return {
      overrides,
      qualityScore: parsed.qualityScore ?? 7,
      commentary: parsed.commentary ?? 'Design reviewed',
    }
  } catch {
    return { overrides: {}, qualityScore: 7, commentary: 'Design reviewed' }
  }
}

// Reviews a sample of slides (indices 0, 2, mid) to avoid excessive API calls.
// Extrapolates to all slides of the same type.
export async function runDesignLoop(
  slides: SlideData[],
  getElement: (index: number) => HTMLElement | null,
  onProgress: (info: { slideIndex: number; total: number; commentary: string; score: number }) => void,
): Promise<SlideOverrides[]> {
  const overridesMap: SlideOverrides[] = slides.map(() => ({}))

  // Pick representative indices: first, a mid content slide, last
  const reviewIndices = Array.from(new Set([
    0,
    Math.floor(slides.length / 2),
    slides.length - 1,
    slides.findIndex(s => s.type === 'content'),
    slides.findIndex(s => s.type === 'impact'),
  ])).filter(i => i >= 0 && i < slides.length)

  for (const idx of reviewIndices) {
    const el = getElement(idx)
    if (!el) continue

    try {
      const base64 = await captureSlideElement(el)
      const feedback = await reviewSlideDesign(base64, slides[idx])

      overridesMap[idx] = feedback.overrides

      // Extrapolate to other slides of same type
      slides.forEach((s, i) => {
        if (i !== idx && s.type === slides[idx].type && Object.keys(overridesMap[i]).length === 0) {
          overridesMap[i] = {
            titleFontSize: feedback.overrides.titleFontSize,
            bodyFontSize: feedback.overrides.bodyFontSize,
            maxBullets: feedback.overrides.maxBullets,
          }
        }
      })

      onProgress({
        slideIndex: idx,
        total: reviewIndices.length,
        commentary: feedback.commentary,
        score: feedback.qualityScore,
      })
    } catch (err) {
      console.warn('[designReview] Failed slide', idx, err)
    }
  }

  return overridesMap
}
