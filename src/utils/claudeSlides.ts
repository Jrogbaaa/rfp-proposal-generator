/**
 * "Design with Claude" export path.
 *
 * Sends the deck content + brand styling to the server-side pptx Agent Skill
 * (see api/_lib/anthropicDeck.ts), receives a polished .pptx as base64, then
 * reuses the existing Drive upload to convert it to a native Google Slides file.
 *
 * Trade-offs vs the deterministic PptxGenJS export:
 *   - Claude designs the layout/graphics itself, so the output won't be a
 *     pixel match of the Step 3 canvas — it's an AI-designed deck on the same
 *     content and brand palette.
 *   - Generation runs an agent loop and can take a few minutes.
 */

import type { ProposalData, DesignConfig } from '../types/proposal'
import { buildSlidesFromData } from './slideBuilder'
import { resolveTheme } from './design/system'
import { uploadPptxToDrive } from './pptxExport'

const GENERATE_ENDPOINT = '/api/anthropic/generate-deck'

// Generous client-side cap so a slow agent loop doesn't hang the tab forever.
const CLIENT_TIMEOUT_MS = 300_000

export interface ClaudeDeckResult {
  presentationUrl: string
  presentationId: string
  title: string
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/** Build a content + style brief for the pptx skill from the proposal data. */
function buildDeckPrompt(data: ProposalData, designConfig: DesignConfig): string {
  const theme = resolveTheme(designConfig.colorTheme)
  const slides = buildSlidesFromData(data)
  const company = data.client.company || 'the client'
  const title = data.project.title || 'Proposal'

  const outline = slides
    .map((s) => {
      const lines = [`Slide ${s.slideNumber} — ${s.title}`]
      if (s.subtitle) lines.push(`  Subtitle: ${s.subtitle}`)
      for (const b of s.bullets) lines.push(`  • ${b}`)
      return lines.join('\n')
    })
    .join('\n\n')

  return [
    `Create a polished, modern 16:9 PowerPoint sales/proposal deck titled "${title}", prepared for ${company}.`,
    '',
    'Use this exact content for the slides (keep the wording faithful, tighten only for fit). Do not invent new statistics:',
    '',
    outline,
    '',
    'Design direction:',
    `- Brand palette — background/paper ${theme.paper}, ink/text ${theme.ink}, single accent ${theme.accent}, muted text ${theme.mute}. Use the accent sparingly: one accent gesture per slide, never as a gradient.`,
    '- Typography — a high-contrast editorial serif for titles (e.g. "Newsreader" or "Playfair Display") and a clean geometric sans for body (e.g. "Manrope" or "Inter"). Generous whitespace, strong type hierarchy.',
    '- Layout — vary layouts by content shape (cover, section divider, bulleted content, stat grid, quote/impact statement, closing CTA). Avoid cramped slides; never shrink body text below ~16pt.',
    '- For any slide whose content is mostly numbers/stats, present them as native charts or clean stat cards rather than plain bullets.',
    '- No clip-art, no stock-photo placeholders, no gradients. Keep it premium and consulting-grade.',
    '',
    'Produce a single editable .pptx file as the final output.',
  ].join('\n')
}

/**
 * Generate an AI-designed deck via the Claude pptx skill and upload it to
 * Google Drive as a native Google Slides presentation.
 */
export async function createSlidesViaClaude(
  data: ProposalData,
  designConfig: DesignConfig,
  getToken: () => Promise<string>,
): Promise<ClaudeDeckResult> {
  const prompt = buildDeckPrompt(data, designConfig)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS)

  let pptxBase64: string
  try {
    const resp = await fetch(GENERATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    })

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({})) as { error?: string }
      throw new Error(body.error || `Claude deck generation failed (${resp.status})`)
    }

    const json = await resp.json() as { pptxBase64?: string }
    if (!json.pptxBase64) throw new Error('Claude returned no deck file')
    pptxBase64 = json.pptxBase64
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error('Claude deck generation timed out. Try again or use the standard export.')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  const arrayBuffer = base64ToArrayBuffer(pptxBase64)
  const title = data.project.title || 'Proposal'
  const token = await getToken()
  const result = await uploadPptxToDrive(arrayBuffer, title, token)

  return {
    presentationId: result.id,
    presentationUrl: result.webViewLink,
    title,
  }
}
