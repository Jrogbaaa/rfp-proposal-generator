/**
 * Layer 4 — Harness: self-critique-and-revise pass.
 *
 * One extra Gemini call that scores a draft `ExpandedContent` against a rubric derived from
 * the persona's NON_NEGOTIABLES + the SYSTEM_PROMPT item counts, then returns a revised object
 * in the SAME schema with violations fixed.
 *
 * FAIL-OPEN by design: on any error, timeout, empty response, invalid JSON, or failed sanity
 * check, the original draft is returned unchanged. Toggle with ENABLE_SELF_CRITIQUE.
 */
import type { ExpandedContent, ParamountMediaContent } from '../../types/proposal';
import { fetchWithRetry } from '../fetchWithRetry';
import { renderKnowledgeBase, PROOF_POINTS_DATABASE } from '../trainingContext';
import { NON_NEGOTIABLES, ANTI_PATTERNS } from './persona';

// Master switch. ON for paramount-rfp decks (see llmService.ts). Flip to false to disable
// the revise pass entirely without removing the wiring.
export const ENABLE_SELF_CRITIQUE = true;

const GEMINI_PROXY = '/api/gemini/generate-content';
const NO_THINKING = { thinkingConfig: { thinkingLevel: 'low' } } as const;

export const RUBRIC = `SELF-CRITIQUE RUBRIC — score the draft against every item, then fix all violations:
1. SOURCED STATS — every number/percentage/audience figure traces to the knowledge base or proof points provided. Remove or re-ground any stat you cannot source; never invent figures.
2. NAMED PROPERTIES — no "our network", "our content", or "our talent". Every reference is a specific named property (e.g. "Big Brother S28", "VMAs 2026", "NFL on CBS").
3. COMPLETE INTEGRATIONS — every integrationConcept names a property + a mechanic + a measurable outcome. Fix any that are missing one.
4. CLIENT NAMED THROUGHOUT — the client company appears across the persuasion fields and customPlan; the deck reads bespoke, not templated.
5. VERTICAL TONE — the tone matches the brief's category (QSR/Gen Z = culture-fluent and energetic; sports = authoritative and data-confident; recruitment/government = purposeful and multi-dimensional).
6. MEASUREMENT CLOSE — a measurement framework referencing iSpot, EDO, or Comscore is present.
7. ITEM COUNTS — preserve exactly: problemExpansions 4, benefitExpansions 4, culturalShift 3, realProblem 3, costOfInaction 3, approachSteps 3 (if present), nextSteps 4 (if present); and within paramountMedia: paramountIPAlignments 4, audienceInsights 4, integrationConcepts 2, programmingCalendar 5, measurementFramework 4, investmentTiers 3.
8. NO HEDGING — remove "might", "could potentially", "we believe", "perhaps"; persuasion copy is declarative.`;

export interface CritiqueContext {
  briefText: string;
  clientCompany: string;
}

/**
 * Run one critique-and-revise pass over a draft. Returns a corrected `ExpandedContent`,
 * or the original draft unchanged if anything goes wrong (fail-open).
 */
export async function critiqueAndRevise(
  draft: ExpandedContent,
  ctx: CritiqueContext,
): Promise<ExpandedContent> {
  try {
    const systemInstruction = [
      NON_NEGOTIABLES,
      ANTI_PATTERNS,
      RUBRIC,
      renderKnowledgeBase(),
      PROOF_POINTS_DATABASE,
    ].join('\n\n');

    const userPrompt = `Client: ${ctx.clientCompany}

Brief (for tone + grounding):
---
${ctx.briefText.slice(0, 2000)}
---

Here is a DRAFT proposal as JSON. Score it against the rubric, then return the CORRECTED proposal as a single JSON object with the EXACT same keys and structure — fixing every violation while preserving everything that already passes. Do not add or remove top-level keys. Return ONLY the JSON object.

DRAFT:
${JSON.stringify(draft)}`;

    const response = await fetchWithRetry(
      GEMINI_PROXY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 32768,
            ...NO_THINKING,
            responseMimeType: 'application/json',
          },
        }),
      },
      { timeoutMs: 60_000, maxRetries: 1 },
    );

    if (!response.ok) return draft;

    const result = await response.json();
    const content: string | undefined = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return draft;

    const revised = JSON.parse(content) as Partial<ExpandedContent>;

    // Sanity check — a valid revision must keep the two required tuples at length 4.
    const pe = revised.problemExpansions;
    const be = revised.benefitExpansions;
    if (!Array.isArray(pe) || pe.length !== 4 || !Array.isArray(be) || be.length !== 4) {
      return draft;
    }

    // Shallow-merge over the draft so any key the revision omits is preserved.
    // paramountMedia is merged one level deeper to avoid dropping subfields.
    const mergedParamountMedia: ParamountMediaContent | undefined =
      draft.paramountMedia || revised.paramountMedia
        ? { ...(draft.paramountMedia as ParamountMediaContent), ...(revised.paramountMedia as ParamountMediaContent) }
        : undefined;

    return {
      ...draft,
      ...revised,
      ...(mergedParamountMedia ? { paramountMedia: mergedParamountMedia } : {}),
    };
  } catch (err) {
    console.warn('[critique] self-critique failed, returning original draft:', err instanceof Error ? err.message : err);
    return draft;
  }
}
