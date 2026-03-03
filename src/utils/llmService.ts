import type { ProposalData, ExpandedContent, DesignConfig, AdditionalSlide } from '../types/proposal';
import { PARAMOUNT_TRAINING_CONTEXT } from './trainingContext';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const FILES_API_UPLOAD = `https://generativelanguage.googleapis.com/upload/v1beta/files`;
const FILES_API_BASE = `https://generativelanguage.googleapis.com/v1beta`;

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

// Upload a file to Gemini Files API; returns the file URI for use in inference requests.
// Used for PDFs > LARGE_PDF_THRESHOLD to avoid large base64-encoded request bodies.
async function uploadToFilesApi(file: File, apiKey: string): Promise<string> {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ file: { display_name: file.name } });
  const fileBuffer = await file.arrayBuffer();

  const encoder = new TextEncoder();
  const metadataPart = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n`
  );
  const filePart = encoder.encode(`--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`);
  const closingPart = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(
    metadataPart.byteLength + filePart.byteLength + fileBuffer.byteLength + closingPart.byteLength
  );
  let offset = 0;
  body.set(metadataPart, offset); offset += metadataPart.byteLength;
  body.set(filePart, offset); offset += filePart.byteLength;
  body.set(new Uint8Array(fileBuffer), offset); offset += fileBuffer.byteLength;
  body.set(closingPart, offset);

  const response = await fetch(`${FILES_API_UPLOAD}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Files API upload failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  const fileUri: string | undefined = result.file?.uri;
  if (!fileUri) throw new Error('Files API did not return a file URI');
  return fileUri;
}

