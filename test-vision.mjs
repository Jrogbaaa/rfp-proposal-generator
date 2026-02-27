/**
 * Vision API Diagnostic Test
 * Usage: node test-vision.mjs "path/to/brief.pdf"
 *        node test-vision.mjs --all   (runs all 4 Paramount PDFs)
 *
 * Tests Gemini 2.5 Flash's ability to read PDF content (text + images).
 */

import fs from 'fs';
import path from 'path';

// --- Read API key from .env ---
function loadEnv() {
  try {
    const envText = fs.readFileSync(new URL('.env', import.meta.url), 'utf8');
    for (const line of envText.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('VITE_GEMINI_API_KEY=')) {
        return trimmed.slice('VITE_GEMINI_API_KEY='.length).replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // .env not found
  }
  return process.env.VITE_GEMINI_API_KEY || '';
}

// --- Same prompt as llmService.ts ---
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

// --- Build formatted brief text (same as llmService.ts:101-131) ---
function buildBriefText(extracted) {
  const lines = [];
  if (extracted.projectTitle) lines.push(`Project: ${extracted.projectTitle}`);
  const nameParts = [extracted.clientFirstName, extracted.clientLastName].filter(Boolean);
  const clientParts = [...nameParts];
  if (extracted.clientEmail) clientParts.push(extracted.clientEmail);
  if (extracted.clientCompany) clientParts.push(extracted.clientCompany);
  if (clientParts.length) lines.push(`Client: ${clientParts.join(', ')}`);
  if (extracted.timeline) lines.push(`Timeline: ${extracted.timeline}`);
  if (extracted.budget) lines.push(`Budget: ${extracted.budget}`);
  if (Array.isArray(extracted.problems) && extracted.problems.length) {
    lines.push('');
    lines.push('Problems:');
    extracted.problems.forEach(p => lines.push(`- ${p}`));
  }
  if (Array.isArray(extracted.benefits) && extracted.benefits.length) {
    lines.push('');
    lines.push('Benefits:');
    extracted.benefits.forEach(b => lines.push(`- ${b}`));
  }
  if (extracted.brandNotes) {
    lines.push('');
    lines.push(`Brand Notes: ${extracted.brandNotes}`);
  }
  return lines.join('\n');
}

// --- Main test function ---
async function testPdf(pdfPath, apiKey) {
  const label = path.basename(pdfPath);
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  PDF: ${label}`);
  console.log(`${'═'.repeat(70)}`);

  // Load and encode PDF
  let pdfBuffer;
  try {
    pdfBuffer = fs.readFileSync(pdfPath);
  } catch (err) {
    console.error(`  ✗ Could not read file: ${err.message}`);
    return;
  }
  const base64Data = pdfBuffer.toString('base64');
  console.log(`  File size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`  Calling Gemini 2.5 Flash Vision API...`);

  const startMs = Date.now();

  const makeRequest = async (withResponseMimeType) => {
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { inline_data: { mime_type: 'application/pdf', data: base64Data } },
              { text: PDF_EXTRACTION_PROMPT },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
            ...(withResponseMimeType ? { responseMimeType: 'application/json' } : {}),
          },
        }),
      }
    );
  };

  let response;
  try {
    response = await makeRequest(true);
  } catch (err) {
    console.error(`  ✗ Network error: ${err.message}`);
    return;
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
  console.log(`  Response: HTTP ${response.status} (${elapsed}s)`);

  const rawBody = await response.text();

  if (!response.ok) {
    console.error(`\n  ✗ API ERROR:`);
    console.error(rawBody);
    return;
  }

  let result;
  try {
    result = JSON.parse(rawBody);
  } catch {
    console.error(`  ✗ Failed to parse API response as JSON`);
    console.error(rawBody.slice(0, 500));
    return;
  }

  let contentText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!contentText) {
    console.error(`  ✗ No content in Gemini response`);
    console.log('\n  [FULL API RESPONSE]:');
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Usage stats
  const usage = result.usageMetadata;
  if (usage) {
    console.log(`  Tokens: ${usage.promptTokenCount} prompt → ${usage.candidatesTokenCount} output`);
  }

  // Try to parse JSON; retry without responseMimeType if it fails
  let extracted;
  try {
    extracted = JSON.parse(contentText);
  } catch {
    console.warn(`  ⚠ JSON parse failed (${usage?.candidatesTokenCount ?? '?'} tokens) — retrying without responseMimeType...`);
    try {
      const retryResponse = await makeRequest(false);
      const retryBody = await retryResponse.text();
      const retryResult = JSON.parse(retryBody);
      contentText = retryResult.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const retryUsage = retryResult.usageMetadata;
      if (retryUsage) {
        console.log(`  Retry tokens: ${retryUsage.promptTokenCount} prompt → ${retryUsage.candidatesTokenCount} output`);
      }
      // Strip markdown fences if present
      const cleaned = contentText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)?.[1]?.trim() ?? contentText.trim();
      extracted = JSON.parse(cleaned);
      console.log(`  ✓ Retry succeeded`);
    } catch (retryErr) {
      console.error(`  ✗ Retry also failed: ${retryErr.message}`);
      console.error(`  Raw content (first 500 chars): ${contentText.slice(0, 500)}`);
      return;
    }
  }

  // --- EXTRACTED FIELDS ---
  console.log(`\n  ┌─ EXTRACTED FIELDS ${'─'.repeat(50)}`);
  console.log(`  │  clientCompany:  ${extracted.clientCompany || '(empty)'}`);
  console.log(`  │  clientFirstName: ${extracted.clientFirstName || '(empty)'}`);
  console.log(`  │  clientLastName:  ${extracted.clientLastName || '(empty)'}`);
  console.log(`  │  clientEmail:     ${extracted.clientEmail || '(empty)'}`);
  console.log(`  │  projectTitle:    ${extracted.projectTitle || '(empty)'}`);
  console.log(`  │  timeline:        ${extracted.timeline || '(empty)'}`);
  console.log(`  │  budget:          ${extracted.budget || '(empty)'}`);

  if (Array.isArray(extracted.problems) && extracted.problems.length) {
    console.log(`  │  problems (${extracted.problems.length}):`);
    extracted.problems.forEach((p, i) => console.log(`  │    ${i + 1}. ${p}`));
  } else {
    console.log(`  │  problems:        (none extracted)`);
  }

  if (Array.isArray(extracted.benefits) && extracted.benefits.length) {
    console.log(`  │  benefits (${extracted.benefits.length}):`);
    extracted.benefits.forEach((b, i) => console.log(`  │    ${i + 1}. ${b}`));
  } else {
    console.log(`  │  benefits:        (none extracted)`);
  }

  console.log(`  └─ BRAND NOTES ${'─'.repeat(53)}`);
  if (extracted.brandNotes) {
    const words = extracted.brandNotes.split(' ');
    const chunks = [];
    for (let i = 0; i < words.length; i += 12) chunks.push(words.slice(i, i + 12).join(' '));
    chunks.forEach(chunk => console.log(`     ${chunk}`));
  } else {
    console.log(`     (empty — Vision API may not be reading images)`);
  }

  // --- FORMATTED BRIEF (as app would produce) ---
  console.log(`\n  ┌─ APP BRIEF TEXT ${'─'.repeat(51)}`);
  const briefText = buildBriefText(extracted);
  if (briefText) {
    briefText.split('\n').forEach(line => console.log(`  │  ${line}`));
  } else {
    console.log(`  │  (nothing extracted — completely empty)`);
  }
  console.log(`  └${'─'.repeat(67)}`);

  // Vision API quality check
  const score = {
    hasCompany: Boolean(extracted.clientCompany),
    hasProject: Boolean(extracted.projectTitle),
    hasProblems: Array.isArray(extracted.problems) && extracted.problems.length > 0,
    hasBenefits: Array.isArray(extracted.benefits) && extracted.benefits.length > 0,
    hasBrandNotes: Boolean(extracted.brandNotes),
  };
  const passed = Object.values(score).filter(Boolean).length;
  console.log(`\n  Quality: ${passed}/5 fields populated  [${Object.entries(score).map(([k, v]) => `${v ? '✓' : '✗'}${k.replace('has', '')}`).join('  ')}]`);
}

// --- Entry point ---
const apiKey = loadEnv();
if (!apiKey) {
  console.error('Error: VITE_GEMINI_API_KEY not found in .env');
  process.exit(1);
}
console.log(`Gemini Vision API Test — key: ${apiKey.slice(0, 8)}...`);

const ALL_PDFS = [
  '/Users/JackEllis/Documents/paramount files/TMUS 25-26 Upfront Brief_Paramount.pdf',
  '/Users/JackEllis/Documents/paramount files/Dunkin_Content Day_2026 final.pdf',
  '/Users/JackEllis/Documents/paramount files/UA Q4 FY26_Custom Media Partnership Brief (1).pdf',
  '/Users/JackEllis/Documents/paramount files/FY26 Army HPP Brief_Partner_27 MAY 2025_PARAMOUNT.pdf',
];

const args = process.argv.slice(2);
const pdfsToTest = args.includes('--all')
  ? ALL_PDFS
  : args.length > 0
    ? args
    : ALL_PDFS; // default: run all

for (const pdfPath of pdfsToTest) {
  await testPdf(pdfPath, apiKey);
}

console.log(`\n${'═'.repeat(70)}`);
console.log('  Done.');
console.log(`${'═'.repeat(70)}\n`);
