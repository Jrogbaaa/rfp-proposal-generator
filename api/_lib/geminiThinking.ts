// Shared by the Vercel serverless function (api/gemini/generate-content.ts) and
// the Express dev proxy (server/routes/gemini.ts) so both speak the same dialect.
//
// Gemini thinking config is model-dependent:
//   - Gemini 3+ models expect `thinkingConfig.thinkingLevel` (string) and reject
//     `thinkingBudget` with "Unknown name".
//   - Gemini 2.x models expect `thinkingConfig.thinkingBudget` (integer) and reject
//     `thinkingLevel` with "Thinking level is not supported for this model."
//
// The client always sends `thinkingLevel: 'low'`; this normalises it for whatever
// model GEMINI_MODEL resolves to, so dev and prod stay consistent.

type ThinkingConfig = { thinkingLevel?: string; thinkingBudget?: number }
type GeminiBody = {
  generationConfig?: { thinkingConfig?: ThinkingConfig } & Record<string, unknown>
} & Record<string, unknown>

export function normalizeThinkingConfig<T extends GeminiBody>(body: T, model: string): T {
  const tc = body.generationConfig?.thinkingConfig
  if (!tc) return body

  const isGemini3OrNewer = /^gemini-(3|[4-9])/.test(model)

  if (isGemini3OrNewer) {
    // Gemini 3+ uses thinkingLevel. Convert a numeric budget if a caller sent one.
    if (tc.thinkingBudget !== undefined && tc.thinkingLevel === undefined) {
      return {
        ...body,
        generationConfig: {
          ...body.generationConfig,
          thinkingConfig: { thinkingLevel: tc.thinkingBudget === 0 ? 'low' : 'high' },
        },
      }
    }
    return body
  }

  // Gemini 2.x uses thinkingBudget. Convert a string level if the client sent one.
  if (tc.thinkingLevel !== undefined && tc.thinkingBudget === undefined) {
    const level = tc.thinkingLevel
    const budget = level === 'none' || level === 'low' ? 0 : level === 'high' ? 24576 : 8192
    return {
      ...body,
      generationConfig: {
        ...body.generationConfig,
        thinkingConfig: { thinkingBudget: budget },
      },
    }
  }

  return body
}
