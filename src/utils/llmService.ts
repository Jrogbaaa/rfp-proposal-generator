import type { ProposalData, ExpandedContent, DesignConfig } from '../types/proposal';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

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

  const base64Data = await fileToBase64(file);

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: base64Data,
            },
          },
          { text: PDF_EXTRACTION_PROMPT },
        ],
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[LLM Service] PDF analysis error:', errorText);
    throw new Error(`Gemini PDF analysis failed: ${response.status}`);
  }

  const result = await response.json();
  const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!content) {
    throw new Error('No content returned from Gemini PDF analysis');
  }

  let extracted: Record<string, unknown>;
  try {
    extracted = JSON.parse(content);
  } catch {
    console.error('[LLM Service] Failed to parse PDF analysis response:', content);
    throw new Error('Failed to parse PDF analysis response as JSON');
  }

  // Convert extracted data into the brief text format that useBriefParser understands
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
  parsedData: Partial<ProposalData>
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

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: SYSTEM_PROMPT }],
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
  }
}

CRITICAL: You MUST always return exactly 4 items in each array. If the original only had 2 real problems, the other 2 will be placeholders — refine them too in the same style as the others.

If the user asks for a design change (colors, layout, visuals) that cannot be reflected in text, set "updatedExpansions" to null and explain in "reply" that design changes will be applied when exporting to Google Slides.

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
  history: ChatMessage[]
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

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: ITERATE_SYSTEM_PROMPT }] },
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

  let parsed: { reply: string; updatedExpansions: ExpandedContent | null };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Failed to parse iterate response as JSON');
  }

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
    return { reply: parsed.reply, updatedExpansions: e };
  }

  return { reply: parsed.reply };
}

const DESIGN_ITERATE_SYSTEM_PROMPT = `You are a design consultant refining a sales presentation's visual style.

The user will request visual or aesthetic changes. Map their request to exactly one of three color themes:
- "navy-gold": Professional, authoritative, premium. Dark navy backgrounds with gold/orange accents. Best for financial services, enterprise, luxury, or classic professional styles.
- "slate-blue": Modern, technological, trustworthy. Slate backgrounds with blue accents. Best for SaaS, tech, healthcare, or clean modern styles.
- "forest-green": Purposeful, sustainable, growth-oriented. Dark green backgrounds with green accents. Best for sustainability, impact, wellness, or nature-focused brands.

Return ONLY valid JSON with this structure:
{
  "reply": "Brief conversational response describing the change (1-2 sentences)",
  "designConfig": {
    "colorTheme": "navy-gold" | "slate-blue" | "forest-green"
  }
}

If the user's request does not relate to visual design or you cannot map it to a theme, set "designConfig" to null and explain in "reply".

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
