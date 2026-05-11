import type { ProposalData, ExpandedContent, DesignConfig, AdditionalSlide, BrandVoiceProfile, ParamountMediaContent, IPAlignment, IntegrationConcept, CalendarItem, InvestmentTier, DeckType, FlexibleSlide, ShowcaseContent, ProofPoint, CustomClientPlan, IndustryInsight } from '../types/proposal';
import { PARAMOUNT_TRAINING_CONTEXT, PROOF_POINTS_DATABASE, INDUSTRY_INSIGHTS_MAP } from './trainingContext';
import { fetchWithRetry } from './fetchWithRetry';

const GEMINI_PROXY   = '/api/gemini/generate-content';
const FILES_PROXY_UPLOAD = '/api/gemini/upload-file';
const FILES_PROXY_DELETE = '/api/gemini/files';

const NO_THINKING = { thinkingConfig: { thinkingLevel: 'low' } } as const;
const MAX_RETRIES = 2;

export class GeminiBlockedError extends Error {
  constructor(reason: string, detail?: string) {
    super(detail ? `${reason}: ${detail}` : reason)
    this.name = 'GeminiBlockedError'
  }
}

/**
 * Validates the parsed JSON body of a Gemini API response.
 * Detects 200 OK responses that contain error payloads or safety blocks.
 */
function validateGeminiBody(result: Record<string, unknown>): void {
  if (result.error && typeof result.error === 'object') {
    const err = result.error as Record<string, unknown>
    const code = err.code ?? err.status ?? 'UNKNOWN'
    const msg = (err.message as string) || 'Gemini returned an error'
    throw new GeminiBlockedError(`GEMINI_ERROR_${code}`, msg)
  }

  const candidate = (result.candidates as Record<string, unknown>[])?.[0]
  if (candidate?.finishReason === 'SAFETY') {
    const ratings = candidate.safetyRatings as Record<string, string>[] | undefined
    const flagged = ratings?.filter(r => r.probability !== 'NEGLIGIBLE').map(r => r.category).join(', ')
    throw new GeminiBlockedError('SAFETY_BLOCKED', flagged || 'Content flagged by safety filter')
  }

  if (candidate?.finishReason === 'RECITATION') {
    throw new GeminiBlockedError('RECITATION_BLOCKED', 'Response blocked due to recitation concerns')
  }
}

// PDFs ≤ 15MB use inline_data; larger files upload via Files API first
const LARGE_PDF_THRESHOLD = 15 * 1024 * 1024;
// Gemini hard limit: 50MB / 1000 pages
export const MAX_PDF_SIZE = 50 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is "data:application/pdf;base64,<data>"
      resolve(result.split(',')[1]);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Upload a file to the Gemini Files API via the backend proxy.
// Used for PDFs > LARGE_PDF_THRESHOLD to avoid large inline request bodies.
async function uploadToFilesApi(file: File): Promise<string> {
  const base64Data = await fileToBase64(file);
  const response = await fetchWithRetry(FILES_PROXY_UPLOAD, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Data, mimeType: file.type || 'application/pdf', fileName: file.name }),
  }, { timeoutMs: 90_000 });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Files API upload failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const fileUri: string | undefined = result.fileUri;
  if (!fileUri) throw new Error('Files API did not return a file URI');
  return fileUri;
}

// Fire-and-forget cleanup; files auto-delete after 48h anyway
function deleteFilesApiFile(fileUri: string): void {
  const match = fileUri.match(/\/files\/([^/?]+)/);
  if (!match) return;
  fetch(`${FILES_PROXY_DELETE}/${match[1]}`, { method: 'DELETE' }).catch(() => {});
}

// Strip markdown code fences that Gemini sometimes wraps JSON in
function extractJsonFromText(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return text.trim();
}

// Build the brief text format that useBriefParser understands
function buildBriefText(extracted: Record<string, unknown>): string {
  const lines: string[] = [];

  if (extracted.projectTitle) lines.push(`Project: ${extracted.projectTitle}`);

  const nameParts = [extracted.clientFirstName, extracted.clientLastName].filter(Boolean);
  const clientParts = [...nameParts];
  if (extracted.clientEmail) clientParts.push(extracted.clientEmail as string);
  if (extracted.clientCompany) clientParts.push(extracted.clientCompany as string);
  if (clientParts.length) lines.push(`Client: ${clientParts.join(', ')}`);

  if (extracted.timeline) lines.push(`Timeline: ${extracted.timeline}`);
  if (extracted.budget) lines.push(`Budget: ${extracted.budget}`);

  if (Array.isArray(extracted.problems) && extracted.problems.length) {
    lines.push('');
    lines.push('Problems:');
    (extracted.problems as string[]).forEach(p => lines.push(`- ${p}`));
  }

  if (Array.isArray(extracted.benefits) && extracted.benefits.length) {
    lines.push('');
    lines.push('Benefits:');
    (extracted.benefits as string[]).forEach(b => lines.push(`- ${b}`));
  }

  if (extracted.brandNotes) {
    lines.push('');
    lines.push(`Brand Notes: ${extracted.brandNotes}`);
  }

  return lines.join('\n');
}

const PDF_EXTRACTION_PROMPT = `You are analyzing a brand brief, RFP, or presentation PDF.
Extract all available information and return ONLY valid JSON with this structure:
{
  "clientFirstName": "",
  "clientLastName": "",
  "clientEmail": "",
  "clientCompany": "",
  "projectTitle": "",
  "timeline": "",
  "budget": "",
  "problems": [],
  "benefits": [],
  "brandNotes": ""
}

Instructions:
- Examine ALL pages including images, slides, charts, and diagrams
- Extract the client/prospect company name from logos, headers, or visible text
- Extract the contact person's name and email if present
- Identify the project title or engagement name
- Extract timeline/duration and budget/investment figures if present
- Find pain points, challenges, or problems the client faces (up to 4 items)
- Find desired outcomes, goals, or benefits they want to achieve (up to 4 items)
- In brandNotes: describe visual brand elements — color palette, logo style, overall brand tone, and any imagery that reveals company identity or industry context
- If a field is not found, use empty string or empty array

IMPORTANT: Return ONLY the JSON object, no markdown formatting or code blocks.`;