// Fire-and-forget cleanup; files auto-delete after 48h anyway
function deleteFilesApiFile(fileUri: string, apiKey: string): void {
  const match = fileUri.match(/\/files\/([^/?]+)/);
  if (!match) return;
  fetch(`${FILES_API_BASE}/files/${match[1]}?key=${apiKey}`, { method: 'DELETE' }).catch(() => {});
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
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY environment variable is not set');
  }

  if (file.size > MAX_PDF_SIZE) {
    throw new Error('PDF too large. Maximum file size is 50MB.');
  }

  // Choose upload strategy based on file size
  let pdfPart: object;
  let uploadedFileUri: string | null = null;

  if (file.size > LARGE_PDF_THRESHOLD) {
    console.log(`[LLM Service] Large PDF (${(file.size / 1024 / 1024).toFixed(1)}MB) — uploading via Files API`);
    uploadedFileUri = await uploadToFilesApi(file, GEMINI_API_KEY);
    pdfPart = { file_data: { mime_type: 'application/pdf', file_uri: uploadedFileUri } };
  } else {
    const base64Data = await fileToBase64(file);
    pdfPart = { inline_data: { mime_type: 'application/pdf', data: base64Data } };
  }

  const makeRequest = (withResponseMimeType: boolean) =>
    fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [pdfPart, { text: PDF_EXTRACTION_PROMPT }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
          ...(withResponseMimeType ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    });

  try {
    // First attempt — responseMimeType nudges Gemini toward clean JSON output
    let response = await makeRequest(true);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM Service] PDF analysis error:', errorText);
      throw new Error(`Gemini PDF analysis failed: ${response.status}`);
    }

    let result = await response.json();
    let contentText: string = result.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!contentText) {
      throw new Error('No content returned from Gemini PDF analysis');
    }

    let extracted: Record<string, unknown> | null = null;
    try {
      extracted = JSON.parse(contentText);
    } catch {
      // JSON truncated or wrapped in fences — retry without responseMimeType
      console.warn('[LLM Service] PDF JSON parse failed, retrying without responseMimeType...');
      response = await makeRequest(false);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini PDF analysis retry failed: ${response.status} - ${errorText}`);
      }
      result = await response.json();
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
    if (uploadedFileUri) deleteFilesApiFile(uploadedFileUri, GEMINI_API_KEY);
  }
}

const BRAND_VOICE_PROMPT = `You are analyzing proposal documents to extract a brand voice profile.

Examine all content and produce a concise brand voice guide (200-400 words) that a copywriter could follow to match this style exactly.

Cover:
1. Tone: Is it formal, conversational, authoritative, direct, inspirational? Any notable tonal qualities?
2. Sentence patterns: Long/complex or short/punchy? Active or passive voice? Use of questions or imperatives?
3. Vocabulary: Preferred terms, industry language, power words, phrases they favour, words they avoid
4. Problem framing: How do they describe client challenges — empathetic, urgent, analytical, business-focused?
5. Value articulation: How do they express ROI and outcomes — specific numbers, qualitative benefits, risk avoidance?
6. Recurring signatures: Distinctive expressions, constructions, or stylistic habits that appear repeatedly

Return the guide as plain prose paragraphs — no headings, no JSON, no bullet lists. Write it so a writer can absorb and immediately apply the style.`;

export async function extractBrandVoice(files: File[]): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY environment variable is not set');
  }

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
      const uris = await Promise.all(files.map(f => uploadToFilesApi(f, GEMINI_API_KEY!)));
      uploadedUris.push(...uris);
      fileParts = uris.map(uri => ({ file_data: { mime_type: 'application/pdf', file_uri: uri } }));
    } else {
      const base64Files = await Promise.all(files.map(fileToBase64));
      fileParts = base64Files.map((data, i) => ({
        inline_data: { mime_type: files[i].type || 'application/pdf', data },
      }));
    }

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [...fileParts, { text: BRAND_VOICE_PROMPT }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[LLM Service] Brand voice extraction error:', errorText);
      throw new Error(`Gemini brand voice extraction failed: ${response.status}`);
    }

    const result = await response.json();
    const content: string | undefined = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('No content returned from brand voice extraction');
    }

    return content.trim();
  } finally {
    uploadedUris.forEach(uri => deleteFilesApiFile(uri, GEMINI_API_KEY!));
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface LLMResponse {
  problemExpansions: [string, string, string, string];
  benefitExpansions: [string, string, string, string];
}

const SYSTEM_PROMPT = `You are a proposal writer for a consulting/agency. Generate persuasive, revenue-focused content based on the client brief provided.

You MUST output valid JSON with this exact structure:
{
  "problemExpansions": ["paragraph1", "paragraph2", "paragraph3", "paragraph4"],
  "benefitExpansions": ["paragraph1", "paragraph2", "paragraph3", "paragraph4"]
}

Guidelines:
- Each expansion should be 2-3 sentences
- Reference specific details from the brief - don't be generic
- Use direct "you" language (not "the client" or "they")
- Focus on business impact and revenue implications
- Be persuasive but professional
- Each problem expansion should explain why this issue costs them money or limits growth
- Each benefit expansion should explain the ROI and concrete outcomes they'll see

IMPORTANT: Return ONLY the JSON object, no markdown formatting or code blocks.`;

export async function generateProposalContent(
  briefText: string,
  parsedData: Partial<ProposalData>,
  brandVoice?: string
): Promise<ExpandedContent> {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY environment variable is not set');
  }

  const problems = parsedData.content?.problems || ['', '', '', ''];
  const benefits = parsedData.content?.benefits || ['', '', '', ''];
  const clientCompany = parsedData.client?.company || 'the company';
  const projectTitle = parsedData.project?.title || 'the project';

  const userPrompt = `Here is the client brief:

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

Generate personalized expansions for each problem and benefit that reference specific details from this brief. Make the content feel tailored to ${clientCompany}, not generic.`;

  const systemPrompt = [
    brandVoice ? `BRAND VOICE GUIDE — follow this writing style exactly in all copy you produce:\n${brandVoice}` : null,
    PARAMOUNT_TRAINING_CONTEXT,
    SYSTEM_PROMPT,
  ].filter(Boolean).join('\n\n');

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
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
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[LLM Service] Gemini API Error:', errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const result = await response.json();
  const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('No content returned from Gemini');
  }

  let parsed: LLMResponse;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error('[LLM Service] Failed to parse response:', content);
    throw new Error('Failed to parse LLM response as JSON');
  }

  if (!Array.isArray(parsed.problemExpansions) || parsed.problemExpansions.length !== 4) {
    throw new Error('Invalid problemExpansions in LLM response');
  }
  if (!Array.isArray(parsed.benefitExpansions) || parsed.benefitExpansions.length !== 4) {
    throw new Error('Invalid benefitExpansions in LLM response');
  }

  return {
    problemExpansions: parsed.problemExpansions as [string, string, string, string],
    benefitExpansions: parsed.benefitExpansions as [string, string, string, string],
  };
}

const ITERATE_SYSTEM_PROMPT = `You are refining a sales proposal. The user will request changes to the content (tone, length, focus, etc.).

You will be given the CURRENT expanded content (4 problem paragraphs and 4 benefit paragraphs). Your job is to refine ALL 4 of each based on the user's request and return them.

Return ONLY valid JSON with this structure:
{
  "reply": "A brief conversational response acknowledging the change (1-2 sentences)",
  "updatedExpansions": {
    "problemExpansions": ["paragraph1", "paragraph2", "paragraph3", "paragraph4"],
    "benefitExpansions": ["paragraph1", "paragraph2", "paragraph3", "paragraph4"]
  } | null,
  "additionalSlides": [{"title": "Slide Title", "bullets": ["point 1", "point 2", "point 3"]}] | null
}

CRITICAL: You MUST always return exactly 4 items in each array when returning updatedExpansions.

If the user asks to add more slides, expand the deck, or make it longer:
- Generate 1-3 new slides in "additionalSlides" with a clear title and 2-4 bullet points each
- These will be appended to the end of the deck
- Set "updatedExpansions" to null unless the user also asked to change the existing content
- In "reply" confirm the new slides that were added

If the user asks for a design change (colors, layout, visuals), set both "updatedExpansions" and "additionalSlides" to null and explain in "reply" that visual design isn't supported in the editor.

Guidelines for content changes:
- Preserve all specific facts, numbers, and company details from the original
- Apply only the requested stylistic or tonal changes
- Keep each expansion to 2-3 sentences unless asked otherwise
- Use direct "you" language

IMPORTANT: Return ONLY the JSON object, no markdown or code blocks.`;

export async function iterateProposalContent(
  briefText: string,
  parsedData: Partial<ProposalData>,
  currentExpansions: ExpandedContent | null,
  userInstruction: string,
  history: ChatMessage[],
  brandVoice?: string
): Promise<{ reply: string; updatedExpansions?: ExpandedContent }> {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY environment variable is not set');
  }

  const problems = parsedData.content?.problems || ['', '', '', ''];
  const benefits = parsedData.content?.benefits || ['', '', '', ''];
  const clientCompany = parsedData.client?.company || 'the company';

  const contextPrompt = `Current proposal context:
- Company: ${clientCompany}
- Brief: ${briefText.slice(0, 1000)}${briefText.length > 1000 ? '...' : ''}

Current problem summaries:
${problems.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Current benefit summaries:
${benefits.map((b, i) => `${i + 1}. ${b}`).join('\n')}

${currentExpansions ? `Current expanded content:
Problems:
${currentExpansions.problemExpansions.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Benefits:
${currentExpansions.benefitExpansions.map((b, i) => `${i + 1}. ${b}`).join('\n')}` : ''}

User request: ${userInstruction}`;

  const recentHistory = history.slice(-10);
  const contents = [
    ...recentHistory.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    })),
    { role: 'user', parts: [{ text: contextPrompt }] },
  ];

  const iterateSystemPrompt = [
    brandVoice ? `BRAND VOICE GUIDE — maintain this writing style in all revisions:\n${brandVoice}` : null,
    PARAMOUNT_TRAINING_CONTEXT,
    ITERATE_SYSTEM_PROMPT,
  ].filter(Boolean).join('\n\n');

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: iterateSystemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[LLM Service] Iterate error:', errorText);
    throw new Error(`Gemini iterate error: ${response.status}`);
  }

  const result = await response.json();
  const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('No content returned from Gemini iterate');
  }

  let parsed: { reply: string; updatedExpansions: ExpandedContent | null; additionalSlides: AdditionalSlide[] | null };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Failed to parse iterate response as JSON');
  }

  const output: { reply: string; updatedExpansions?: ExpandedContent } = { reply: parsed.reply };

  if (parsed.updatedExpansions) {
    const e = parsed.updatedExpansions;
    if (!Array.isArray(e.problemExpansions) || e.problemExpansions.length < 1) {
      throw new Error('Invalid problemExpansions in iterate response');
    }
    if (!Array.isArray(e.benefitExpansions) || e.benefitExpansions.length < 1) {
      throw new Error('Invalid benefitExpansions in iterate response');
    }
    // Pad to 4 if Gemini returned fewer than expected
    while (e.problemExpansions.length < 4) e.problemExpansions.push('Additional challenge to be identified.');
    while (e.benefitExpansions.length < 4) e.benefitExpansions.push('Additional benefit to be identified.');
    // Preserve existing customTitles and additionalSlides from current expansions
    output.updatedExpansions = {
      ...e,
      customTitles: currentExpansions?.customTitles,
      additionalSlides: currentExpansions?.additionalSlides,
    };
  }

  // Merge additional slides into updatedExpansions (or create a shell if only additional slides were returned)
  if (Array.isArray(parsed.additionalSlides) && parsed.additionalSlides.length > 0) {
    if (!output.updatedExpansions && currentExpansions) {
      // Keep existing expansions, just add the new slides
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
    "designStyle": "standard" | "bold-agency" | "executive-minimal"
  }
}

If the user's request does not relate to visual design, set "designConfig" to null and explain in "reply".
Only include "designStyle" when the user implies a layout change (e.g. "more dramatic", "executive style", "agency feel"). For pure color requests, omit designStyle from the response.

IMPORTANT: Return ONLY the JSON object, no markdown or code blocks.`;

export async function iterateDesign(
  currentDesignConfig: DesignConfig,
  userInstruction: string,
  history: ChatMessage[]
): Promise<{ reply: string; designConfig?: DesignConfig }> {
  if (!GEMINI_API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY environment variable is not set');
  }

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

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: DESIGN_ITERATE_SYSTEM_PROMPT }] },
      contents,
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[LLM Service] Design iterate error:', errorText);
    throw new Error(`Gemini design iterate error: ${response.status}`);
  }

  const result = await response.json();
  const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('No content returned from Gemini design iterate');
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
