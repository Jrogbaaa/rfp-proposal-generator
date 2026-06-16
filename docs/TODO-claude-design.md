# TODO — "Design with Claude" export (parked)

Status: **Built & verified, but parked.** All code is written and compiles
(`tsc` + `npm run build` + lint pass). The feature is inactive until an
Anthropic API key is added, and nothing has been committed/pushed yet.

## What it does

Adds a second export option in Step 3 (Design Studio), beneath the existing
"Create Google Slides Presentation" button. It sends the deck content + brand
palette to Claude's pre-built `pptx` Agent Skill via the API, gets back a
polished `.pptx`, then reuses the existing Drive upload to convert it to a
native Google Slides file.

Trade-off (decided): Claude designs its own layout, so the output is NOT a
pixel match of the Step-3 canvas — it's an AI-designed deck on the same
content/brand. Richer graphics, but costs an API call and takes a few minutes.

## Done

- [x] `api/_lib/anthropicDeck.ts` — `generateDeckPptx(prompt)`: calls Messages API
      with `pptx` skill + `code_execution` tool, extracts the file_id from the
      tool-result blocks, downloads bytes via the Files API, returns base64.
- [x] `api/anthropic/generate-deck.ts` — Vercel route (POST `{ prompt }`).
- [x] `server/routes/anthropic.ts` — Express dev route, mounted at `/api/anthropic`
      in `server/index.ts`.
- [x] `src/utils/claudeSlides.ts` — `createSlidesViaClaude(...)`: builds the
      content/brand brief, decodes the `.pptx`, uploads to Drive.
- [x] `src/utils/buildProposalData.ts` — shared helper extracted from
      `GoogleSlidesButton`.
- [x] `src/components/ClaudeDesignButton.tsx` — the new export button + progress UI,
      wired into `DesignStudio.tsx`.
- [x] `src/utils/pptxExport.ts` — `uploadPptxToDrive()` now exported for reuse.
- [x] `vercel.json` — `api/anthropic/generate-deck.ts` `maxDuration` raised to 300s.
- [x] `.env.example` — added `ANTHROPIC_API_KEY` + optional `ANTHROPIC_MODEL`.
- [x] `docs/CHANGELOG.md` + `docs/COMPONENTS.md` updated.

## To do (when resuming)

- [ ] **Add `ANTHROPIC_API_KEY`** to local `.env` and Vercel env vars.
      Until then the button returns a clear "not configured" error.
- [ ] **Pick the model.** Default is `claude-sonnet-4-5-20250929` (fast).
      Set `ANTHROPIC_MODEL` to an Opus model if prioritizing design quality
      over latency.
- [ ] **Test end-to-end** with a real key on the **local dev server**
      (`npm run dev`). Confirm a `.pptx` is generated and converts to Google
      Slides. (Vercel Hobby's 60s cap will time out — see below.)
- [ ] **Resolve prod latency.** The skill agent loop takes minutes. Vercel
      Hobby caps functions at 60s. Either upgrade to Vercel Pro (route already
      set to 300s) or keep this feature local-only for now.
- [ ] **Commit + push** to `origin main` per the CLAUDE.md Documenter workflow
      (awaiting explicit go-ahead).

## Notes / caveats

- The `pptx` skill is real and available: API quickstart
  (`platform.claude.com/docs/en/agents-and-tools/agent-skills/quickstart`) and
  source at `github.com/anthropics/skills` (`skills/pptx`). The document skills
  are **source-available, not open source** (proprietary license) — fine to
  reference, a licensing question to copy.
- Response payload is the base64 `.pptx`. Text/vector decks are small (<1MB);
  watch Vercel's ~4.5MB response limit if decks ever balloon with imagery.
- API betas used: `code-execution-2025-08-25`, `files-api-2025-04-14`,
  `skills-2025-10-02`.