export async function analyzeBriefPdf(file: File): Promise<string> {
  if (file.size > MAX_PDF_SIZE) {
    throw new Error('PDF too large. Maximum file size is 50MB.');
  }

  // Choose upload strategy based on file size
  let pdfPart: object;
  let uploadedFileUri: string | null = null;

  if (file.size > LARGE_PDF_THRESHOLD) {
    console.log(`[LLM Service] Large PDF (${(file.size / 1024 / 1024).toFixed(1)}MB) — uploading via Files API`);
    uploadedFileUri = await uploadToFilesApi(file);
    pdfPart = { file_data: { mime_type: 'application/pdf', file_uri: uploadedFileUri } };
  } else {
    const base64Data = await fileToBase64(file);
    pdfPart = { inline_data: { mime_type: 'application/pdf', data: base64Data } };
  }

  const makeRequest = (withResponseMimeType: boolean) =>
    fetchWithRetry(GEMINI_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [pdfPart, { text: PDF_EXTRACTION_PROMPT }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          ...NO_THINKING,
          ...(withResponseMimeType ? { responseMimeType: 'application/json' } : {}),
        },
      }),
      // Each PDF attempt occupies the Vercel function for up to ~58s. Cap retries at 1
      // (2 attempts total) so users wait at most ~2 min before falling back to paste.
    }, { timeoutMs: 90_000, maxRetries: 1 });

  try {
    let response = await makeRequest(true);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM Service] PDF analysis error:', errorText);
      throw new Error(`Gemini PDF analysis failed: ${response.status}`);
    }

    let result = await response.json();
    validateGeminiBody(result);
    let contentText: string = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!contentText) {
      throw new Error('No content returned from Gemini PDF analysis');
    }

    let extracted: Record<string, unknown> | null = null;
    try {
      extracted = JSON.parse(contentText);
    } catch {
      console.warn('[LLM Service] PDF JSON parse failed, retrying without responseMimeType...');
      response = await makeRequest(false);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini PDF analysis retry failed: ${response.status} - ${errorText}`);
      }
      result = await response.json();
      validateGeminiBody(result);
      contentText = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!contentText) throw new Error('No content returned from Gemini PDF analysis retry');
      try {
        extracted = JSON.parse(extractJsonFromText(contentText));
      } catch {
        console.error('[LLM Service] Failed to parse PDF analysis response after retry:', contentText.slice(0, 500));
        throw new Error('Failed to parse PDF analysis response as JSON');
      }
    }

    return buildBriefText(extracted!);
  } finally {
    // Clean up Files API upload (fire-and-forget; files auto-delete after 48h)
    if (uploadedFileUri) deleteFilesApiFile(uploadedFileUri);
  }
}

const BRAND_VOICE_PROMPT = `You are analyzing proposal documents to extract a structured brand voice profile.

Examine all content and return ONLY valid JSON with this exact structure:
{
  "tone": ["descriptor1", "descriptor2"],
  "sentenceStyle": "Description of sentence patterns and rhythm",
  "perspective": "Description of POV and address style",
  "forbiddenPhrases": ["phrase1", "phrase2"],
  "preferredVocabulary": ["term1", "term2", "term3"],
  "ctaStyle": "Description of call-to-action language and closing patterns",
  "proseSummary": "2-3 sentence human-readable summary of this brand's writing style."
}

Instructions:
- tone: 2-5 short descriptors (e.g. ["authoritative", "direct", "data-driven", "urgent"])
- sentenceStyle: describe sentence length, rhythm, active vs passive, use of imperatives or questions
- perspective: describe POV (e.g. "Second-person 'you' focus", "First-person plural 'we/our'")
- forbiddenPhrases: 3-8 hedging words or phrases this brand avoids (e.g. ["might", "could potentially", "we believe", "perhaps"])
- preferredVocabulary: 5-10 power words, industry terms, or signature phrases this brand uses
- ctaStyle: describe call-to-action patterns — preferred verbs, urgency, how they close arguments
- proseSummary: 2-3 sentences a copywriter can quickly read to absorb and apply the style

IMPORTANT: Return ONLY the JSON object, no markdown formatting or code blocks.`;

export async function extractBrandVoice(files: File[]): Promise<BrandVoiceProfile> {
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  if (totalSize > MAX_PDF_SIZE) {
    throw new Error('Combined file size too large. Maximum total is 50MB.');
  }

  // If total size exceeds threshold, upload all files via Files API
  const useFilesApi = totalSize > LARGE_PDF_THRESHOLD;
  const uploadedUris: string[] = [];

  let fileParts: object[];
  try {
    if (useFilesApi) {
      console.log(`[LLM Service] Large brand voice files (${(totalSize / 1024 / 1024).toFixed(1)}MB total) — uploading via Files API`);
      const uris = await Promise.all(files.map(f => uploadToFilesApi(f)));
      uploadedUris.push(...uris);
      fileParts = uris.map(uri => ({ file_data: { mime_type: 'application/pdf', file_uri: uri } }));
    } else {
      const base64Files = await Promise.all(files.map(fileToBase64));
      fileParts = base64Files.map((data, i) => ({
        inline_data: { mime_type: files[i].type || 'application/pdf', data },
      }));
    }

    let content: string | undefined;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetchWithRetry(GEMINI_PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [...fileParts, { text: BRAND_VOICE_PROMPT }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2048,
            ...NO_THINKING,
            responseMimeType: 'application/json',
          },
        }),
      }, { timeoutMs: 90_000 });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[LLM Service] Brand voice extraction error:', errorText);
        throw new Error(`Gemini brand voice extraction failed: ${response.status}`);
      }

      const result = await response.json();
      validateGeminiBody(result);
      content = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) break;

      if (attempt < MAX_RETRIES) {
        console.warn(`[LLM Service] Empty brand voice response, retrying (${attempt + 1}/${MAX_RETRIES})…`);
      }
    }

    if (!content) {
      throw new Error('No content returned from brand voice extraction after retries');
    }

    let profile: BrandVoiceProfile;
    try {
      profile = JSON.parse(extractJsonFromText(content));
    } catch {
      console.error('[LLM Service] Failed to parse brand voice JSON:', content.slice(0, 300));
      throw new Error('Failed to parse brand voice response as JSON');
    }

    // Ensure required fields exist with safe defaults
    return {
      tone: Array.isArray(profile.tone) ? profile.tone : [],
      sentenceStyle: profile.sentenceStyle || '',
      perspective: profile.perspective || '',
      forbiddenPhrases: Array.isArray(profile.forbiddenPhrases) ? profile.forbiddenPhrases : [],
      preferredVocabulary: Array.isArray(profile.preferredVocabulary) ? profile.preferredVocabulary : [],
      ctaStyle: profile.ctaStyle || '',
      proseSummary: profile.proseSummary || '',
    };
  } finally {
    uploadedUris.forEach(uri => deleteFilesApiFile(uri));
  }
}

// Format a BrandVoiceProfile as structured constraints for injection into LLM prompts
function formatBrandVoiceConstraints(profile: BrandVoiceProfile): string {
  const lines = ['BRAND VOICE CONSTRAINTS — follow these rules exactly in all copy you produce:'];
  if (profile.tone.length) lines.push(`- Tone: ${profile.tone.join(', ')}`);
  if (profile.sentenceStyle) lines.push(`- Sentence style: ${profile.sentenceStyle}`);
  if (profile.perspective) lines.push(`- Perspective: ${profile.perspective}`);
  if (profile.forbiddenPhrases.length) lines.push(`- FORBIDDEN phrases (never use): ${profile.forbiddenPhrases.join(', ')}`);
  if (profile.preferredVocabulary.length) lines.push(`- Preferred vocabulary: ${profile.preferredVocabulary.join(', ')}`);
  if (profile.ctaStyle) lines.push(`- CTA style: ${profile.ctaStyle}`);
  return lines.join('\n');
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface LLMResponse {
  problemExpansions: string[];
  benefitExpansions: string[];
  approachSteps: string[];
  nextSteps: string[];
  deckType?: string;
  paramountMedia?: ParamountMediaContent;
  showcaseContent?: unknown;
  flexibleSlides?: unknown[];
  culturalShift?: string[];
  realProblem?: string[];
  costOfInaction?: string[];
  coreInsight?: string;
  proofPoints?: ProofPoint[];
  customPlan?: CustomClientPlan;
  industryInsights?: IndustryInsight[];
}

const SYSTEM_PROMPT = `You are a senior Paramount Advertising Solutions sales executive writing a custom media partnership proposal. You build PERSUASION DECKS, not informational slides. Every deck must create urgency, reframe thinking, prove impact, and show tailored execution.

You MUST output valid JSON with this exact structure:
{
  "problemExpansions": ["paragraph1", "paragraph2", "paragraph3", "paragraph4"],
  "benefitExpansions": ["paragraph1", "paragraph2", "paragraph3", "paragraph4"],
  "approachSteps": ["step1", "step2", "step3"],
  "nextSteps": ["action1", "action2", "action3", "action4"],
  "culturalShift": ["insight1", "insight2", "insight3"],
  "realProblem": ["point1", "point2", "point3"],
  "costOfInaction": ["cost1", "cost2", "cost3"],
  "coreInsight": "One powerful reframe sentence",
  "proofPoints": [
    {"stat": "+102% brand preference lift", "source": "Dunkin' × Big Brother S27", "context": "Season-long integration with breakfast rewards mechanic"},
    {"stat": "+99% purchase intent lift", "source": "Dunkin' × VMAs 2025", "context": "Custom talent activation with shoppable AR"}
  ],
  "customPlan": {
    "recommendedProperties": ["Big Brother S28", "VMAs 2026"],
    "formats": ["Season-long integration", "Custom talent sketches", "Shoppable AR/QR"],
    "audienceMatch": "Why this specific audience aligns with these properties",
    "timeline": "Q3 2026 – Q1 2027"
  },
  "industryInsights": [
    {"trend": "Industry-specific trend", "implication": "What it means for this brand", "category": "QSR"}
  ],
  "paramountMedia": {
    "opportunityStatement": "2-3 sentence 'why now' hook leading with what makes this partnership a first-ever or exclusive cultural moment",
    "paramountIPAlignments": [
      {
        "propertyName": "Big Brother S28",
        "description": "1-2 sentences on why this specific property fits the brand's target audience and brief goals",
        "audienceStat": "Specific viewership/demographic stat e.g. 6.8M avg viewers, 61% female, 54% Gen Z",
        "network": "CBS or Paramount+ or MTV etc."
      }
    ],
    "audienceInsights": ["stat bullet 1", "stat bullet 2", "stat bullet 3", "stat bullet 4"],
    "integrationConcepts": [
      {
        "conceptTitle": "Specific concept name e.g. Big Brother Breakfast Rewards Mechanic",
        "property": "Named Paramount property",
        "mechanic": "2-3 sentences describing the exact integration mechanic — what happens on screen, in-app, or in-store",
        "outcome": "Measurable outcome: visits, installs, impressions, or conversion lift"
      }
    ],
    "talentOpportunities": ["Named talent + mechanic e.g. Meg Stalter custom brand sketches during VMAs pre-show", "..."],
    "programmingCalendar": [
      {
        "tentpole": "68th GRAMMY Awards",
        "date": "February 2, 2026",
        "reach": "20M+ viewers",
        "opportunity": "One sentence on what the brand could own at this moment"
      }
    ],
    "measurementFramework": ["iSpot deterministic sales lift measurement", "EDO search lift + conversion correlation", "Comscore cross-platform deduplicated reach", "Paramount first-party data targeting — 130M+ authenticated users"],
    "investmentTiers": [
      {
        "tierName": "Core",
        "budget": "$X–$YM",
        "inclusions": ["inclusion 1", "inclusion 2", "inclusion 3"]
      }
    ],
    "proofPoints": [
      {"stat": "+102% brand preference lift", "source": "Dunkin' × Big Brother S27"}
    ],
    "industryInsights": [
      {"trend": "Industry trend", "implication": "What it means", "category": "QSR"}
    ],
    "nextSteps": ["action 1", "action 2", "action 3", "action 4"],
    "appendixItems": ["supporting data point or case study 1", "supporting data point 2", "supporting data point 3"]
  }
}

══ PERSUASION-ENGINE SLIDE STRUCTURE ══
The deck follows an 11-slide persuasion arc. Your content drives these slides:

SLIDE 1 — COVER (auto-generated from brief metadata)
SLIDE 2 — THE NEW REALITY OF ATTENTION (culturalShift)
  Goal: Make the client feel their current strategy is outdated.
  - 3 items about media fragmentation, Gen Z behavior shifts, and attention crisis
  - Reference specific data: Gen Z lives in fan communities not channels, co-viewing + streaming fragmentation, TikTok-first discovery
  - Personalize to the client's industry using INDUSTRY_INSIGHTS provided

SLIDE 3 — WHY MOST BRAND CAMPAIGNS FAIL TODAY (realProblem)
  Goal: Reframe — interruptive ads don't create impact.
  - 3 items: interruptive ads fail, media spend ≠ cultural relevance, brands are present but not remembered
  - This is the REFRAME MOMENT — shift the client's mental model

SLIDE 4 — WHAT THIS IS COSTING YOU (costOfInaction)
  Goal: Quantify the pain of not acting.
  - 3 items: lost attention, low brand recall, weak emotional connection
  - Reference attention vs. engagement gap, declining ROI on traditional ads
  - Use industry-specific data from INDUSTRY_INSIGHTS

SLIDE 5 — THE REFRAME / MONEY SLIDE (coreInsight)
  Goal: Deliver the core thesis that changes everything.
  - One powerful sentence: "Winning Brands Don't Buy Media — They Join Culture"
  - Then show proof via Big Brother integrations, VMAs moments, talent + fandom + live moments
  - Example: "Cups in hands & feeds" → brand becomes part of content

SLIDE 6 — HOW PARAMOUNT TURNS BRANDS INTO CULTURAL MOMENTS (paramountMedia.opportunityStatement + paramountIPAlignments)
  Goal: Position Paramount as the solution.
  - IP (Big Brother, VMAs, sports), Talent, Multi-platform distribution, Integration formats (not just ads)

SLIDE 7 — PROVEN IMPACT AT SCALE (proofPoints)
  Goal: Prove it works with hard numbers.
  - 3-5 proof points with stat, source, and context
  - Pull from the PROOF_POINTS_DATABASE provided — always attribute sources
  - Frame as: "When brands integrate into culture — this happens"

SLIDE 8 — FROM IDEA TO CULTURAL MOMENT (approachSteps — 3 clean steps)
  Goal: Show it's simple and executable.
  1. Identify cultural moment (IP)
  2. Design native integration
  3. Amplify across platforms
  - Use examples: season-long integration (Big Brother), social-first extensions, shoppable + in-store tie-ins

SLIDE 9 — YOUR OPPORTUNITY WITH PARAMOUNT (customPlan)
  Goal: Make it feel bespoke, not templated.
  - Specific shows/events for THIS client
  - Specific formats for THIS client
  - Specific audience match for THIS client
  - This must reference the client by name and feel tailored

SLIDE 10 — INVESTMENT VS IMPACT (paramountMedia.investmentTiers)
  Goal: Frame ROI, not just cost.
  - Reach, Engagement, Conversion pathways (QR, app, retail)
  - Example: Driving in-store visits + app usage

SLIDE 11 — NEXT STEPS (nextSteps)
  Goal: Make it frictionless.
  - Lock inventory, Confirm concept, Go live timeline

SLIDE 12 — CLOSE (auto-generated: "Let's build this together.")

══ DYNAMIC CLIENT PERSONALIZATION ══
Every slide must reference the CLIENT BY NAME. Use their industry, competitors, and audience in every section.
- culturalShift: reference the client's specific industry challenges
- costOfInaction: use their category's declining metrics
- customPlan: only recommend properties that fit their audience demographics
- industryInsights: select the matching category from the INDUSTRY_INSIGHTS provided

══ AUTOMATED PROOF INSERTION ══
Pull specific stats from the PROOF_POINTS_DATABASE provided in your training context.
- proofPoints: select 3-5 most relevant to the client's category and goals
- Always include the stat, source attribution, and brief context
- Prefer proof points from similar verticals (QSR→Dunkin', sports→Under Armour, recruitment→Army)

══ FIELD-SPECIFIC INSTRUCTIONS ══

PROBLEM EXPANSIONS (4 items — kept for content review UI):
- 2-3 sentences each describing why this brand needs a Paramount partnership right now
- Reference specific audience gaps, competitive threats, or cultural moments the brand is missing

BENEFIT EXPANSIONS (4 items — kept for content review UI):
- 2-3 sentences each on what the brand gains from this Paramount partnership
- Lead with a concrete outcome (reach, cultural credibility, Gen Z audience access, measurable lift)

culturalShift: EXACTLY 3 items. Industry-personalized insights about attention fragmentation, Gen Z behavior, cultural shift.

realProblem: EXACTLY 3 items. Why interruptive advertising fails, media ≠ relevance, presence ≠ remembrance.

costOfInaction: EXACTLY 3 items. Quantified costs — lost attention, declining recall, weak emotional connection. Use industry stats.

coreInsight: 1 powerful sentence. The reframe thesis. Adapt to the client but keep the core: brands must join culture, not just buy media.

proofPoints: 3-5 items with stat, source, context. Pull from PROOF_POINTS_DATABASE.

customPlan: Bespoke for THIS client. recommendedProperties (2-4 shows/events), formats (2-4 integration types), audienceMatch (1-2 sentences), timeline.

industryInsights: 2-3 items. Match the client's industry from INDUSTRY_INSIGHTS. Include trend, implication, category.

approachSteps: EXACTLY 3 items. "Identify cultural moment (IP)" → "Design native integration" → "Amplify across platforms."

paramountIPAlignments: EXACTLY 4 items. Best Paramount properties for this brand.
audienceInsights: EXACTLY 4 bullet points with specific stats.
integrationConcepts: EXACTLY 2 items. Specific, executable activations.
talentOpportunities: 3-4 items. Named talent with mechanics.
programmingCalendar: EXACTLY 5 items. Real 2026 dates.
measurementFramework: EXACTLY 4 bullets. iSpot, EDO, Comscore + brand-specific KPI.
investmentTiers: EXACTLY 3 tiers — "Core," "Enhanced," "Signature."
nextSteps: EXACTLY 4 action items. Low-friction, energizing.
appendixItems: 3 items. Case study + audience data + measurement proof.

IMPORTANT: Return ONLY the JSON object, no markdown formatting or code blocks.`;

// Paramount IP showcase deck — free-form request about Paramount properties/portfolio
const SHOWCASE_SYSTEM_PROMPT = `You are a senior Paramount Advertising Solutions strategist building an IP showcase presentation. The user wants to create a presentation about specific Paramount properties, portfolio, or content slate — not a client RFP.

You MUST output valid JSON with this exact structure:
{
  "deckType": "paramount-showcase",
  "problemExpansions": ["", "", "", ""],
  "benefitExpansions": ["", "", "", ""],
  "approachSteps": [],
  "nextSteps": [],
  "showcaseContent": {
    "showcaseTitle": "A clear, compelling title for this showcase presentation",
    "executiveSummary": "2-3 sentence executive overview of what this deck covers and why it matters",
    "slides": [
      {
        "slideKey": "unique_snake_case_id",
        "title": "Slide Title",
        "subtitle": "Optional subtitle or section label",
        "bullets": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"]
      }
    ],
    "audienceInsights": ["stat bullet 1", "stat bullet 2", "stat bullet 3", "stat bullet 4"],
    "measurementFramework": ["iSpot deterministic sales lift measurement", "EDO search lift + conversion correlation", "Comscore cross-platform deduplicated reach", "Paramount first-party data — 130M+ authenticated users"]
  }
}

SHOWCASE SLIDES (6–15 slides):
- Build the full slide sequence based on what the user requested
- Each slide should have 2–5 compelling bullet points with specific stats, show names, talent, or dates
- Use the full Paramount IP inventory, talent roster, and 2026 programming calendar from your training context
- Include specific season numbers, air dates, audience demographics, and cross-platform data
- Tailor the slide sequence to match the specific request (e.g. comedy portfolio = comedy-focused shows; Q1 = Q1 tentpoles only)
- Cover slide and closing/next-steps slide are optional — focus on the content

audienceInsights: 4 bullet points with real Paramount audience stats drawn from training context.
measurementFramework: Always include iSpot, EDO, Comscore, and one context-appropriate fourth KPI.

IMPORTANT: Return ONLY the JSON object, no markdown formatting or code blocks.`;

// Generic flexible deck — non-Paramount or truly free-form presentation requests
const GENERIC_SYSTEM_PROMPT = `You are a professional presentation strategist. The user wants to create a custom presentation. Build the best possible deck for their stated request.

You MUST output valid JSON with this exact structure:
{
  "deckType": "generic",
  "problemExpansions": ["", "", "", ""],
  "benefitExpansions": ["", "", "", ""],
  "approachSteps": [],
  "nextSteps": [],
  "flexibleSlides": [
    {
      "slideKey": "unique_snake_case_id",
      "title": "Slide Title",
      "subtitle": "Optional subtitle",
      "bullets": ["bullet 1", "bullet 2", "bullet 3"]
    }
  ]
}

SLIDE GUIDELINES:
- Build 6–15 slides that directly address the user's request
- Each slide should have 2–5 focused bullet points
- Structure the deck logically: intro/context → core content → supporting evidence → conclusion/next steps
- Match the tone and focus to the specific request (technical, strategic, sales, educational, etc.)
- Do NOT inject Paramount branding or properties unless the user explicitly mentions Paramount

IMPORTANT: Return ONLY the JSON object, no markdown formatting or code blocks.`;

/**
 * Detect the deck type from the brief text synchronously (no LLM call).
 * Returns 'paramount-rfp' (default), 'paramount-showcase', or 'generic'.
 */
export function detectDeckType(briefText: string): DeckType {
  const text = briefText.toLowerCase();

  // Structured brand brief — has explicit Client/Problems/Benefits sections
  const hasClientField = /\bclient\s*:/i.test(briefText);
  const hasProblemsField = /\bproblems?\s*:/i.test(briefText) || /\bchallenges?\s*:/i.test(briefText);
  const hasBenefitsField = /\bbenefits?\s*:/i.test(briefText) || /\boutcomes?\s*:/i.test(briefText);
  if (hasClientField && hasProblemsField && hasBenefitsField) {
    return 'paramount-rfp';
  }

  // Detect if this is a non-Paramount context (cross-brand pitch, competitor mention, etc.)
  const nonParamountIndicators = [
    /\buniversal\b/, /\bnetflix\b/, /\bdisney\b/, /\bhbo\b/, /\bwarner\b/,
    /\bnbc\b/, /\babc\b/, /\bfox network\b/, /\btech startup\b/, /\bsaas\b/,
    /\bproduct launch\b/, /\breal estate\b/, /\bhealthcare pitch\b/,
  ];
  const hasNonParamountContext = nonParamountIndicators.some(re => re.test(text));
  if (hasNonParamountContext) {
    return 'generic';
  }

  // Detect showcase/portfolio request patterns
  const showcaseIndicators = [
    /\bshowcase\b/, /\bportfolio\b/, /\bip deck\b/, /\bcontent slate\b/,
    /\bpresentation (about|on|for) paramount\b/, /\bparamount (ip|properties|shows|content)\b/,
    /\bcomedy (portfolio|lineup|shows)\b/, /\bdrama (portfolio|lineup)\b/,
    /\breality (portfolio|lineup)\b/, /\bsports (portfolio|lineup|calendar)\b/,
    /\btentpole\b/, /\bprogramming calendar\b/, /\b2026 slate\b/,
    /\bcreate a (deck|presentation|slide)\b/, /\bbuild a (deck|presentation|slide)\b/,
    /\bgenerate a (deck|presentation|slide)\b/, /\bmake a (deck|presentation|slide)\b/,
    /\bhighlight reel\b/, /\bsizzle\b/, /\bsales deck\b(?!.*brief)/,
    /\bcross-ip\b/, /\bip alignment\b/, /\bparamount talent\b/,
  ];
  const hasShowcaseIntent = showcaseIndicators.some(re => re.test(text));
  if (hasShowcaseIntent) {
    return 'paramount-showcase';
  }

  // Fallback: treat as RFP (preserves existing behavior for ambiguous inputs)
  return 'paramount-rfp';
}

export async function generateProposalContent(
  briefText: string,
  parsedData: Partial<ProposalData>,
  brandVoice?: BrandVoiceProfile
): Promise<ExpandedContent> {
  const deckType = detectDeckType(briefText);
  const problems = parsedData.content?.problems || ['', '', '', ''];
  const benefits = parsedData.content?.benefits || ['', '', '', ''];
  const clientCompany = parsedData.client?.company || 'the company';
  const projectTitle = parsedData.project?.title || 'the project';

  const userPrompt = deckType === 'paramount-rfp'
    ? `Here is the client brief:

---
${briefText}
---

Parsed information:
- Company: ${clientCompany}
- Project: ${projectTitle}
- Problems identified:
  1. ${problems[0] || 'Not specified'}
  2. ${problems[1] || 'Not specified'}
  3. ${problems[2] || 'Not specified'}
  4. ${problems[3] || 'Not specified'}
- Benefits/outcomes desired:
  1. ${benefits[0] || 'Not specified'}
  2. ${benefits[1] || 'Not specified'}
  3. ${benefits[2] || 'Not specified'}
  4. ${benefits[3] || 'Not specified'}

Generate personalized expansions for each problem and benefit that reference specific details from this brief. Make the content feel tailored to ${clientCompany}, not generic.`
    : `Here is the presentation request:

---
${briefText}
---

Build the best possible presentation for this request. Use the full Paramount IP inventory, talent roster, and programming calendar from your training context where relevant.`;

  // Select system prompt and training context based on deck type
  const promptsByType: Record<DeckType, (string | null)[]> = {
    'paramount-rfp':      [brandVoice ? formatBrandVoiceConstraints(brandVoice) : null, PARAMOUNT_TRAINING_CONTEXT, PROOF_POINTS_DATABASE, INDUSTRY_INSIGHTS_MAP, SYSTEM_PROMPT],
    'paramount-showcase': [brandVoice ? formatBrandVoiceConstraints(brandVoice) : null, PARAMOUNT_TRAINING_CONTEXT, SHOWCASE_SYSTEM_PROMPT],
    'generic':            [GENERIC_SYSTEM_PROMPT],
  };
  const systemPrompt = promptsByType[deckType].filter(Boolean).join('\n\n');

  let parsed: LLMResponse | undefined;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetchWithRetry(GEMINI_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          { role: 'user', parts: [{ text: userPrompt }] },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 32768,
          ...NO_THINKING,
          responseMimeType: 'application/json',
        },
      }),
    }, { timeoutMs: 120_000 });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM Service] Gemini API Error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const result = await response.json();
    validateGeminiBody(result);
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      lastError = new Error('No content returned from Gemini');
      if (attempt < MAX_RETRIES) {
        console.warn(`[LLM Service] Empty proposal response, retrying (${attempt + 1}/${MAX_RETRIES})…`);
      }
      continue;
    }

    try {
      const candidate = JSON.parse(content) as LLMResponse;
      if (deckType === 'paramount-rfp') {
        // Strict validation for RFP decks — must have exactly 4 problem/benefit expansions
        if (!Array.isArray(candidate.problemExpansions) || candidate.problemExpansions.length !== 4) {
          throw new Error('Invalid problemExpansions in LLM response');
        }
        if (!Array.isArray(candidate.benefitExpansions) || candidate.benefitExpansions.length !== 4) {
          throw new Error('Invalid benefitExpansions in LLM response');
        }
      } else {
        // Non-RFP decks: validate the type-specific output field exists
        if (deckType === 'paramount-showcase' && !candidate.showcaseContent) {
          throw new Error('Missing showcaseContent in showcase LLM response');
        }
        if (deckType === 'generic' && !Array.isArray(candidate.flexibleSlides)) {
          throw new Error('Missing flexibleSlides in generic LLM response');
        }
      }
      parsed = candidate;
      break;
    } catch (parseErr) {
      lastError = parseErr instanceof Error ? parseErr : new Error(String(parseErr));
      if (attempt < MAX_RETRIES) {
        console.warn(`[LLM Service] Invalid response (${lastError.message}), retrying (${attempt + 1}/${MAX_RETRIES})…`);
      } else {
        console.error('[LLM Service] All retries exhausted. Last content:', content);
      }
    }
  }

  if (!parsed) {
    throw lastError ?? new Error('No valid content returned from Gemini after retries');
  }

  const EMPTY_FOUR = ['', '', '', ''] as [string, string, string, string];
  const approachSteps: string[] = Array.isArray(parsed.approachSteps) ? parsed.approachSteps : [];
  const nextSteps: string[] = Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [];

  // Parse and validate paramountMedia (Dunkin-style deck content — RFP path only)
  let paramountMedia: ParamountMediaContent | undefined;
  if (deckType === 'paramount-rfp' && parsed.paramountMedia && typeof parsed.paramountMedia === 'object') {
    const pm = parsed.paramountMedia as unknown as Record<string, unknown>;
    paramountMedia = {
      opportunityStatement: (pm.opportunityStatement as string) || '',
      paramountIPAlignments: Array.isArray(pm.paramountIPAlignments)
        ? (pm.paramountIPAlignments as IPAlignment[])
        : [],
      audienceInsights: Array.isArray(pm.audienceInsights)
        ? (pm.audienceInsights as string[])
        : [],
      integrationConcepts: Array.isArray(pm.integrationConcepts)
        ? (pm.integrationConcepts as IntegrationConcept[])
        : [],
      talentOpportunities: Array.isArray(pm.talentOpportunities)
        ? (pm.talentOpportunities as string[])
        : [],
      programmingCalendar: Array.isArray(pm.programmingCalendar)
        ? (pm.programmingCalendar as CalendarItem[])
        : [],
      measurementFramework: Array.isArray(pm.measurementFramework)
        ? (pm.measurementFramework as string[])
        : [],
      investmentTiers: Array.isArray(pm.investmentTiers)
        ? (pm.investmentTiers as InvestmentTier[])
        : [],
      nextSteps: Array.isArray(pm.nextSteps) ? (pm.nextSteps as string[]) : [],
      appendixItems: Array.isArray(pm.appendixItems) ? (pm.appendixItems as string[]) : [],
      proofPoints: Array.isArray(pm.proofPoints) ? (pm.proofPoints as ProofPoint[]) : undefined,
      industryInsights: Array.isArray(pm.industryInsights) ? (pm.industryInsights as IndustryInsight[]) : undefined,
    };
  }

  // Parse showcaseContent (paramount-showcase path)
  let showcaseContent: ShowcaseContent | undefined;
  if (deckType === 'paramount-showcase' && parsed.showcaseContent && typeof parsed.showcaseContent === 'object') {
    const sc = parsed.showcaseContent as unknown as Record<string, unknown>;
    showcaseContent = {
      showcaseTitle: (sc.showcaseTitle as string) || '',
      executiveSummary: (sc.executiveSummary as string) || '',
      slides: Array.isArray(sc.slides) ? (sc.slides as FlexibleSlide[]) : [],
      audienceInsights: Array.isArray(sc.audienceInsights) ? (sc.audienceInsights as string[]) : [],
      measurementFramework: Array.isArray(sc.measurementFramework) ? (sc.measurementFramework as string[]) : [],
    };
  }

  // Parse flexibleSlides (generic path)
  const flexibleSlides: FlexibleSlide[] | undefined =
    deckType === 'generic' && Array.isArray(parsed.flexibleSlides)
      ? (parsed.flexibleSlides as FlexibleSlide[])
      : undefined;

  // Parse persuasion-engine fields (paramount-rfp path)
  const culturalShift: string[] | undefined = Array.isArray(parsed.culturalShift) ? parsed.culturalShift : undefined;
  const realProblem: string[] | undefined = Array.isArray(parsed.realProblem) ? parsed.realProblem : undefined;
  const costOfInaction: string[] | undefined = Array.isArray(parsed.costOfInaction) ? parsed.costOfInaction : undefined;
  const coreInsight: string | undefined = typeof parsed.coreInsight === 'string' ? parsed.coreInsight : undefined;
  const proofPoints: ProofPoint[] | undefined = Array.isArray(parsed.proofPoints) ? (parsed.proofPoints as ProofPoint[]) : undefined;
  const customPlan: CustomClientPlan | undefined = parsed.customPlan && typeof parsed.customPlan === 'object'
    ? parsed.customPlan as CustomClientPlan
    : undefined;
  const industryInsights: IndustryInsight[] | undefined = Array.isArray(parsed.industryInsights) ? (parsed.industryInsights as IndustryInsight[]) : undefined;

  return {
    problemExpansions: Array.isArray(parsed.problemExpansions) && parsed.problemExpansions.length === 4
      ? parsed.problemExpansions as [string, string, string, string]
      : EMPTY_FOUR,
    benefitExpansions: Array.isArray(parsed.benefitExpansions) && parsed.benefitExpansions.length === 4
      ? parsed.benefitExpansions as [string, string, string, string]
      : EMPTY_FOUR,
    approachSteps,
    nextSteps,
    deckType,
    paramountMedia,
    showcaseContent,
    flexibleSlides,
    culturalShift,
    realProblem,
    costOfInaction,
    coreInsight,
    proofPoints,
    customPlan,
    industryInsights,
  };
}

const ITERATE_SYSTEM_PROMPT = `You are a Paramount Advertising Solutions proposal editor. The user will request changes to slide content — either specific slides or general improvements across the whole deck.

SLIDE MAP — paramount-rfp deck (use this to understand which field a slide number refers to):
Slide 2  — "The New Reality of Attention"              → field: culturalShift      (exactly 3 bullet strings)
Slide 3  — "Why Most Brand Campaigns Fail Today"       → field: realProblem        (exactly 3 bullet strings)
Slide 4  — "What This Is Costing You"                  → field: costOfInaction     (exactly 3 bullet strings)
Slide 5  — "The Reframe / Money Slide"                 → field: coreInsight        (1 powerful sentence string)
Slide 7  — "Proven Impact at Scale"                    → field: proofPoints        (3-5 items: {stat, source, context})
Slide 8  — "From Idea to Cultural Moment"              → field: approachSteps      (exactly 3 strings)
Slide 9  — "Your Opportunity with Paramount"           → field: customPlan         ({recommendedProperties[], formats[], audienceMatch, timeline})
Slide 11 — "Next Steps"                                → field: nextSteps          (exactly 4 strings)

Return ONLY valid JSON with this structure:
{
  "reply": "Brief 1-2 sentence confirmation of what changed",
  "updatedContent": {
    "culturalShift": ["item1", "item2", "item3"] | null,
    "realProblem": ["item1", "item2", "item3"] | null,
    "costOfInaction": ["item1", "item2", "item3"] | null,
    "coreInsight": "One powerful sentence" | null,
    "proofPoints": [{"stat": "...", "source": "...", "context": "..."}] | null,
    "approachSteps": ["step1", "step2", "step3"] | null,
    "customPlan": {"recommendedProperties": [], "formats": [], "audienceMatch": "", "timeline": ""} | null,
    "nextSteps": ["action1", "action2", "action3", "action4"] | null,
    "problemExpansions": ["p1", "p2", "p3", "p4"] | null,
    "benefitExpansions": ["b1", "b2", "b3", "b4"] | null
  } | null,
  "updatedShowcaseContent": {
    "showcaseTitle": "string" | null,
    "executiveSummary": "string" | null,
    "slides": [{"slideKey": "string", "title": "string", "subtitle": "string" | null, "bullets": ["..."]}] | null,
    "audienceInsights": ["..."] | null,
    "measurementFramework": ["..."] | null
  } | null,
  "updatedFlexibleSlides": [{"slideKey": "string", "title": "string", "subtitle": "string" | null, "bullets": ["..."]}] | null,
  "additionalSlides": [{"title": "Slide Title", "bullets": ["point 1", "point 2", "point 3"]}] | null
}

DECK-SPECIFIC RULES — choose ONE update field based on the active deck type stated in the context:
- paramount-rfp  → put edits in "updatedContent". Leave "updatedShowcaseContent" and "updatedFlexibleSlides" as null.
- paramount-showcase → put edits in "updatedShowcaseContent". Leave "updatedContent" and "updatedFlexibleSlides" as null.
  • slides field: return the COMPLETE new slides array (every slide in order). Preserve the existing "slideKey" for each unchanged slide; only change title/subtitle/bullets the user asked about.
  • If the user did not change a showcase header field (showcaseTitle, executiveSummary, audienceInsights, measurementFramework), set it to null.
- generic → put edits in "updatedFlexibleSlides". Leave "updatedContent" and "updatedShowcaseContent" as null.
  • Return the COMPLETE new slides array; preserve existing "slideKey" values.

RULES:
- For each field in updatedContent: provide the updated value if you changed it, or null to leave it unchanged
- GENERAL requests ("more concise", "stronger tone", "add urgency", "more persuasive", "tighten the copy"):
  → For paramount-rfp: update ALL text-bearing fields (culturalShift, realProblem, costOfInaction, coreInsight, approachSteps, nextSteps, proofPoints context). Apply the tonal change consistently across every field — not just one or two slides.
  → For paramount-showcase / generic: rewrite the bullets (and subtitles where applicable) on every slide in the slides array.
- SLIDE-SPECIFIC requests ("change slide 3", "rewrite the reframe slide", "make the cost slide stronger"):
  → paramount-rfp: update only the field(s) for that slide; set all others to null.
  → paramount-showcase / generic: return the FULL slides array, but only modify the one slide the user referenced. The slide numbers in the context match what the user sees in the preview.
- ADDING SLIDES ("add a slide about X", "make it longer", "add a Big Brother slide"):
  → Generate 1-3 new slides in additionalSlides with a title and 2-4 bullets each
  → ALWAYS generate requested slides — never refuse; use Paramount training context for specific properties
  → Set updatedContent / updatedShowcaseContent / updatedFlexibleSlides to null unless the user also asked to change existing content
- DESIGN CHANGE requests (colors, layout, visuals):
  → Set updatedContent, updatedShowcaseContent, updatedFlexibleSlides and additionalSlides to null; explain in reply that visual changes are in the Design tab

Item count rules (preserve these exactly):
- culturalShift, realProblem, costOfInaction, approachSteps → exactly 3 items each
- nextSteps → exactly 4 items
- proofPoints → 3-5 items (keep stats accurate, only refine context descriptions)
- problemExpansions, benefitExpansions → exactly 4 items each (only update if user references "the brief content" or "the proposal body")
- showcase / flexible slide bullets → keep within 2-6 items unless the user explicitly asks for a specific count

IMPORTANT: Return ONLY the JSON object, no markdown or code blocks.`;

// Merge an LLM-returned slides array into the existing slides, matched by slideKey.
// If the LLM returns the full array (same length, all keys match), it replaces in order.
// Otherwise we update slides whose slideKey matches and append any new slideKeys at the end.
function mergeFlexibleSlidesByKey(current: FlexibleSlide[], updates: FlexibleSlide[]): FlexibleSlide[] {
  const validUpdates = updates.filter(
    s => s && typeof s.slideKey === 'string' && typeof s.title === 'string' && Array.isArray(s.bullets)
  );
  if (validUpdates.length === 0) return current;

  const updateMap = new Map<string, FlexibleSlide>();
  validUpdates.forEach(s => updateMap.set(s.slideKey, s));

  const out: FlexibleSlide[] = current.map(cur => updateMap.get(cur.slideKey) ?? cur);
  const currentKeys = new Set(current.map(s => s.slideKey));
  validUpdates.forEach(u => {
    if (!currentKeys.has(u.slideKey)) out.push(u);
  });
  return out;
}

export async function iterateProposalContent(
  briefText: string,
  parsedData: Partial<ProposalData>,
  currentExpansions: ExpandedContent | null,
  userInstruction: string,
  history: ChatMessage[],
  brandVoice?: BrandVoiceProfile
): Promise<{ reply: string; updatedExpansions?: ExpandedContent }> {
  const problems = parsedData.content?.problems || ['', '', '', ''];
  const benefits = parsedData.content?.benefits || ['', '', '', ''];
  const clientCompany = parsedData.client?.company || 'the company';

  const activeDeckType = currentExpansions?.deckType ?? 'paramount-rfp';

  // Build context section based on deck type
  let deckContext = '';
  if (activeDeckType === 'paramount-rfp' && currentExpansions) {
    const ce = currentExpansions;
    deckContext = `CURRENT SLIDE CONTENT (what is shown in the deck right now):

Slide 2 — culturalShift:
${ce.culturalShift?.map((s, i) => `${i + 1}. ${s}`).join('\n') || '(none)'}

Slide 3 — realProblem:
${ce.realProblem?.map((s, i) => `${i + 1}. ${s}`).join('\n') || '(none)'}

Slide 4 — costOfInaction:
${ce.costOfInaction?.map((s, i) => `${i + 1}. ${s}`).join('\n') || '(none)'}

Slide 5 — coreInsight:
${ce.coreInsight || '(none)'}

Slide 7 — proofPoints:
${ce.proofPoints?.map((p, i) => `${i + 1}. ${p.stat} — ${p.source}${p.context ? ` (${p.context})` : ''}`).join('\n') || '(none)'}

Slide 8 — approachSteps:
${ce.approachSteps?.map((s, i) => `${i + 1}. ${s}`).join('\n') || '(none)'}

Slide 9 — customPlan:
${ce.customPlan ? `Properties: ${ce.customPlan.recommendedProperties?.join(', ') || '—'}
Formats: ${ce.customPlan.formats?.join(', ') || '—'}
Audience: ${ce.customPlan.audienceMatch || '—'}
Timeline: ${ce.customPlan.timeline || '—'}` : '(none)'}

Slide 11 — nextSteps:
${ce.nextSteps?.map((s, i) => `${i + 1}. ${s}`).join('\n') || '(none)'}

Proposal body (problemExpansions / benefitExpansions — used in content review, not shown as slides in this deck):
Problems:
${ce.problemExpansions.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Benefits:
${ce.benefitExpansions.map((b, i) => `${i + 1}. ${b}`).join('\n')}`;
  } else if (activeDeckType === 'paramount-showcase' && currentExpansions?.showcaseContent) {
    const sc = currentExpansions.showcaseContent;
    // Preview slide 1 is always the cover (showcaseTitle / executiveSummary),
    // content slides start at preview slide 2. Surface slideKey so the model can
    // return it unchanged for every slide it preserves.
    deckContext = `This is a paramount-showcase deck. Put your edits in "updatedShowcaseContent" — do NOT use "updatedContent" or problemExpansions/benefitExpansions for this deck type.

Slide 1 (cover) — showcaseTitle: ${sc.showcaseTitle}
Executive summary: ${sc.executiveSummary}

Content slides (numbered as they appear in the preview; slide 1 is the cover above):
${sc.slides.map((s, i) => `Slide ${i + 2} [slideKey: "${s.slideKey}"] — ${s.title}${s.subtitle ? `\n   subtitle: ${s.subtitle}` : ''}\n${s.bullets.map(b => `   - ${b}`).join('\n')}`).join('\n\n')}

When returning "updatedShowcaseContent.slides", include every slide above in order with its existing slideKey. Modify only the slide(s) the user asked about; copy the rest through unchanged.`;
  } else if (activeDeckType === 'generic' && currentExpansions?.flexibleSlides) {
    const flex = currentExpansions.flexibleSlides;
    deckContext = `This is a generic flexible deck. Put your edits in "updatedFlexibleSlides" — do NOT use "updatedContent" or problemExpansions/benefitExpansions for this deck type.

Content slides (numbered as they appear in the preview; slide 1 is the cover):
${flex.map((s, i) => `Slide ${i + 2} [slideKey: "${s.slideKey}"] — ${s.title}${s.subtitle ? `\n   subtitle: ${s.subtitle}` : ''}\n${s.bullets.map(b => `   - ${b}`).join('\n')}`).join('\n\n')}

When returning "updatedFlexibleSlides", include every slide above in order with its existing slideKey. Modify only the slide(s) the user asked about; copy the rest through unchanged.`;
  }

  const contextPrompt = `Current proposal context:
- Company: ${clientCompany}
- Brief: ${briefText.slice(0, 1000)}${briefText.length > 1000 ? '...' : ''}

Current problem summaries:
${problems.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Current benefit summaries:
${benefits.map((b, i) => `${i + 1}. ${b}`).join('\n')}

${deckContext}

User request: ${userInstruction}`;

  const recentHistory = history.slice(-10);
  const contents = [
    ...recentHistory.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    })),
    { role: 'user', parts: [{ text: contextPrompt }] },
  ];

  // Always inject Paramount training context for non-generic decks
  const iterateSystemPrompt = [
    brandVoice ? formatBrandVoiceConstraints(brandVoice) : null,
    activeDeckType !== 'generic' ? PARAMOUNT_TRAINING_CONTEXT : null,
    ITERATE_SYSTEM_PROMPT,
  ].filter(Boolean).join('\n\n');

  let content: string | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetchWithRetry(GEMINI_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: iterateSystemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
          ...NO_THINKING,
          responseMimeType: 'application/json',
        },
      }),
    }, { timeoutMs: 60_000 });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM Service] Iterate error:', errorText);
      throw new Error(`Gemini iterate error: ${response.status}`);
    }

    const result = await response.json();
    validateGeminiBody(result);
    content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (content) break;

    if (attempt < MAX_RETRIES) {
      console.warn(`[LLM Service] Empty iterate response, retrying (${attempt + 1}/${MAX_RETRIES})…`);
    }
  }

  if (!content) {
    throw new Error('No content returned from Gemini iterate after retries');
  }

  let parsed: {
    reply: string;
    updatedContent?: {
      culturalShift?: string[] | null;
      realProblem?: string[] | null;
      costOfInaction?: string[] | null;
      coreInsight?: string | null;
      proofPoints?: ProofPoint[] | null;
      approachSteps?: string[] | null;
      customPlan?: CustomClientPlan | null;
      nextSteps?: string[] | null;
      problemExpansions?: string[] | null;
      benefitExpansions?: string[] | null;
    } | null;
    // Legacy field name — accepted for backward compat with old mocks/tests
    updatedExpansions?: {
      culturalShift?: string[] | null;
      realProblem?: string[] | null;
      costOfInaction?: string[] | null;
      coreInsight?: string | null;
      proofPoints?: ProofPoint[] | null;
      approachSteps?: string[] | null;
      customPlan?: CustomClientPlan | null;
      nextSteps?: string[] | null;
      problemExpansions?: string[] | null;
      benefitExpansions?: string[] | null;
    } | null;
    updatedShowcaseContent?: {
      showcaseTitle?: string | null;
      executiveSummary?: string | null;
      slides?: FlexibleSlide[] | null;
      audienceInsights?: string[] | null;
      measurementFramework?: string[] | null;
    } | null;
    updatedFlexibleSlides?: FlexibleSlide[] | null;
    additionalSlides: AdditionalSlide[] | null;
  };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Failed to parse iterate response as JSON');
  }

  const output: { reply: string; updatedExpansions?: ExpandedContent } = { reply: parsed.reply };

  // Support both new `updatedContent` and legacy `updatedExpansions` field names
  const uc = parsed.updatedContent ?? parsed.updatedExpansions ?? null;

  if (uc) {
    const cur = currentExpansions;
    // Merge problem/benefit expansions (fall back to current if null/empty)
    const problems = Array.isArray(uc.problemExpansions) && uc.problemExpansions.length > 0
      ? uc.problemExpansions
      : cur?.problemExpansions ?? [];
    const benefits = Array.isArray(uc.benefitExpansions) && uc.benefitExpansions.length > 0
      ? uc.benefitExpansions
      : cur?.benefitExpansions ?? [];
    while (problems.length < 4) problems.push('Additional challenge to be identified.');
    while (benefits.length < 4) benefits.push('Additional benefit to be identified.');

    output.updatedExpansions = {
      ...cur,
      problemExpansions: problems as [string, string, string, string],
      benefitExpansions: benefits as [string, string, string, string],
      // Persuasion-engine fields — use LLM value if provided, otherwise keep current
      culturalShift: Array.isArray(uc.culturalShift) && uc.culturalShift.length > 0
        ? uc.culturalShift : cur?.culturalShift,
      realProblem: Array.isArray(uc.realProblem) && uc.realProblem.length > 0
        ? uc.realProblem : cur?.realProblem,
      costOfInaction: Array.isArray(uc.costOfInaction) && uc.costOfInaction.length > 0
        ? uc.costOfInaction : cur?.costOfInaction,
      coreInsight: typeof uc.coreInsight === 'string' && uc.coreInsight
        ? uc.coreInsight : cur?.coreInsight,
      proofPoints: Array.isArray(uc.proofPoints) && uc.proofPoints.length > 0
        ? uc.proofPoints : cur?.proofPoints,
      approachSteps: Array.isArray(uc.approachSteps) && uc.approachSteps.length > 0
        ? uc.approachSteps : cur?.approachSteps,
      customPlan: uc.customPlan && typeof uc.customPlan === 'object'
        ? uc.customPlan : cur?.customPlan,
      nextSteps: Array.isArray(uc.nextSteps) && uc.nextSteps.length > 0
        ? uc.nextSteps : cur?.nextSteps,
    };
  }

  // Merge showcase content updates (paramount-showcase deck)
  const usc = parsed.updatedShowcaseContent;
  if (usc && currentExpansions?.showcaseContent) {
    const curSc = currentExpansions.showcaseContent;
    const mergedShowcase: ShowcaseContent = {
      showcaseTitle: typeof usc.showcaseTitle === 'string' && usc.showcaseTitle
        ? usc.showcaseTitle : curSc.showcaseTitle,
      executiveSummary: typeof usc.executiveSummary === 'string' && usc.executiveSummary
        ? usc.executiveSummary : curSc.executiveSummary,
      slides: Array.isArray(usc.slides) && usc.slides.length > 0
        ? mergeFlexibleSlidesByKey(curSc.slides, usc.slides)
        : curSc.slides,
      audienceInsights: Array.isArray(usc.audienceInsights) && usc.audienceInsights.length > 0
        ? usc.audienceInsights : curSc.audienceInsights,
      measurementFramework: Array.isArray(usc.measurementFramework) && usc.measurementFramework.length > 0
        ? usc.measurementFramework : curSc.measurementFramework,
    };
    output.updatedExpansions = {
      ...(output.updatedExpansions ?? currentExpansions),
      showcaseContent: mergedShowcase,
    };
  }

  // Merge flexible slide updates (generic deck)
  if (Array.isArray(parsed.updatedFlexibleSlides) && parsed.updatedFlexibleSlides.length > 0 && currentExpansions?.flexibleSlides) {
    const mergedFlex = mergeFlexibleSlidesByKey(currentExpansions.flexibleSlides, parsed.updatedFlexibleSlides);
    output.updatedExpansions = {
      ...(output.updatedExpansions ?? currentExpansions),
      flexibleSlides: mergedFlex,
    };
  }

  // Merge additional slides into updatedExpansions (or create a shell if only additional slides were returned)
  if (Array.isArray(parsed.additionalSlides) && parsed.additionalSlides.length > 0) {
    if (!output.updatedExpansions && currentExpansions) {
      // Keep all existing expansions (including flexible deck fields), just add the new slides
      output.updatedExpansions = {
        ...currentExpansions,
        additionalSlides: [
          ...(currentExpansions.additionalSlides ?? []),
          ...parsed.additionalSlides,
        ],
      };
    } else if (output.updatedExpansions) {
      output.updatedExpansions = {
        ...output.updatedExpansions,
        additionalSlides: [
          ...(currentExpansions?.additionalSlides ?? []),
          ...parsed.additionalSlides,
        ],
      };
    }
  }

  return output;
}

const DESIGN_ITERATE_SYSTEM_PROMPT = `You are a design consultant refining a sales presentation's visual style.

The user will request visual or aesthetic changes. Map their request to a colorTheme and optionally a designStyle.

COLOR THEMES — choose the most fitting:
- "navy-gold": Professional, authoritative, premium. Dark navy with gold/orange accents. Enterprise, financial services, luxury.
- "slate-blue": Modern, technological, trustworthy. Slate with blue accents. SaaS, tech, healthcare.
- "forest-green": Purposeful, growth-oriented. Dark green with green accents. Sustainability, wellness, impact.
- "executive-dark": Premium, understated, high-stakes. Near-black with warm platinum accents. Board-level, financial, or any context requiring a refined consulting aesthetic.

DESIGN STYLES — choose based on the visual feel the user wants:
- "standard": Classic layout — white content slides, thick accent bars. Safe default.
- "bold-agency": High-drama layouts — dark problem slides with watermark numbers, split accent/dark panel on the solution slide, corner circles on the closing slide. Best for creative or marketing pitches.
- "executive-minimal": Premium consulting feel — all slides dark, hairline rules instead of thick bars, clean and architectural. Best for board presentations or financial services.

Return ONLY valid JSON with this structure:
{
  "reply": "Brief conversational response describing the change (1-2 sentences)",
  "designConfig": {
    "colorTheme": "navy-gold" | "slate-blue" | "forest-green" | "executive-dark",
    "designStyle": "standard" | "bold-agency" | "executive-minimal",
    "customBrandHex": "#RRGGBB" | null
  }
}

CUSTOM COLOR: If the user provides a specific hex color code (e.g. "#FF6600", "#0066CC") or mentions a precise brand color, set "customBrandHex" to that hex value (with # prefix, 6 digits). Otherwise set "customBrandHex" to null.

If the user's request does not relate to visual design, set "designConfig" to null and explain in "reply".
Only include "designStyle" when the user implies a layout change (e.g. "more dramatic", "executive style", "agency feel"). For pure color requests, omit designStyle from the response.

IMPORTANT: Return ONLY the JSON object, no markdown or code blocks.`;

export async function iterateDesign(
  currentDesignConfig: DesignConfig,
  userInstruction: string,
  history: ChatMessage[]
): Promise<{ reply: string; designConfig?: DesignConfig }> {
  const contextPrompt = `Current design theme: ${currentDesignConfig.colorTheme}

User request: ${userInstruction}`;

  const recentHistory = history.slice(-10);
  const contents = [
    ...recentHistory.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    })),
    { role: 'user', parts: [{ text: contextPrompt }] },
  ];

  let content: string | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetchWithRetry(GEMINI_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: DESIGN_ITERATE_SYSTEM_PROMPT }] },
        contents,
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 1024,
          ...NO_THINKING,
          responseMimeType: 'application/json',
        },
      }),
    }, { timeoutMs: 30_000 });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM Service] Design iterate error:', errorText);
      throw new Error(`Gemini design iterate error: ${response.status}`);
    }

    const result = await response.json();
    validateGeminiBody(result);
    content = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (content) break;

    if (attempt < MAX_RETRIES) {
      console.warn(`[LLM Service] Empty design iterate response, retrying (${attempt + 1}/${MAX_RETRIES})…`);
    }
  }

  if (!content) {
    throw new Error('No content returned from Gemini design iterate after retries');
  }

  let parsed: { reply: string; designConfig: DesignConfig | null };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Failed to parse design iterate response as JSON');
  }

  if (parsed.designConfig) {
    return { reply: parsed.reply, designConfig: parsed.designConfig };
  }

  return { reply: parsed.reply };
}
