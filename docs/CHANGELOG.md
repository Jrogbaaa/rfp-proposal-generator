# Changelog

## [2026-05-11] — Fix PDF brief upload 504 / `Gemini API request timed out`

### Fixed
- **`src/utils/fetchWithRetry.ts`** — Added `408` and `504` to `RETRYABLE_STATUS_CODES`. Gateway/request timeouts are transient by definition and the existing retry pipeline (3 attempts, exponential backoff, capped at 32s) was skipping them — a single slow Gemini call on `gemini-3-flash-preview` failed the user immediately with no second chance. The user-reported symptom (`/api/gemini/generate-content:1 504`, `{"error":"Gemini API request timed out"}`) was the server's own 55s `AbortController` firing before Gemini answered the PDF analysis call; the client then surfaced the failure verbatim instead of retrying.
- **`src/utils/llmService.ts`** — `analyzeBriefPdf()` now passes `maxRetries: 1` to `fetchWithRetry` (2 total attempts) so that adding 504 to the retry set doesn't blow PDF-upload UX out to ~4 × 58 s = 230 s on a genuinely stuck upstream. Worst case is now ~2 min before the user sees a typed error and can fall back to paste.
- **`api/gemini/generate-content.ts`** + **`api/gemini/upload-file.ts`** — Bumped `UPSTREAM_TIMEOUT_MS` from `55_000` → `58_000`. The Vercel function `maxDuration` is 60s; we were leaving ~5s of headroom on the table. Two extra seconds at the upstream limit handles Gemini tail-latency cases that were timing out at 55s and succeeding at ~56–58s.
- **`src/components/PdfUploader.tsx`** — Catch block now detects `FetchTimeoutError` and `FetchRetryExhaustedError` with status `504`/`408` (plus a string fallback for the legacy `Gemini PDF analysis failed: 504` message) and shows a timeout-specific error: "Gemini took too long to analyze this PDF. Try again, use a smaller PDF, or paste the brief text instead." Generic non-timeout failures still get the original message.

### Why
A user uploaded a PDF in an incognito tab (cold caches) and the request hit `gemini-3-flash-preview` on a slow path. The Vercel proxy aborted at 55s and returned a real HTTP 504. The client's `fetchWithRetry` set was `[429, 500, 502, 503]` — explicitly missing 504 — so the very-recoverable transient gateway timeout propagated straight to the UI as a hard failure. The fixes (a) make 504/408 first-class retryable, (b) cap PDF retries so a stuck upstream doesn't strand the user, (c) reclaim the 5s of unused Vercel function headroom, and (d) give the user actionable guidance when timeouts do exhaust retries.

---

## [2026-05-11] — Password-protect the site (`PARA123`)

### Added
- **`src/components/PasswordGate.tsx`** (new) — Client-side password gate that wraps the entire app. Renders a styled lock screen on the navy backdrop with the cream card / Playfair display heading used elsewhere; submits a password form (Enter or `Unlock` button), validates against the static value `PARA123`, and on success persists `sessionStorage["rfp_site_unlocked"]="1"` and swaps in the protected children. Wrong password triggers an inline error message + a 8-keyframe horizontal shake on the card, clears the input, and re-focuses it. Auto-focuses the input on mount and uses `<input type="password" autocomplete="current-password">` so password managers behave correctly.
- **`src/main.tsx`** — Wrapped `<App />` in `<PasswordGate>` inside the React root so the gate runs **before** any other app code (landing page, Google auth check, brief restore from `sessionStorage`, …). Session-scoped: closing the tab/browser requires re-entry.

### Why
Lightweight, in-app protection for the live deployment. Implemented as a client-side gate (not edge middleware) so it lands immediately on the existing Vercel/Vite setup with no infra changes. The password is intentionally a single shared value (`PARA123`) — this is access-control by obscurity, not real auth, but it blocks casual visitors and search-engine traffic to the staging URL. Session persistence (via `sessionStorage`) means a single unlock per browser session — refreshes don't re-prompt, but closing the tab does.

---

## [2026-05-11] — Step 3 Design Studio overhaul: real design system + intelligent vision review

### Added
- **`src/utils/design/system.ts`** (new) — Single source of truth for slide design tokens. Modular type scale (display 156 / h1 112 / h2 84 / h3 64 / h4 48 / bodyLarge 36 / body 28 / bodySmall 26 / caption 22 / eyebrow 22 / numerals 144–480), sized for a 1920×1080 internal canvas so body text clears the 24px floor at export size. 4-based spacing scale (8 / 16 / 24 / 32 / 48 / 72 / 112 / 160). Per-theme color tokens (`ink`, `paper`, `accent`, `mute`, `surface`, `accentMute`) — no gradient stops, gradients are structurally impossible. Named padding presets (`generous`, `balanced`, `tight`). Display font is **Newsreader** (editorial serif), sans is **Manrope** — both non-Inter / non-Roboto / non-Fraunces by design.
- **`src/utils/design/vocabulary.ts`** (new) — Shared contract between the AI design reviewer and the renderer. Exports the `LayoutVariant` enum (`title-editorial`, `title-stat`, `section-numeral`, `content-list`, `content-two-up`, `content-quote`, `content-stat-grid`, `content-timeline`, `impact-statement`, `closing-cta`), `Emphasis`, `Density`, `Tone` enums, the extended `SlideOverrides` interface (now carries `layoutVariant`, `emphasis`, `density`, `tone`, `eyebrow`, `titleText`, `bulletRewrites`, `maxBullets`, `promotedStat`), and a `defaultLayoutFor(slide)` / `pickLayout(slide, override)` that selects a layout by **content shape** instead of `slideNumber % 3`.
- **`src/components/slides/*.tsx`** (new — 11 files) — Per-variant slide components, each ≤80 lines. `SlideFrame` owns the 1920×1080 canvas, scaling, background, and ref-forwarding. `TitleEditorial`, `TitleStat`, `SectionNumeral`, `ContentList`, `ContentTwoUp`, `ContentQuote`, `ContentStatGrid`, `ContentTimeline`, `ImpactStatement`, `ClosingCta` each compose tokens from the design system. Splits the previous 780-line monolith.
- **Google Fonts @import** — `src/index.css`; Newsreader + Manrope loaded once at app boot with the weights the type scale needs. Added `text-wrap: pretty` / `text-wrap: balance` defaults scoped to `.slide-canvas`.

### Changed
- **`src/components/SlideCanvasRenderer.tsx`** — Rewritten from 780 lines of inline-styled hardcoded layouts to a 70-line dispatcher: resolves theme, picks layout variant (AI override → content-shape fallback), wraps in `SlideFrame`, renders the chosen variant. Internal canvas now **1920×1080** (was 960×540); display scales updated proportionally in DesignStudio (filmstrip 0.165 → 0.0825, focused 0.60 → 0.30) so visual size is unchanged. Re-exports `SlideOverrides` from the shared vocabulary for backwards compatibility.
- **`src/utils/designReview.ts`** — Rewritten end-to-end. Old prompt only adjusted `titleFontSize` / `bodyFontSize` / `maxBullets` / `titleText` — purely text tweaks. New `REVIEW_SYSTEM_PROMPT` is a senior-designer prompt enforcing a strict anti-slop rubric (no filler, less is more, no data slop, hero specific stats only, one accent gesture enforced structurally) and asks the model to pick `layout_variant`, `emphasis`, `density`, `tone` plus optional `title_text` / `bullet_rewrites` / `promoted_stat`. Scores the **current render** against five named criteria (decorative-density, type-hierarchy, whitespace-ratio, content-density, anti-trope), returns the lowest as `quality_score` plus an estimated `quality_score_after`.
- **`src/utils/designReview.ts`** — Review loop now **reviews every slide in parallel** (concurrency cap 4) instead of serial-reviewing 5 slides and extrapolating by `slide.type`. ~6s total for a 12-slide deck vs ~25s previously. Removes the "same type → same overrides" extrapolation that was making the whole deck feel uniform.
- **`src/utils/designReview.ts`** — `captureSlideElement` now `await`s `document.fonts.ready` before rasterizing — html2canvas was capturing fallback-font metrics when the page hadn't finished loading Newsreader/Manrope yet, so the AI saw text that didn't match what the user sees.
- **`src/components/DesignStudio.tsx`** — Score display now shows the **average of the reviewer's actual before/after scores** instead of `min(10, score + 2)` (the old fake "+2 improvement"). Commentary log entries now stream the reviewer's structured single-sentence improvement description as each slide completes in parallel.

### Removed (from `SlideCanvasRenderer.tsx`)
- All `linear-gradient(...)` calls — six of them, on title / section / closing / accent-bar / bottom-strip / variant-A backgrounds.
- The variant-C content layout (rounded-cards-with-left-border-accent) — exactly the AI-slop trope the rubric calls out.
- The `paramountFooter` repeated as a structural element on every slide.
- The dot-style accent bullets on content layouts.
- The combined top-accent-bar + bottom-accent-strip + corner-mark stacking — layouts now use **one** accent gesture each, picked by `toneDefaults()`.
- The `slideNumber % 3` layout cycling — replaced with content-shape selection in `defaultLayoutFor(slide)`.

### Why
The in-app Step 3 preview was generic because (a) the base layouts violated four explicit anti-slop principles (gradient backgrounds everywhere, Inter-only, body text under 24px at export size, 3-4 accent gestures stacked per slide, the rounded-card-with-left-border-accent trope), and (b) the AI "design review" had no vocabulary for layout, emphasis, or composition — it could only tweak fonts. The Google Slides export looked better because it inherits a hand-designed template. Now the in-app renderer is constrained by tokens that make slop structurally impossible, and the AI reviewer can pick from a real layout vocabulary that the renderer enforces. The rubric (no filler, less is more, no data slop, 24px floor, no decorative gradient/emoji/left-border-accent tropes, layout variation as rhythm) is encoded in two places: as the **walls** of the renderer (deterministic, free, offline) and as the **rubric** in the reviewer prompt (runtime, per-slide judgment). The Google Slides export path (`googleSlidesTemplate.ts`) is intentionally untouched — the template-based export still looks correct; this overhaul brings the in-app preview up toward it.

---

## [2026-05-11] — Fix Step 2 inline slide editing on paramount-rfp deck: click-off now persists edits

### Fixed
- **`src/components/SlidePreview.tsx`** — `SlideCard`'s inline edit was a controlled `<textarea>`/`<input>` driven by `editValue` / `titleValue` React state. In the in-Cursor browser (and any environment where focus moves between elements via a synthetic click that doesn't dispatch a real `blur`), the textarea's `onBlur` handler never fired, so `setEditingIndex(null)` was never called, the parent never received the new text, and on the next render the original text reappeared. Rewrote `SlideCard` to use **uncontrolled** inputs with `useRef` (`editTextareaRef`, `titleInputRef`) plus `defaultValue`, reading the actual DOM value on commit. Added `editStartValueRef`/`titleStartValueRef` so commits are no-ops when the value is unchanged.
- **`src/components/SlidePreview.tsx`** — Added a global `mousedown` listener (inside a `useEffect` keyed on `editingIndex` / `isEditingTitle`) that explicitly commits the pending edit when the user clicks anywhere outside the active input/textarea. This bypasses the unreliable native `blur` event in MCP/synthetic-click environments and is the actual fix the user sees.
- **`src/App.tsx`** — `handleSlideEdit` was paramount-rfp-aware but didn't recognise the new persuasion-engine slideKeys (`cultural_shift`, `real_problem`, `cost_of_inaction`, `core_insight`, `paramount_advantage`, `proof`, `how_it_works`, `custom_plan`, `roi_framing`, `closing`). Added explicit routing: `cultural_shift` → `expansions.culturalShift[]`, `real_problem` → `realProblem[]`, `cost_of_inaction` → `costOfInaction[]`, `how_it_works` → `approachSteps[]` (with `^\d{1,2}\s+` prefix-stripping so the rendered `"01  "` step number isn't double-saved). Hardcoded-content slides (`core_insight`, `paramount_advantage`, `proof`, `custom_plan`, `roi_framing`, `closing`) fall through to a new universal `saveAsCustomBullet` helper that writes per-slide / per-bullet overrides into `expansions.customBullets[slideKey][bulletIndex]`.
- **`src/types/proposal.ts`** — Added `customBullets?: Record<string, Record<number, string>>` to `ExpandedContent` so the overrides above have a typed home.
- **`src/utils/slideBuilder.ts`** — Added `applyCustomBullets`, `applyCustomBulletsToSlides`, `applyCustomTitlesToSlides`, and combined `applyEdits` helpers, and now run every generated `SlideData[]` (showcase, generic, and paramount-rfp paths) through `applyEdits(slides, expansions.customTitles, expansions.customBullets)` immediately before return. Hardcoded bullets on slides like `core_insight` now honour user edits, and `customTitles[slideKey]` overrides finally surface on every deck type.

### Why
On the paramount-rfp persuasion deck the user could click a bullet on `cultural_shift`, type, click off — and the edit would silently vanish. Two independent bugs were stacked: (1) the click-off path wasn't actually triggering a save because `onBlur` was being swallowed in synthetic-click environments, and (2) even when a save fired, the new persuasion-engine slideKeys had no routing in `handleSlideEdit`, and slides with hard-coded bullets (core_insight, proof, etc.) had no override mechanism at all. The mousedown listener fixes (1) deterministically; the routing + customBullets/customTitles override layer fixes (2).

### Verified
Tested in the in-Cursor MCP browser end-to-end on a paramount-rfp deck:
- `cultural_shift` bullet edit (canonical field) — persists after click-off ✓
- `core_insight` bullet edit (hardcoded → customBullets fallback) — persists after click-off ✓
- `how_it_works` step 1 edit (canonical with `"01  "` prefix) — persists with prefix correctly stripped on save and re-added on render ✓

---

## [2026-05-11] — Fix Step 2 inline slide editing: showcase / generic deck edits now persist

### Fixed
- **`src/App.tsx`** — `handleSlideEdit` and `handleSlideTitleEdit` were paramount-rfp only. For `paramount-showcase` and `generic` decks the slideKeys are LLM-generated (`south_park`, `daily_show`, `comedy_overview`, …) and didn't match any branch, so the handler hit a no-op `return` and the inline edit was silently dropped. Same problem for titles — `customTitles[slideKey]` was written but `buildSlidesFromData` reads titles directly from `showcaseContent.slides[i].title` / `flexibleSlides[i].title` for those decks. Both handlers now route by `deckType` first: showcase edits mutate `showcaseContent.slides[].bullets/title`, `showcaseContent.audienceInsights[]`, or `showcaseContent.measurementFramework[]`; generic edits mutate `flexibleSlides[].bullets/title`. `additional_*` continues to work uniformly across deck types.
- **`src/utils/slideBuilder.ts`** — Showcase's two hardcoded special slides (`audience_insights`, `measurement`) and `additional_*` slides on both showcase and generic decks now honour `customTitles[slideKey]` overrides, so title edits on them actually show up in the preview. Generic cover title now also honours `editedProjectTitle` for consistency with paramount-rfp.

### Why
On showcase/generic decks the user could click a bullet or title, type a change, click off — and the edit would disappear because the App-level handler didn't recognize the slideKey and the builder didn't consult any override store for those decks. The chat-based edits worked (because the iterate response now writes back into `showcaseContent.slides` / `flexibleSlides` directly) but the click-to-edit-in-place path was still broken.

---

## [2026-05-11] — Fix Step 2 chat: showcase / generic deck edits now actually update the slide preview

### Fixed
- **`src/utils/llmService.ts`** — The iterate response schema only had paramount-rfp fields (`updatedContent` → `culturalShift`, `realProblem`, etc.). For `paramount-showcase` and `generic` decks (whose slide content lives in `showcaseContent.slides` and `flexibleSlides`), the LLM had nowhere on-schema to put its edits, so it either improvised into an unknown top-level field (silently ignored) or into malformed JSON (`Failed to parse iterate response as JSON`). Added two new optional response slots — `updatedShowcaseContent` and `updatedFlexibleSlides` — both expressed as full slide arrays with `slideKey` for per-slide identity.
- **`src/utils/llmService.ts`** — `ITERATE_SYSTEM_PROMPT` now contains "DECK-SPECIFIC RULES" that tell the model which exact response slot to use for each `activeDeckType` and to set the other two slots to null.
- **`src/utils/llmService.ts`** — Deck context for showcase/generic decks now exposes each slide's `slideKey` and numbers slides starting at 2 (slide 1 = cover) so the model's "slide N" interpretation matches what the user sees in the preview.
- **`src/utils/llmService.ts`** — Added `mergeFlexibleSlidesByKey` helper and merge blocks in `iterateProposalContent` that write `updatedShowcaseContent` into `output.updatedExpansions.showcaseContent` and `updatedFlexibleSlides` into `output.updatedExpansions.flexibleSlides`. `buildSlidesFromData` reads those exact fields, so the preview now rerenders on showcase / generic chat edits.

### Why
For `paramount-showcase` decks (the most common one used in the app), every chat edit either silently no-op'd the preview ("AI says it changed slide 4 to 3 bullets — but the preview still shows 5") or threw a JSON parse error. Runtime evidence captured during the debug session showed the model returning a `showcaseContent` field that the merge code didn't know about, so `onExpansionsUpdated` was either never called or called with an unchanged `ExpandedContent`.

---

## [2026-05-11] — Feature: AI Design Studio (Step 3)

### Added
- **`src/components/DesignStudio.tsx`** — New Step 3 component replacing the static success card. Renders slides as a live 16:9 visual presentation, runs a Gemini vision design review loop, shows real-time AI commentary and design score improvement (e.g. 7/10 → 9/10), then unlocks the Google Slides export button.
- **`src/components/SlideCanvasRenderer.tsx`** — React component that renders a single `SlideData` as a properly designed 16:9 HTML/CSS slide. Supports five layout variants (`title`, `section`, `content`, `impact`, `closing`) using the active `DesignConfig` colour palette. Forwards a ref for html2canvas screenshotting.
- **`src/utils/designReview.ts`** — Gemini vision feedback loop. Captures slide screenshots via `html2canvas`, sends them to the existing `/api/gemini/generate-content` proxy, parses structured design improvements (font sizes, bullet counts, title rewrites), and extrapolates results across slides of the same type.
- **`html2canvas@^1.4.1`** added to `package.json` for client-side slide screenshotting.

### Changed
- **`src/App.tsx`** — Step 3 (`share`) now renders `<DesignStudio>` instead of the static "Presentation created!" success card. The GoogleSlidesButton in Step 2 is replaced with a "Design & Export Presentation" button that transitions to Step 3 immediately; the actual export button lives inside DesignStudio.
- **`e2e/app.spec.ts`** — All 54 tests updated to reflect the new Step 3 flow: `goToShareStep` navigates through DesignStudio (waits for "Design optimized", clicks the embedded GoogleSlidesButton, waits for "Open in Google Slides" link). Step 2 export button tests updated to match the new button label. Step 3 share screen tests updated to assert against DesignStudio's exported state.

### Why
Step 3 was a static success card that just confirmed export was done. The new AI Design Studio makes the presentation generation feel live — slides render visually, the AI reviews each slide screenshot and suggests improvements (font sizes, bullet density, title length), and the user watches the design score improve before exporting. Uses Gemini Flash (already integrated) for vision, so no new API keys needed.

---

## [2026-05-11] — Fix Step 2 chat iteration: slides now update from chat prompts

### Fixed
- **`src/utils/llmService.ts`** — `ITERATE_SYSTEM_PROMPT` rewritten with a full slide map (slide 2 → `culturalShift`, slide 3 → `realProblem`, slide 4 → `costOfInaction`, slide 5 → `coreInsight`, slide 7 → `proofPoints`, slide 8 → `approachSteps`, slide 9 → `customPlan`, slide 11 → `nextSteps`). The previous prompt only output `problemExpansions`/`benefitExpansions` — fields that never appear in the Paramount persuasion deck — so chat edits had no visible effect on the slides.
- **`src/utils/llmService.ts`** — `iterateProposalContent` now sends all current persuasion-engine slide content as context and merges all returned fields back into `ExpandedContent`. Both slide-specific prompts ("make slide 3 more punchy") and general prompts ("tighten everything") now update the correct live slide fields.
- **`src/utils/llmService.ts`** — Extended legacy `updatedExpansions` type in the parsed response to include all persuasion-engine fields, resolving TypeScript build errors introduced by the merge logic.
- **`src/utils/pptxExport.ts`** — Drive upload now throws `RATE_LIMITED:` on HTTP 429, so `GoogleSlidesButton` surfaces "Google API rate limit reached" instead of a raw error string.
- **`e2e/app.spec.ts`** — Fixed Drive API route mock from `https://www.googleapis.com/drive/**` to `https://www.googleapis.com/**drive**` to match the pptx-upload path (`/upload/drive/v3/files`). Added `webViewLink` to mock response so `onSuccess` receives a valid URL and the app transitions to the share step. All 54 tests now pass.
- **`e2e/app.spec.ts`** — Updated `geminiIterationBody` to return `updatedContent` with all persuasion-engine fields matching the new iterate schema.
- **`e2e/app.spec.ts`** — Rewrote "rate limit" test to mock Drive 429 (not Slides API, which is no longer called); rewrote "Slides API 401 mid-batch" test to test the Drive-upload happy path since the old Slides batch-update flow no longer exists.

### Why
Chat prompts in Step 2 visually appeared to work (the AI replied) but the slide preview never changed. The iterate system only updated fields used by the legacy content-review UI, not by the persuasion deck renderer. Users typing "make slide 3 more aggressive" or "tighten everything" saw no change in the slides.

---

## [2026-05-11] — Fix 500 on PDF upload + missing pptxgenjs dependency breaking CI

### Fixed
- **`server/routes/gemini.ts`** — Raised `express.json` limit on `/generate-content` from `2mb` to `25mb`. The client sends PDFs up to 15 MB inline as base64 (≈ 1.33× overhead → ~20 MB JSON bodies), which exceeded the previous limit and caused body-parser to throw `PayloadTooLargeError` before the route handler ran.
- **`server/index.ts`** — Global error handler now respects `err.status` / `err.statusCode` instead of unconditionally returning 500. Payload-too-large errors now surface as 413 with a descriptive message including the limit and actual length; other 4xx errors propagate their original status. This also stops `fetchWithRetry` from retrying non-retryable client errors three times.
- **`package.json` / `package-lock.json`** — Added `pptxgenjs@^4.0.1` as a declared dependency. `src/utils/pptxExport.ts` has been importing `pptxgenjs` for some time, but the dependency was never declared in `package.json`, so `npm install` on Vercel/GitHub CI didn't fetch it and `tsc` failed with `TS2307: Cannot find module 'pptxgenjs' or its corresponding type declarations`. Local dev worked only because the package happened to be present in the local `node_modules`.

### Why
PDF upload on the main dashboard returned `500 GEMINI_500: Internal server error` (visible in `PdfUploader` console log). Runtime instrumentation proved body-parser was rejecting a ~4 MB request body against a 2 MB limit and the global handler was masking the real 413 as 500. Text-only prompting was unaffected because its body is tiny.

The `pptxgenjs` CI failure was an undeclared-dependency drift surfaced by the same session's `npm install` on a fresh CI cache.

---

## [2026-04-13] — Fix Google Search Console duplicate-page indexing errors

### Added
- **`index.html`** — Canonical tag (`<link rel="canonical">`), meta description, and robots meta tag
- **`public/privacy.html`** — Canonical tag, meta description, and robots meta tag
- **`public/terms.html`** — Canonical tag, meta description, and robots meta tag
- **`public/robots.txt`** — Blocks `/api/` from crawlers, references sitemap
- **`public/sitemap.xml`** — Lists all three indexable pages with priority and change frequency

### Changed
- **`vercel.json`** — Added 301 redirect from Vercel subdomain (`rfp-proposal-generator-kappa.vercel.app`) to `rfpparamount.com`; set `trailingSlash: false` to prevent duplicate `/` vs `/index.html` URLs; added `X-Robots-Tag` headers (noindex on `/api/` routes)

### Why
Google Search Console flagged "Duplicate without user-selected canonical" — the site had no canonical tags, no robots.txt, no sitemap, and the Vercel subdomain was live alongside the custom domain. Google was seeing multiple URLs for the same content and couldn't determine the authoritative version.

---

## [2026-04-09] — Narrow OAuth Scope: drop `presentations`, keep `drive.file`

### Changed
- **`src/utils/googleAuth.ts`** — Removed `https://www.googleapis.com/auth/presentations` scope. The app only creates new presentations and copies its own shared template — it never reads the user's existing slides — so `drive.file` alone is sufficient. Scope version bumped from `v4` → `v5`; existing users will be prompted to re-consent with the narrower scope on next sign-in.
- **Cloud Console** — `presentations` scope removed from the OAuth consent screen. Only `drive.file` (non-sensitive, no verification required) remains.

### Why
Google's Third Party Data Safety Team flagged `presentations` as a sensitive scope requiring a CASA security assessment and annual recertification. The narrower `drive.file` scope covers everything the app needs and requires no verification.

---

## [2026-04-07] — Ship-Day Hardening (Security, Performance, UX, Stability)

### Security
- **Strict CORS** — All 7 Vercel serverless handlers and the Express server now use an explicit origin allowlist instead of reflecting the request origin
- **API key cleanup** — Removed stale `VITE_GEMINI_API_KEY` from `vite-env.d.ts` and CI; Gemini key is server-only
- **Upstream timeouts** — All Gemini proxy `fetch()` calls (server + Vercel) now use `AbortController` with 55 s timeout; returns 504 on timeout
- **Rate limiting** — In-memory rate limiter (20 req/min per IP) on Express Gemini proxy routes
- **Input validation** — `fileId` regex guard against path traversal; `NaN` guard on proposal IDs; PDF-only MIME check on upload
- **CORS utility** — New `api/_lib/cors.ts` shared across all serverless handlers

### Performance
- **Code splitting** — `framer-motion` chunked separately (122 KB); `DevTools` lazy-loaded via `React.lazy` (only in dev)
- **Vite build config** — Added `rollupOptions.output.manualChunks` for framer-motion
- **Server compression** — `compression()` middleware added to Express server
- **Auth polling removed** — Replaced `setInterval` polling with event-driven `visibilitychange`/`focus` listeners
- **React memoization** — `useCallback` for `handleReset`, `handleSlidesSuccess`; `useMemo` for `STEP_ORDER`

### Stability
- **State persistence** — Wizard state (`currentStep`, `briefText`, `expansions`, `slidesUrl`) persisted to `sessionStorage`; survives page refresh
- **Lazy DB init** — `server/db.ts` refactored to lazy singleton; prevents crash on DB-unreachable startup
- **Schema unification** — `api/_lib/schema.ts` re-exports from `server/schema.ts`; eliminates drift risk
- **Express error handling** — Added global 404 + 500 middleware; prevents stack trace leaks
- **Pagination** — `GET /api/proposals` limited to 100 results
- **Brand voice upsert** — Added `UNIQUE` constraint handling for brand voice profiles

### UX
- **Reset confirmation** — `window.confirm` dialog before discarding work on "New Proposal"
- **Share via Email** — Renamed from "Share via Outlook" (generic `mailto:` link)
- **Clipboard fallback** — `BriefEditor` falls back to `execCommand('paste')` when `navigator.clipboard` is denied
- **Color contrast** — `navy-400` adjusted to `#7b93c0` for WCAG AA compliance
- **Empty state** — `ParsedField` displays italic "Pending" instead of blank
- **Button validation** — "Continue to Refine" disabled when brief < 10 characters

### Tests
- **E2E fixes** — Tests now bypass landing page gate via `sessionStorage`; updated "Share via Email" assertions; dialog handling for reset confirmation

---

## [2026-04-07] — Fix OAuth redirect_uri_mismatch + redirect loop

### Fixed
- **OAuth `redirect_uri_mismatch`** — Vercel's primary domain is `www.rfpparamount.com` (non-www 307-redirects to it), but the GCP OAuth client only had the non-www origin registered. Fix: add `https://www.rfpparamount.com` to Authorized JavaScript Origins in GCP Console.
- **`vercel.json`** — Removed a www→non-www redirect that conflicted with Vercel's non-www→www domain redirect, causing `ERR_TOO_MANY_REDIRECTS`.

---

## [2026-04-07] — Landing Page for Google OAuth Verification

### Added
- **`src/components/LandingPage.tsx`** — New homepage component that satisfies Google's OAuth app verification requirement ("homepage does not explain the purpose of your application"). Includes: hero section explaining the app purpose, 3-step "How it works" flow, transparent "How we use Google APIs" section detailing Slides and Drive scopes with rationale, data privacy banner, and CTA to enter the app.
- **`src/App.tsx`** — Added `showLanding` state (session-gated via `sessionStorage`) so first-time visitors see the landing page; clicking "Get Started" or "Launch App" enters the proposal workflow. Returning visitors within the same session skip straight to the app.

### Changed
- **`src/App.tsx`** — Import `LandingPage`; early return renders landing page when `showLanding` is true.

---

## [2026-04-03] — Custom Domain: rfpparamount.com

### Changed
- **Production URL** updated to `rfpparamount.com` — custom domain now live on Vercel (SSL cert provisioning in progress; app also available at `rfp-proposal-generator-kappa.vercel.app`)
- **`docs/CHANGELOG.md`** — Updated all references from `rfp-proposal-generator-kappa.vercel.app` to `rfpparamount.com`

### Verified
- Homepage loads correctly; Step 1 (Draft) brief parsing confirmed working
- No JS console errors on production

---

## [2026-03-23] — Fix E2E Test Selectors for ChatInterface Redesign

### Fixed
- **`e2e/app.spec.ts`** — Updated 12 stale selectors after the ChatInterface redesign: greeting text (`"Hi! I've reviewed"` → `"I've reviewed"`), suggested prompt aria-labels (`"Make it more concise"` → `"Suggest: More concise"` etc.), chat placeholder (`"Ask for changes"` → `"Tell me how to change"`), sidebar heading (`"Refine Content"` → `"AI Copywriter"`). These mismatches caused every Step 2+ test to fail, and with 2 retries × 1 worker the total runtime exceeded the 15-minute CI timeout, resulting in "The operation was canceled."
- **`.github/workflows/e2e.yml`** — Bumped CI job `timeout-minutes` from 15 to 25, giving resilience tests (429 backoff, token refresh) sufficient headroom.

### Verified
- All 54 E2E tests pass locally (2.1 minutes, 0 retries needed).

---

## [2026-03-23] — Backend Parity Fix (Express ↔ Vercel)

### Fixed
- **`server/routes/gemini.ts`** — Express `generate-content` proxy now normalizes Gemini 2.5-style `thinkingConfig.thinkingBudget` to Gemini 3-style `thinkingConfig.thinkingLevel`, matching the Vercel serverless function (`api/gemini/generate-content.ts`). Previously, dev (Express) forwarded the request body as-is while prod (Vercel) performed the normalization, causing inconsistent behavior between environments. Error responses now include a `detail` field with the upstream error message, also matching the Vercel function.

### Verified
- Full QA pass on `http://localhost:5173/`: Step 1 (Prompt tab text input, brief parsing, "Continue to refine" button), Step 2 (AI content generation via Gemini, slide preview with 11+ persuasion arc slides, ChatInterface refinement with real-time slide updates), backend API endpoints (`/api/health`, `/api/brand-voice`, `/api/proposals`, `/api/gemini/generate-content`), static pages (`/privacy.html`, `/terms.html`). All features working correctly.

---

## [2026-03-23] — Chatbot UI Redesign

### Changed
- **`src/components/ChatInterface.tsx`** — Complete redesign of the Refine step chat panel to make it unmistakably a chatbot. Added a dedicated "AI Copywriter" header bar with gold-gradient bot avatar, status indicator (Ready/Writing), and subtitle "Edits update slides in real time". Suggested prompts redesigned from wrapped flex buttons to a compact horizontal scroll strip with emoji-prefixed labels and no-scrollbar overflow. Input area changed from 3-row textarea + adjacent send button to a single-row auto-expanding textarea (max 120px) with inline send button inside the input container. Message bubbles now use white bg with subtle border for assistant messages. Bot avatar reused as a reusable `BotAvatar` component with `sm`/`md` sizes.
- **`src/App.tsx`** — Removed redundant "Refine Content" section label from the iterate step sidebar (the ChatInterface header now self-identifies). Tightened sidebar padding from `p-6 lg:p-8` to `p-4 lg:p-5` and chat container from `p-4` to `p-3.5` to maximize vertical space. Changed chat container from `overflow-y-auto` to `overflow-hidden` (ChatInterface handles its own scrolling). Reduced GoogleSlidesButton spacing from `mt-4 pt-4` to `mt-3 pt-3`.

---

## [2026-03-23] — Fix Slide Text Truncation (Ellipsis Cutoff)

### Fixed
- **`src/utils/googleSlides.ts`** — Bullet and body text on Google Slides was being hard-truncated with "..." at fixed character limits (80-200 chars) before any font sizing was attempted. Replaced `truncateBullets()` calls across all 15+ slide builder functions with new `fitBullets()` / `fitText()` helpers that shrink font size first (stepping down 1pt at a time to a 10pt floor) and only truncate as a last resort at the minimum readable size. Affected slides: additionalContentSlide, culturalShiftSlide, realProblemSlide, costSlide, coreInsightSlide, paramountAdvantageSlide, howItWorksSlide, customPlanSlide, roiFramingSlide, integrationConceptSlide, appendixSlide.
- **`src/utils/slideBuilder.ts`** — Preview builder character limits raised from 120/100 to 300/250 chars, and max bullet count raised from 5 to 8, so in-app preview no longer clips content that will appear in full on the final slides.

### Added
- **`src/utils/googleSlides.ts`** — `fitBullets()` helper: takes bullet array + text box dimensions, tries full untruncated text at target font size, steps down by 1pt to a minimum (default 10pt), only truncates at the floor. Returns `{ text, fontSize }`.
- **`src/utils/googleSlides.ts`** — `fitText()` helper: same adaptive approach for single text blocks (used in cost cards, how-it-works steps, integration concept mechanics).

---

## [2026-03-20] — Persuasion-Engine Presentation Template Overhaul

### Added
- **`src/types/proposal.ts`** — New interfaces: `ProofPoint`, `CustomClientPlan`, `IndustryInsight`; new `ExpandedContent` fields: `culturalShift`, `realProblem`, `costOfInaction`, `coreInsight`, `proofPoints`, `customPlan`, `industryInsights`; new `ParamountMediaContent` fields: `proofPoints`, `industryInsights`
- **`src/utils/trainingContext.ts`** — `PROOF_POINTS_DATABASE` (real Paramount case study stats) and `INDUSTRY_INSIGHTS_MAP` (category-specific insights: QSR, telecom, retail, auto, CPG, financial, government)
- **`src/utils/googleSlides.ts`** — 9 new persuasion slide builders: `culturalShiftSlide`, `realProblemSlide`, `costSlide`, `coreInsightSlide`, `paramountAdvantageSlide`, `proofSlide`, `howItWorksSlide`, `customPlanSlide`, `roiFramingSlide`
- **`e2e/app.spec.ts`** — 10 new E2E tests for the persuasion slide structure: titles, slide count, proof points, client personalization, core insight, cost of inaction, investment vs impact, industry insights

### Changed
- **`src/utils/llmService.ts`** — `SYSTEM_PROMPT` rewritten to request persuasion-engine content (culturalShift, realProblem, costOfInaction, coreInsight, proofPoints, customPlan, industryInsights); LLM now receives `PROOF_POINTS_DATABASE` and `INDUSTRY_INSIGHTS_MAP` as context; `LLMResponse` interface extended; response parsing extracts new fields; iterate function preserves persuasion fields
- **`src/utils/googleSlides.ts`** — `orderedSlides` arrays for both `paramount-rfp` and generic consulting deck paths replaced with the 11-slide persuasion arc: Cover → Cultural Shift → Real Problem → Cost of Inaction → Core Insight → Paramount Advantage → Proof → How It Works → Custom Plan → ROI Framing → Next Steps → Close
- **`src/utils/slideBuilder.ts`** — Preview builder generates the new 11-slide persuasion structure with default fallback content for each slide; old challenge/solution/benefit/investment slides removed
- **`src/data/slideContent.ts`** — `TMOBILE_PARAMOUNT_SLIDES` rewritten to follow the 12-slide persuasion template with T-Mobile-specific cultural shift, proof points, custom plan, and ROI framing

### Removed
- **`src/utils/googleSlides.ts`** — Old slide builders removed: `challengeSlide`, `problemDeepDive`, `problemsCombined`, `solutionSlide`, `approachSlide`, `benefitsCombined`, `investmentSlide`, `opportunitySlide`, `tierInvestmentSlide`, `decorativeNumber`

---

## [2026-03-20] — Fix Slide Text Overlap & Add Paramount Advertising Logo

### Fixed
- **`src/utils/googleSlides.ts`** — Title slide: project title text box overflow fixed. Box height increased from 500k to 800k EMU, accent rule and date line moved down. Adaptive font sizing (22pt down to 16pt) prevents long titles from overlapping the date line.
- **`src/utils/googleSlides.ts`** — Content slides (`additionalContentSlide`): heading-to-body overlap fixed. Heading box increased from 600k to 1.2M EMU, body pushed from y=1.1M to y=1.7M. Adaptive font sizing (36pt down to 22pt) handles wrapping headings. Bullet paragraph spacing added (lineSpacing: 140%, spaceBelow: 6pt).

### Added
- **`src/utils/googleSlides.ts`** — Adaptive font sizing system: `estimateMaxChars()`, `adaptiveFontSize()`, and `paragraphSpacing()` utilities prevent text overflow across all dynamically-titled slides.
- **`public/paramount-advertising-logo.png`** — Paramount Advertising branded logo (white, transparent background) for use in generated presentations.

### Changed
- **`src/utils/googleSlides.ts`** — Cover slide right panel: replaced small 256px Google favicon with full Paramount Advertising branded logo (2.2" x 1.75"). Removed redundant "PARAMOUNT" text label since the logo includes the wordmark.
- **`src/utils/googleSlides.ts`** — Closing slide: Paramount Advertising logo replaces favicon, larger and centered.

---

## [2026-03-19] — Production QA Pass & Branding Consistency Fix

### Fixed
- **`public/privacy.html`** — Page title corrected from "RFP Proposal Generator" to "Paramount Proj" for consistency with OAuth consent screen app name
- **`public/terms.html`** — Page title corrected from "RFP Proposal Generator" to "Paramount Proj" for consistency with OAuth consent screen app name

### Verified (Production)
- Full 3-step flow confirmed working on `rfpparamount.com` (custom domain; also available at `rfp-proposal-generator-kappa.vercel.app`): prompt input → Gemini generation → Refine step with chat interface and Google Slides button
- `/privacy.html` and `/terms.html` both return 200 and are linked in footer
- Google Search Console domain verification file live at root
- "Google hasn't verified this app" OAuth warning is expected — app is in Production mode pending Google manual review (3–7 business days)

---

## [2026-03-18] — Short-Prompt Support, App Branding & Google OAuth Verification

### Fixed
- **`src/components/SlidePreview.tsx`** — `hasRealData` guard now includes `data.expanded` check. Previously, AI-generated content from short prompts (e.g. "Make a presentation about Paramount IP") would never render slides because `hasRealData` only checked `client.company`, `project.title`, and `content.problems[0]` — all empty for prompt-only inputs. Slide preview now renders correctly for all three deck types (`paramount-rfp`, `paramount-showcase`, `generic`) regardless of whether the brief has structured fields.

### Changed
- **`src/App.tsx`** — "Paste Text" tab renamed to **"Prompt"**; subtitle updated to "Paste your brief or type a prompt" to reflect short-prompt use case
- **`src/App.tsx`** — Added legal footer (`© 2026 Paramount Proj · Privacy Policy · Terms of Service`) to every page — required for Google OAuth consent screen verification
- **`src/components/Header.tsx`** — Added "Paramount Proj" text label next to logo for app name visibility (required for Google Cloud Console app name match)
- **`index.html`** — Page `<title>` updated from "Proposal Generator" to "Paramount Proj" to match Google Cloud Console OAuth consent screen app name

### Added
- **`public/privacy.html`** — Privacy Policy page at `/privacy.html`; covers data collection, Google API scopes, data retention, user rights, and contact info. Required for Google OAuth app verification.
- **`public/terms.html`** — Terms of Service page at `/terms.html`; covers acceptable use, AI-generated content disclaimer, Google Services integration, IP ownership, and governing law. Required for Google OAuth app verification.
- **`public/google574603289c4a64bf.html`** — Google Search Console domain ownership verification file for `rfpparamount.com`

---

## [2026-03-17] — Gemini + Google API Resilience Hardening

### Added
- **`src/utils/fetchWithRetry.ts`** (new) — Drop-in `fetch()` replacement with exponential backoff (1s/2s/4s base, capped at 32s), configurable timeout via `AbortController`, and automatic retries on 429/500/502/503. Respects `Retry-After` headers. Exports `FetchTimeoutError` and `FetchRetryExhaustedError` typed errors for catch blocks.
- **`validateGeminiBody()` helper** — `src/utils/llmService.ts`; detects Gemini 200 OK responses containing error payloads (`result.error`), safety blocks (`finishReason: 'SAFETY'`), and recitation blocks. Throws `GeminiBlockedError` with actionable messages.
- **`GeminiBlockedError` class** — `src/utils/llmService.ts`; typed error for Gemini content blocks (safety, recitation, quota-in-body).
- **`ensureFreshToken(bufferMs=120000)`** — `src/utils/googleAuth.ts`; guarantees the cached token has at least `bufferMs` milliseconds remaining. Triggers re-auth if not. Used before multi-step flows to prevent mid-flow expiry.
- **`clearExpiredToken()`** — `src/utils/googleAuth.ts`; clears stale token from memory + localStorage. Called by the new `visibilitychange` handler.
- **`visibilitychange` handler** — `src/App.tsx`; proactively clears expired tokens when user returns to the tab after idle, updating the auth badge immediately.
- **`TokenGetter` type** — `src/utils/googleSlides.ts`; `() => Promise<string>` callback type used by Slides/Template builders for dynamic token refresh.
- **6 resilience E2E tests** — `e2e/app.spec.ts`; Gemini 503 retry recovery, Gemini 429 backoff recovery, Gemini 200-with-error-body detection, token-expiry-mid-flow re-auth, Slides 401 mid-batch token refresh, full happy-path regression.

### Changed
- **`src/utils/llmService.ts`** — All 6 `fetch()` calls (5 Gemini + 1 Files API upload) replaced with `fetchWithRetry()` with per-call-site timeouts (30s–120s). Every Gemini response now validated via `validateGeminiBody()` before content extraction.
- **`src/utils/googleAuth.ts`** — `prompt: 'consent'` changed to `prompt: ''` after first successful consent (tracked via `gis_has_consented` localStorage key) for faster/silent re-auth on subsequent sign-ins.
- **`src/utils/googleSlides.ts`** — `createGoogleSlidesPresentation()` signature changed from `(data, accessToken, designConfig?)` to `(data, getToken: TokenGetter, designConfig?)`. `withBackoff()` now accepts `(fn, getToken, maxRetries)` and handles both `RATE_LIMITED` (429) and `AUTH_EXPIRED` (401) with automatic token refresh. Initial `POST /v1/presentations` wrapped in `withBackoff`.
- **`src/utils/googleSlidesTemplate.ts`** — `createTemplatePresentation()` signature changed from `(data, accessToken)` to `(data, getToken: TokenGetter)`. Same `withBackoff` upgrade: Drive copy, GET presentation, and batchUpdate all have retry + 401 recovery. Removed duplicated `toApiError`/`withBackoff` in favor of shared pattern.
- **`src/components/GoogleSlidesButton.tsx`** — Uses `ensureFreshToken()` instead of `getValidToken()`. Re-validates token AGAIN before Slides creation. Passes `brandVoice` to `generateProposalContent()` when `preGeneratedContent` is null (previously dropped). Passes `ensureFreshToken` as the `TokenGetter` callback. Error catch block now uses typed error detection (`FetchTimeoutError`, `FetchRetryExhaustedError`, `GeminiBlockedError`) for actionable user messages.
- **`src/App.tsx`** — Added `humanizeGenerationError()` helper for user-friendly error messages from typed errors. Added `brandVoice` prop to `GoogleSlidesButton`. Added `visibilitychange` listener for proactive token cleanup.

### Fixed
- **Gemini HTTP errors (429/500/502/503) no longer cause immediate failure** — `fetchWithRetry` automatically retries with exponential backoff instead of throwing on first error.
- **Gemini 200 OK with hidden error body now properly detected** — `validateGeminiBody()` surfaces the real error message instead of treating it as "empty response."
- **OAuth token no longer expires mid-flow** — `ensureFreshToken(120000)` guarantees 2+ minutes of token lifetime before starting generation; token re-validated before Slides creation.
- **Google Slides 401 mid-batch now retried** — `withBackoff` catches `AUTH_EXPIRED`, refreshes the token, and retries the request.
- **Initial presentation creation / template copy now retried** — Previously had no retry; now wrapped in `withBackoff`.
- **Brand voice no longer dropped on direct export** — `GoogleSlidesButton` passes `brandVoice` to `generateProposalContent()` when generating content inline.
- **OAuth popup no longer forces consent screen after first grant** — `prompt: ''` used for subsequent auth after `gis_has_consented` is set.

---

## [2026-03-17] — Upgrade to Gemini 3 Flash

### Changed
- **`api/gemini/generate-content.ts`** — Default model changed from `gemini-2.0-flash` (shutdown June 1, 2026) to `gemini-3-flash-preview`. Proxy now normalises legacy `thinkingBudget` to Gemini 3's `thinkingLevel` format.
- **`server/routes/gemini.ts`** — Default model changed from `gemini-2.5-flash` to `gemini-3-flash-preview`. Model now configurable via `GEMINI_MODEL` env var.
- **`src/utils/llmService.ts`** — `NO_THINKING` constant updated from `{ thinkingBudget: 0 }` (Gemini 2.5 format) to `{ thinkingLevel: 'low' }` (Gemini 3 format).
- **`.env.example`** — Added optional `GEMINI_MODEL` override documentation.

---

## [2026-03-17] — Vercel Serverless Functions (Production Deployment Fix)

### Added
- **`vercel.json`** — Vercel deployment config with `buildCommand`, `outputDirectory: "dist"`, `framework: "vite"`, and 60s max duration for serverless functions.
- **`api/gemini/generate-content.ts`** — Vercel Serverless Function proxying Gemini `generateContent` requests; ports logic from `server/routes/gemini.ts` POST handler.
- **`api/gemini/upload-file.ts`** — Vercel Serverless Function for uploading base64 PDFs to the Gemini Files API; ports the multipart upload logic from the Express route.
- **`api/gemini/files/[fileId].ts`** — Vercel Serverless Function for fire-and-forget file deletion from the Gemini Files API.
- **`api/brand-voice/index.ts`** — Vercel Serverless Function handling GET/POST/DELETE for brand voice profiles; ports logic from `server/routes/brandVoice.ts`.
- **`api/proposals/index.ts`** — Vercel Serverless Function for GET (list) and POST (create) proposals; ports logic from `server/routes/proposals.ts`.
- **`api/proposals/[id].ts`** — Vercel Serverless Function for GET/PATCH/DELETE single proposal by ID.
- **`api/health.ts`** — Simple health check endpoint returning `{ ok: true }`.
- **`api/_lib/db.ts`** — Shared database connection module for serverless functions; uses `globalThis` caching to reuse connections across warm invocations; single-connection pool (`max: 1`) suitable for serverless.
- **`api/_lib/schema.ts`** — Drizzle ORM schema (copy of `server/schema.ts`) for use by serverless functions.
- **`api/_lib/cors.ts`** — Shared CORS handler for all serverless functions; handles OPTIONS preflight and sets `Access-Control-Allow-*` headers.
- **`@vercel/node`** — Added as dev dependency for Vercel Serverless Function types.

### Fixed
- **Production API 404 errors** — The Express backend (`server/index.ts`) was not deployed to Vercel; all `/api/*` requests returned 404 because Vercel only served the static Vite build. Serverless Functions now handle all API routes that the frontend depends on.

---

## [2026-03-13] — Backend Gemini Proxy + Error Hardening

### Security
- **`server/routes/gemini.ts` (new)** — Express proxy for all Gemini API calls. `GEMINI_API_KEY` now lives server-side only and is never bundled into the browser JS. Routes: `POST /api/gemini/generate-content`, `POST /api/gemini/upload-file`, `DELETE /api/gemini/files/:fileId`.
- **`server/index.ts`** — Gemini router mounted before the global JSON body parser so `/api/gemini/upload-file` can accept up to 100 MB of base64 PDF data.
- **`.env`** — Renamed `VITE_GEMINI_API_KEY` → `GEMINI_API_KEY` (non-`VITE_` prefix so Vite does not embed it in the build).

### Changed
- **`src/utils/llmService.ts`** — All Gemini `fetch` calls now target `/api/gemini/generate-content` instead of `generativelanguage.googleapis.com` directly. `uploadToFilesApi` sends base64 to `/api/gemini/upload-file`; `deleteFilesApiFile` calls `/api/gemini/files/:id`. Removed all `GEMINI_API_KEY` references and runtime key checks from the frontend.
- **`e2e/app.spec.ts`** — Gemini mock pattern updated from `**/generativelanguage.googleapis.com/**` to `**/api/gemini/generate-content` to match the new proxy URL.

### Fixed (error hardening — same session)
- **`src/utils/googleAuth.ts`** — Added 60-second timeout to `requestGoogleToken()` so the promise no longer hangs indefinitely if the user closes the OAuth popup.
- **`src/utils/googleSlides.ts`** — Added `toApiError()` (sentinel-prefixed errors for 401/403/429) and `withBackoff()` (exponential retry on RATE_LIMITED errors, up to 3 retries, max 32 s delay).
- **`src/utils/googleSlidesTemplate.ts`** — Same `toApiError` + `withBackoff` patterns applied to template copy, GET, and batchUpdate calls.
- **`src/components/GoogleSlidesButton.tsx`** — Catch block now maps sentinel prefixes to user-friendly messages: "session expired / cancelled", "rate limit reached", "permission denied".
- **`e2e/app.spec.ts`** — Added three new error-scenario tests: auth denied → error UI shown; Slides API 429 → rate limit message; auth fail + retry → proceeds to step 3.

---

## [2026-03-09] — Step 1 UX + Google Slides Text Overflow Fix

### Changed
- **`App.tsx` — pinned "Continue to Refine" button at bottom of right panel** — Moved the CTA out of the scrollable content area and into a `shrink-0 mt-auto` footer with a border separator. The right panel's content area is now `overflow-y-auto` so BrandVoicePanel + parsed fields scroll without pushing the button off-screen.
- **`App.tsx` — left panel overflow changed from `overflow-hidden` to `overflow-y-auto`** — Prevents the PDF upload box from being clipped.
- **`PdfUploader.tsx` — removed `absolute inset-0` positioning** — Replaced with normal flow + `min-h-[280px]` so the drop zone doesn't collapse or get cut off.
- **`slideBuilder.ts` — added content length caps** — Expansion paragraphs capped at 350 chars, bullet lists at 5 items x 120 chars, approach/next steps at 6 items x 100 chars. Truncation uses word boundaries with ellipsis.
- **`googleSlidesTemplate.ts` — shape-aware font size reduction** — `ContentShapeInfo` now captures height and width from template shapes. `fillSlideRequests` estimates max characters per shape based on dimensions and font size, truncates text to fit, and reduces font size (down to 8pt minimum) when content exceeds the box capacity. Replaces the removed `autoFitRequest` (which the API rejected as read-only).

### Fixed
- **`App.tsx` — page now scrolls to top when switching between steps** — Added instant `scrollToTop()` via `requestAnimationFrame` to all step transitions, plus a `useEffect` on `currentStep` as a safety net.
- **`ChatInterface.tsx` / `DesignChatInterface.tsx` — stopped `scrollIntoView` from firing on mount** — The chat components' auto-scroll effect was running on initial render, scrolling the entire page down to the chat panel and hiding the loading bar. Now skips the first render and only auto-scrolls after user interaction. Also changed to `block: 'nearest'` so it scrolls within the chat container instead of the whole page.
- **`googleSlidesTemplate.ts` — removed `autoFitRequest` (read-only field error)** — The template builder still called `updateShapeProperties` with `fields: 'autofit'`, which the Google Slides API now rejects as read-only (`Invalid field mask: * includes read-only fields`). Replaced with shape-aware font sizing and text truncation.

---

## [2026-03-06] — Template Design + Direct Population (Clear-and-Fill)

### Changed
- **`googleSlidesTemplate.ts` — replaced placeholder-based content injection with clear-and-fill approach** — Removed `buildReplaceRequests()` (which used `replaceAllText` with `{{PLACEHOLDER}}` markers) and `buildStaticTextCleanupRequests()`. Replaced with auto-discovery of slide roles from placeholder patterns, then direct `deleteText` + `insertText` into content shapes. Content now comes from `buildSlidesFromData()` — the same `SlideData[]` array that powers the preview — ensuring 1:1 parity between what users see and what gets exported.

### Added
- **Auto-discovery engine** — `discoverRole()` scans each template slide's text shapes for `{{PLACEHOLDER}}` patterns and maps them to app slideKeys (title, challenge, solution, approach, investment, nextSteps, etc.).
- **Dual content-shape detection** — `getContentShapes()` identifies fillable text boxes using placeholder patterns (primary) or the two largest text shapes by area (fallback for templates with empty text boxes).
- **Slide duplication for unmatched app slides** — `duplicateAndFillRequests()` uses `duplicateObject` with pre-assigned IDs to clone a suitable template layout for app slides that lack a direct template counterpart (prob1/prob2/prob34 duplicate from challenge layout; ben1/ben2/ben34 from solution layout; additional slides from any content layout).
- **Text style preservation** — Captures `TextRunStyle` (font, size, color, bold) from each content shape before clearing, then reapplies after inserting new content.
- **Slide reordering** — `updateSlidesPosition` ensures final slide order matches the app's `SlideData[]` order.

### Fixed
- User edits (`editedProjectTitle`, `editedProblems`, `editedBenefits`, `customTitles`) now flow through to the exported deck (previously dropped by `buildReplaceRequests`).
- Additional slides added via chat now appear in the exported deck (previously dropped entirely).
- Conditional slides (approach, nextSteps, prob34, ben34) are correctly present or absent in the export, matching the preview.

---

## [2026-03-05] — Keep All Template Slides

### Changed
- **`googleSlidesTemplate.ts` — keep all 18 slides** — Removed `KEEP_INDICES_IN_ORDER`, `DELETE_INDICES`, and all slide deletion/reordering logic. The template is now copied as-is with all slides in their original order. Only static text cleanup and `{{PLACEHOLDER}}` replacement are applied. This means any slide arrangement should be done directly in the Google Slides template.

---

## [2026-03-05] — Static Text Cleanup in Template Builder

### Fixed
- **`googleSlidesTemplate.ts` overlap fix** — Added `buildStaticTextCleanupRequests()` that scans all slides for text elements containing "Lorem ipsum" or "Feedback Date" and deletes them before placeholder replacement. Prevents template sample text from overlapping real content in the output.

---

## [2026-03-05] — Always Route Through Template Builder

### Fixed
- **`GoogleSlidesButton.tsx` routing** — Removed `hasParamountMedia` conditional that routed Paramount proposals to the old dynamic builder (`createGoogleSlidesPresentation` from `googleSlides.ts`), which was not even imported. All presentations now always use `createTemplatePresentation` with template `1Hu53M6vbJRH4XaXJzyo6V30b8vxteN_sv2NO4FQfzHo`.

### Removed
- **`designConfig` prop from `GoogleSlidesButton`** — Only used by the old dynamic builder. Removed from props interface, component destructuring, and call sites in `App.tsx` and `DesignChatInterface.tsx`.

---

## [2026-03-05] — Template-Based Google Slides Builder via Drive API Copy

### Added
- **`googleSlidesTemplate.ts`** — `src/utils/googleSlidesTemplate.ts`; new slide builder that copies a master template presentation (`1Hu53M6vbJRH4XaXJzyo6V30b8vxteN_sv2NO4FQfzHo`) via the Drive API, then populates it with proposal content. Flow: (1) `POST /drive/v3/files/{id}/copy` to duplicate the template, (2) `GET /v1/presentations/{id}` to read all shape objectIds, (3) `POST /v1/presentations/{id}:batchUpdate` to delete 11 unwanted slides (indices 1,2,4,6,7,8,10,13,14,15,16) keeping 7 in order [0,5,3,11,12,9,17], (4) second batchUpdate to replace placeholder text in each shape (inheriting template typography), (5) third batchUpdate to insert client logo on the cover and next-steps closing slides (replacing "LOGO HERE" placeholder). Exports `createTemplatePresentation(data, accessToken): Promise<CreateSlidesResult>`.

### Changed
- **`GoogleSlidesButton.tsx` routing logic** — `src/components/GoogleSlidesButton.tsx`; added import for `createTemplatePresentation`; Paramount deck path (`paramountMedia` present) continues using the original `createGoogleSlidesPresentation` builder; all other decks now route to `createTemplatePresentation`; PROGRESS_STEPS[2] updated to "Copying template...", PROGRESS_STEPS[3] to "Populating slides..."
- **E2E tests updated for template path** — `e2e/app.spec.ts`; added Drive API mock (`**/drive.googleapis.com/**` → `{ id: 'fake-presentation-id' }`); Slides GET mock updated to return 18-slide array matching the template; Slides mocks split by HTTP method: GET → slides array, POST batchUpdate → `{}`, POST create → `{ presentationId }`

---

## [2026-03-05] — Refine Panel Layout, Paramount IP Expansion, autofit Fix

### Fixed
- **`autofitType` field name corrected** — `src/utils/googleSlides.ts`; Google Slides REST API expects `autofitType` (camelCase, lowercase `f`). Previous attempts of `autoFitType` (capital F) and `auto_fit_type` (snake_case) both returned 400. Entry added to `docs/ERRORS.md`.

### Changed
- **Refine step right panel decluttered** — `src/App.tsx`; removed brand color picker from the Refine sidebar entirely. `ChatInterface` wrapper changed from `overflow-hidden` to `overflow-y-auto` so the send button is no longer clipped. `GoogleSlidesButton` now sits directly below the chat with a thin border separator. Removed unused `derivePaletteFromHex` import.

### Added
- **The Masters Tournament added to Paramount IP inventory** — `src/utils/trainingContext.ts`; added to SPORTS section (CBS, April 10–13, 2026, 10M+ viewers, HHI $150K+) and Q2 2026 programming calendar.
- **Open IP Policy directive** — `src/utils/trainingContext.ts`; new section instructs the AI to accept and build with ANY user-specified Paramount/CBS property, show, event, or talent — never reject user-requested IP additions.
- **Iterate prompt accepts any IP** — `src/utils/llmService.ts`; `ITERATE_SYSTEM_PROMPT` updated to always generate slides when a user requests IP-specific slides, never refuse.

---

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [2026-03-04] — Fix Google Slides autofit Read-Only Field Error

### Fixed
- **Removed all `autoFitRequest` calls** — `src/utils/googleSlides.ts`; Google Slides API now treats `autofit` as a read-only field. Any `updateShapeProperties` with `fields: 'autofit'` returns 400 "field mask includes read-only fields." Removed the function and all 20 call sites. Text boxes are already sized generously at creation time.

---

## [2026-03-04] — Fix Gemini 2.5 Flash Empty Response Failures

### Fixed
- **Disabled thinking tokens for structured-JSON calls** — `src/utils/llmService.ts`; added `thinkingConfig: { thinkingBudget: 0 }` to all 5 Gemini API call sites (`analyzeBriefPdf`, `extractBrandVoice`, `generateProposalContent`, `iterateProposalContent`, `iterateDesign`). Gemini 2.5 Flash's thinking mode intermittently consumed the output-token budget, producing empty responses that surfaced as "No content returned from Gemini" errors.
- **Added retry logic for empty LLM responses** — `src/utils/llmService.ts`; all JSON-generation calls now retry up to 2 times on empty responses before throwing, eliminating transient failures.
- **Increased `maxOutputTokens` for proposal generation** — `src/utils/llmService.ts`; bumped from 8192 → 16384 for `generateProposalContent` and 4096 → 8192 for `iterateProposalContent` to prevent truncated JSON on large proposals.

---

## [2026-03-04] — Refine Chatbot Visual Feedback Fix

### Fixed
- **Animation key now covers all bullet content** — `src/components/SlidePreview.tsx`; `chatUpdateVersion` prop forwarded from `SlidePreview` to `SlideCard` so the existing content-hash key (`bullets.join('|').slice(0, 60)`) plus timestamp actually triggers re-animation on chat updates
- **Chat updates now set a timestamp** — `src/App.tsx`; `lastChatUpdate` state added; `onExpansionsUpdated` callback wrapped to call `setLastChatUpdate(Date.now())` alongside `setExpansions`; value passed as `chatUpdateVersion` to `SlidePreview`

### Added
- **"Slides updated" flash banner** — `src/App.tsx`; emerald-colored `AnimatePresence` banner appears for 3 seconds after every chat-driven content update in the Refine step

---

## [2026-03-04] — Documenter Directive Update

### Changed
- **Documenter workflow now includes push step** — `CLAUDE.md`; step 5 added to Documenter Workflow requiring `git push origin main` after every commit; documentation that isn't pushed is treated as incomplete

---

## [2026-03-04] — Refine Tab UX + Paramount Media Sales Deck + Build Fixes

### Changed
- **Removed Slide Style picker from Refine tab** — `src/App.tsx`; the three-button Professional/Agency/Executive toggle is removed; `designStyle` always defaults to `'standard'`; brand color auto-detection from company name remains the primary theming mechanism
- **Prompt box enlarged** — `src/components/ChatInterface.tsx`; textarea `rows={2}` → `rows={3}`; messages scroll area now has a visible thin scrollbar (`scrollbarWidth: 'thin'`)
- **LLM generation upgraded to Paramount media sales output** — `src/utils/llmService.ts`; `SYSTEM_PROMPT` rewritten as a Paramount Advertising Solutions sales executive persona; returns full `paramountMedia` object alongside standard `problemExpansions`/`benefitExpansions`; schema includes IP alignments, integration concepts, talent opportunities, programming calendar, measurement framework, and 3-tier investment structure
- **`PARAMOUNT_TRAINING_CONTEXT` expanded** — `src/utils/trainingContext.ts`; richer Paramount asset inventory and brief-archetype playbook

### Added
- **`ParamountMediaContent` and related types** — `src/types/proposal.ts`; `IPAlignment`, `IntegrationConcept`, `CalendarItem`, `InvestmentTier`, `ParamountMediaContent` interfaces; `paramountMedia?: ParamountMediaContent` field on `ExpandedContent`
- **`'paramount'` color theme** — `src/types/proposal.ts`; added to `ColorTheme` union
- **Paramount-specific slide builders** — `src/utils/googleSlides.ts`; `opportunitySlide`, `ipAlignmentSlide`, `audienceSlide`, `integrationConceptSlide`, `talentSlide`, `programmingCalendarSlide`, `measurementSlide`, `tierInvestmentSlide`; full 13-slide Paramount media deck rendered when `paramountMedia` content is present

### Fixed
- **TypeScript build errors** — `src/utils/googleSlides.ts` (unused `data` param on `measurementSlide`), `src/utils/llmService.ts` (`ParamountMediaContent` cast via `unknown` intermediate)

---

## [2026-03-03] — Structured Brand Voice Profile + Custom Hex Color Picker

### Added
- **`BrandVoiceProfile` typed interface** — `src/types/proposal.ts`; replaces plain-string brand voice with a structured object: `tone: string[]`, `sentenceStyle`, `perspective`, `forbiddenPhrases: string[]`, `preferredVocabulary: string[]`, `ctaStyle`, `proseSummary`; gives the LLM explicit typed constraints instead of a prose guide to interpret
- **`customBrandHex?: string` on `DesignConfig`** — `src/types/proposal.ts`; user-supplied hex color (e.g. `"#FF6600"`) that takes priority over auto-detection and preset themes in the palette resolution chain
- **`derivePaletteFromHex(hex: string): SlidePalette`** — `src/utils/brandColors.ts`; public export of the internal `hexToPalette()` function; converts a single hex to a full 4-stop `SlidePalette` via HSL math; used by both the UI palette preview and the Google Slides renderer
- **`formatBrandVoiceConstraints(profile: BrandVoiceProfile): string`** — `src/utils/llmService.ts`; private helper that serializes a `BrandVoiceProfile` into a structured prompt block with labeled sections (Tone, Sentence style, Perspective, FORBIDDEN phrases, Preferred vocabulary, CTA style); replaces verbatim prose injection with typed, actionable constraints
- **Custom brand color picker** — `src/App.tsx`; native `<input type="color">` in the design panel; selecting a hex immediately renders a 4-swatch palette preview row computed via `derivePaletteFromHex()`; "Reset to auto" clears the override back to company auto-detection
- **Mini SVG slide thumbnails** on design style buttons — `src/App.tsx`; each of the three style buttons now includes an inline 40×25px SVG preview illustrating its key visual signature (white + thick bar, dark + watermark + split panel, near-black + hairlines); accent color in thumbnails tracks the active `customBrandHex`
- **Structured profile display in `BrandVoicePanel`** — `src/components/BrandVoicePanel.tsx`; when trained, the expanded panel shows: `proseSummary` in italic, tone chips (amber), and a two-column "Use / Avoid" vocabulary grid; tone chips also visible in collapsed header

### Changed
- **`BRAND_VOICE_PROMPT`** — `src/utils/llmService.ts`; changed from "return 200–400 word prose guide" to "return JSON with 7 typed fields"; added `responseMimeType: 'application/json'`; `extractBrandVoice()` return type changed from `Promise<string>` to `Promise<BrandVoiceProfile>` with JSON parse + safe defaults validation
- **`generateProposalContent()` brand voice parameter** — `src/utils/llmService.ts`; `brandVoice?: string` → `brandVoice?: BrandVoiceProfile`; injection now calls `formatBrandVoiceConstraints(profile)` instead of embedding prose directly
- **`iterateProposalContent()` brand voice parameter** — `src/utils/llmService.ts`; same change as above; structured constraints maintained across all refinement passes
- **`DESIGN_ITERATE_SYSTEM_PROMPT`** — `src/utils/llmService.ts`; added `"customBrandHex": "#RRGGBB" | null` to the response schema; added instruction to extract hex codes the user mentions; `iterateDesign()` now passes `customBrandHex` through in the returned `DesignConfig`
- **`BrandVoicePanel` props** — `src/components/BrandVoicePanel.tsx`; `brandVoice: string | null` → `BrandVoiceProfile | null`; `onBrandVoiceExtracted` callback updated accordingly; component stores profile as JSON in `localStorage` (was plain string)
- **`ChatInterface` props** — `src/components/ChatInterface.tsx`; `brandVoice?: string` → `BrandVoiceProfile | undefined`; forwarded to `iterateProposalContent()`
- **`brandVoice` state in `App.tsx`** — type changed from `string | null` to `BrandVoiceProfile | null`; `localStorage` initializer now JSON-parses with a backward-compat guard (old plain-string values silently cleared); `onBrandVoiceExtracted` callback checks `voice.tone.length > 0 || voice.proseSummary` before storing
- **Palette resolution in `createGoogleSlidesPresentation()`** — `src/utils/googleSlides.ts`; updated priority chain: 1) `designConfig.customBrandHex` via `derivePaletteFromHex()`, 2) auto-detect by company name via `getBrandPalette()`, 3) preset theme from `PALETTE_MAP`
- **Design style labels** — `src/App.tsx`; "Classic" → "Professional", "Bold" → "Agency" (Executive unchanged)

---

## [2026-03-03] — Approach & Next Steps Slides + Expanded Deck (up to 13 slides)

### Added
- **`approachSlide` (slide 7)** — `src/utils/googleSlides.ts`; numbered horizontal card layout ("OUR APPROACH / How We Deliver"); 3-4 delivery phases with accent-colored step numbers and a thin rule below each; theme-aware (dark bg for bold-agency/minimal); skipped entirely when `approachSteps` is empty
- **`benefitsCombined` (slide 10)** — `src/utils/googleSlides.ts`; two-column split layout for Benefits 3 & 4 (mirrors the `problemsCombined` pattern); skipped when both b3 and b4 are absent; respects `editedBenefits` overrides
- **`nextStepsSlide` (slide 12)** — `src/utils/googleSlides.ts`; two-column numbered layout ("WHAT HAPPENS NEXT / Next Steps"); up to 5 action items; theme-aware; skipped when `nextSteps` is empty
- **`approachSteps` and `nextSteps` on `ExpandedContent`** — `src/types/proposal.ts`; `approachSteps?: string[]` (3-4 methodology phases) and `nextSteps?: string[]` (4-5 post-agreement actions); both optional so existing proposals without them continue to render without these slides
- **`editedBenefits` on `ExpandedContent`** — `src/types/proposal.ts`; `editedBenefits?: [string, string, string, string]`; stores user inline edits for benefit bullets, consumed by `benefitsCombined` and benefit deep-dive slides
- **`approachSteps` and `nextSteps` in LLM generation** — `src/utils/llmService.ts`; `LLMResponse` interface extended with both fields; `SYSTEM_PROMPT` updated with content quality guidelines (problem expansions open with a specific business consequence; benefit expansions lead with a concrete measurable outcome); `generateProposalContent` returns all 4 content arrays
- **`approachSteps` and `nextSteps` in LLM iteration** — `src/utils/llmService.ts`; `ITERATE_SYSTEM_PROMPT` updated with schema for both new fields and instructions to update them only when the user's request relates to methodology/process/next steps; `iterateProposalContent` context prompt now includes current approach and next steps; merge logic uses `??` so LLM-returned updates win while `null` falls back to current values

### Changed
- **Deck expanded from 10 to up to 13 slides** — `src/utils/googleSlides.ts`; new slide order: Cover → Challenge → Prob1 → Prob2 → Prob3&4 → Solution → **Approach** → Ben1 → Ben2 → **Ben3&4** → Investment → **NextSteps** → Close; Approach and NextSteps are conditional (skipped when empty); deck always has at least 10 slides
- **`investmentSlide` visual redesign** — `src/utils/googleSlides.ts`; month breakdown replaced with a row of colored card rectangles (primary bg, accent labels, white values) instead of plain text lines; cards only rendered when month values are present
- **Logo URL upgraded** — `src/utils/googleSlides.ts`; switched from `s2/favicons?sz=128` to `faviconV2?size=256` (Google's newer endpoint); doubles resolution at the same zero-auth cost; removes 302 redirect risk
- **`logoRequests` now uses dynamic slide IDs** — `src/utils/googleSlides.ts`; cover and closing slide IDs resolved from `orderedSlides[0]` and `orderedSlides[last]` instead of hardcoded `slideIds[0]` / `slideIds[9]`; correct regardless of which optional slides are present
- **UI copy updated** — `src/App.tsx`, `src/components/GoogleSlidesButton.tsx`; "10-slide deck" references updated to "Up to 13 slides" and "professional presentation" to reflect variable deck size
- **E2E tests updated** — `e2e/app.spec.ts`; "Creates a 10-slide presentation" assertion updated to match new copy

---

## [2026-03-03] — Slide Design Overhaul & Extended Inline Editing

### Added
- **Brand Color Intelligence** — `src/utils/brandColors.ts` (new); auto-detects client brand palette from `data.client.company` at export time; ~50 major brands mapped (Nike, Starbucks, Google, Salesforce, McKinsey, etc.); derives full `SlidePalette` via HSL math; falls back to manual `colorTheme` for unknown brands
- **Bold Agency layout style** (`designStyle: 'bold-agency'`) — `src/utils/googleSlides.ts`; problem deep-dive slides go dark with large watermark numbers ("01"/"02"); solution slide becomes a left-accent / right-primary split panel; closing slide adds corner ellipses and a 44pt CTA with client company sub-line
- **Executive Minimal layout style** (`designStyle: 'executive-minimal'`) + **`executive-dark` palette** — all 10 slides use dark backgrounds; thick bars replaced with 4k EMU hairline rules; decorative ellipses removed; near-black primary with warm platinum accent
- **Slide Style picker** — `src/App.tsx`; three-button toggle (Classic / Bold / Executive) above the Google Slides export button in the Refine step; updates `designConfig.designStyle` in state
- **`DesignStyle` type** and extended `DesignConfig` — `src/types/proposal.ts`; `designStyle?: 'standard' | 'bold-agency' | 'executive-minimal'`; `disableBrandDetection?: boolean` to opt out of auto brand detection
- **Slide 1 (Cover) title editing** — `src/components/SlidePreview.tsx`, `src/App.tsx`, `src/utils/slideBuilder.ts`, `src/utils/googleSlides.ts`; clicking the project title on slide 1 opens an inline input; saves to `expansions.editedProjectTitle`; applied to both the preview and the exported Google Slides deck
- **Slide 2 (Challenge) bullet editing** — same files; clicking any problem bullet on slide 2 opens an inline textarea; saves to `expansions.editedProblems`; overrides parsed problems in both the preview and the exported deck
- **`editedProjectTitle` and `editedProblems` fields on `ExpandedContent`** — `src/types/proposal.ts`; optional overrides storing user edits for slides 1 and 2

### Changed
- **`EDITABLE_SLIDES` set expanded** — `src/components/SlidePreview.tsx`; was `[3, 4, 7, 8]`; now `[1, 2, 3, 4, 7, 8]`
- **Slide 1 title edit gating** — `src/components/SlidePreview.tsx`; removed `!isTitle` guard from the title edit condition so cover slides can have their title edited inline
- **Design chatbot system prompt updated** — `src/utils/llmService.ts`; now aware of `executive-dark` theme and all three `designStyle` values; returns `designStyle` in JSON response when user implies a layout change
- **`setDesignConfig` setter exposed** — `src/App.tsx`; `designConfig` state now has setter used by the style picker
- **`googleAuth.ts` token persistence** — `src/utils/googleAuth.ts`; access token now saved to `localStorage` (`gis_access_token` + `gis_token_expires_at`) on successful sign-in and restored on module load; users stay signed in across page refreshes for the ~1-hour token lifetime without re-prompting; `revokeToken()` clears both localStorage keys on sign-out

---

## [2026-03-03] — Refine Step UI Overhaul & Sticky Sidebar

### Added
- **Inline slide title editing** — `src/components/SlidePreview.tsx`; clicking the title on editable slides (3, 4, 7, 8 and any AI-added slides) shows a transparent inline `<input>` matching the title font; saves on blur or Enter; wired to new `handleSlideTitleEdit` in `App.tsx` which stores overrides in `expansions.customTitles`
- **"Add more slides" via chat** — `src/utils/llmService.ts`, `src/utils/slideBuilder.ts`, `src/types/proposal.ts`; when the user asks to add slides or make the deck longer, Gemini returns an `additionalSlides` array; new slides are appended after slide 10 and rendered as fully editable cards; bullet and title edits on slides 11+ update `expansions.additionalSlides` in place
- **`AdditionalSlide` interface** — `src/types/proposal.ts`; `{ title: string; bullets: string[] }`
- **`additionalSlides` and `customTitles` fields on `ExpandedContent`** — `src/types/proposal.ts`; both optional; `customTitles` stores per-slide title overrides keyed by slide number

### Changed
- **Right sidebar is now sticky** — `src/App.tsx`; the Refine step right panel uses `lg:sticky lg:top-[8.5rem] lg:h-[calc(100vh-8.5rem)]`; the "Refine Content" label, chat, and export button stay locked in the viewport while the slide preview scrolls freely on the left
- **Design tab removed from Refine step** — `src/App.tsx`; the Content/Design tab toggle and `DesignChatInterface` are removed; the panel now shows a "Refine Content" label and renders `ChatInterface` directly; `sidebarTab` state removed; export button always visible
- **"Disconnected" badge hidden** — `src/components/Header.tsx`; the red "Disconnected" status badge is no longer shown; the "Google Slides Ready" badge only appears when the user is authenticated
- **Flat inline bullet editing** — `src/components/SlidePreview.tsx`; clicking editable bullet text now shows a transparent, borderless `<textarea>` that blends into the slide face instead of a gold-bordered box
- **`ITERATE_SYSTEM_PROMPT` updated** — `src/utils/llmService.ts`; added instructions for generating `additionalSlides`; redirects design change requests instead of slide-count requests; preserves `customTitles` and `additionalSlides` across content refinement passes
- **`buildSlidesFromData` updated** — `src/utils/slideBuilder.ts`; applies `customTitles` overrides to slides 3, 4, 7, 8; appends `additionalSlides` after the closing slide
- **`googleSlides.ts` null-safety** — `src/utils/googleSlides.ts`; guards `insertText` calls for `client.company`, `project.title`, `problems`, `benefits`, and `slideFooter` against empty strings to prevent batch request failures

### Fixed
- **E2E tests updated** — `e2e/app.spec.ts`; "loads with header and connection badge" → "loads with header and New button" (no Disconnected badge); "right sidebar shows Content tab" → "right sidebar shows Refine Content label"

---

## [2026-02-27] — CI E2E Fix: Missing Build-Time Env Vars

### Fixed
- **12 E2E test failures in GitHub Actions** — `.github/workflows/e2e.yml`; the CI build step ran `npm run build` without `VITE_GEMINI_API_KEY` or `VITE_GOOGLE_CLIENT_ID`, so Vite compiled both to `undefined`; guard checks in `llmService.ts` and `googleAuth.ts` threw before any `fetch()` call, preventing Playwright route mocks from intercepting; added dummy env vars (`test-api-key`, `test-client-id.apps.googleusercontent.com`) to the build step — actual values are irrelevant since all API calls are mocked in tests

### Added
- **`.env.example`** — documents required `VITE_GEMINI_API_KEY` and `VITE_GOOGLE_CLIENT_ID` environment variables for new contributors

---

## [2026-02-27] — Brand Voice Training & Proposal Playbook

### Added
- **`BrandVoicePanel` component** — `src/components/BrandVoicePanel.tsx`; collapsible panel on Step 1 right side; accepts multiple PDF uploads; shows "Trained on X docs" badge when active; persists extracted voice guide in `localStorage` (`rfp_brand_voice` + `rfp_brand_voice_count`) so training survives page refreshes; includes staging area, drag-and-drop, 3-stage loading animation, voice preview snippet, and "Clear training" / "Retrain" actions
- **`extractBrandVoice(files: File[])` LLM function** — `src/utils/llmService.ts`; accepts multiple PDFs; routes small batches (< 15 MB total) via inline_data, larger batches via Gemini Files API; sends all files in a single Gemini call with `BRAND_VOICE_PROMPT`; cleans up uploaded URIs in finally block; returns a 200–400 word plain-prose brand voice guide
- **`PARAMOUNT_TRAINING_CONTEXT` constant** — `src/utils/trainingContext.ts`; pre-seeded playbook derived from 5 real Paramount documents (Dunkin' 2026 Content Day proposal, Under Armour Q1'26 GRAMMYs proposal, U.S. Army FY26 HPP brief, T-Mobile FY25/26 Upfront brief, Under Armour Q4 Flag Football brief); covers 5 brief archetypes (QSR/Entertainment, Sports/Performance, Government/Recruitment, Telecom/Tech Lifestyle, Women's Sport/Cultural Moment) each with incoming brief signals and Paramount's winning response approach; injected into every generation call automatically

### Changed
- **`generateProposalContent()` system prompt** — `src/utils/llmService.ts`; now injects `PARAMOUNT_TRAINING_CONTEXT` (always-on) and optional `brandVoice` guide before the existing `SYSTEM_PROMPT`; accepts new `brandVoice?: string` parameter
- **`iterateProposalContent()` system prompt** — `src/utils/llmService.ts`; same pattern as above — injects training context and optional brand voice into `ITERATE_SYSTEM_PROMPT`; accepts new `brandVoice?: string` parameter
- **`ChatInterface` props** — `src/components/ChatInterface.tsx`; added `brandVoice?: string` prop; forwarded to `iterateProposalContent()` calls; added to `useCallback` dependency array
- **`App.tsx` Step 1 right panel** — `src/App.tsx`; added `brandVoice` state initialised from `localStorage`; renders `<BrandVoicePanel>` above the brief preview section; passes `brandVoice` to `generateProposalContent()` (initial generation + retry) and to `<ChatInterface>`

---

## [2026-02-27] — PDF Robustness & E2E Fixes

### Added
- **Gemini Files API path for large PDFs** — `src/utils/llmService.ts`; PDFs > 15MB now upload via `POST /upload/v1beta/files` (multipart) instead of base64 inline_data; the inference request references the file by `file_uri`; uploaded files are deleted after extraction (non-blocking); files auto-expire after 48h regardless
- **JSON retry path for truncated Gemini responses** — `src/utils/llmService.ts`; if `JSON.parse` fails on the first response (e.g. output token limit truncation), retries once without `responseMimeType: 'application/json'` and strips markdown fences via `extractJsonFromText()`; resolved TMUS PDF (2.5 MB) silently failing with only 157 output tokens
- **`uploadToFilesApi()` helper** — `src/utils/llmService.ts`; constructs multipart/related body with metadata + raw PDF binary; returns `file_uri` string
- **`deleteFilesApiFile()` helper** — `src/utils/llmService.ts`; fire-and-forget `DELETE` call; errors silently ignored
- **`extractJsonFromText()` helper** — `src/utils/llmService.ts`; strips ````json … ```` fences from model output before `JSON.parse`
- **`MAX_PDF_SIZE` constant exported** — `src/utils/llmService.ts`; 50 MB hard limit (Gemini's ceiling); consumed by `PdfUploader`
- **Vision API diagnostic script** — `test-vision.mjs` at project root; standalone Node.js tool that calls Gemini 2.5 Flash directly with the 4 Paramount PDFs; prints extracted fields, brand notes, and a quality score (N/5); confirmed Gemini reads actual photographs (flag football athletes, soldiers) not just text

### Changed
- **`analyzeBriefPdf()` size routing** — `src/utils/llmService.ts`; > 50 MB throws immediately; > 15 MB takes Files API path; ≤ 15 MB uses existing inline_data path
- **`maxOutputTokens` increased to 8192** — `src/utils/llmService.ts`; was 4096; TMUS PDF required more output tokens for complete JSON
- **`PdfUploader` validates file size** — `src/components/PdfUploader.tsx`; added 50 MB check using imported `MAX_PDF_SIZE`; shows user-friendly error message before calling Gemini
- **E2E test helpers updated** — `e2e/app.spec.ts`; `goToIterateStep` and `goToShareStep` now wait for the ChatInterface greeting bubble (`"Hi! I've reviewed the brief for"`) instead of the stale `"Ask for changes"` heading text that was removed in the sidebar redesign
- **E2E connection badge test fixed** — `e2e/app.spec.ts`; `loads with header and connection badge` now matches `/Google Slides Ready|Disconnected/` regex to handle CI environments where OAuth is unavailable
- **E2E sidebar headings test updated** — `e2e/app.spec.ts`; `right sidebar shows Content tab and chat input` replaces the stale `"Refine with AI"` / `"Ask for changes"` heading assertions with `Content` tab button and `textarea[placeholder*="Ask for changes"]`

---

## [2026-02-26] — Workflow Audit

### Added
- **Design theme picker in Refine step** — `src/App.tsx`; Content/Design tab toggle in the right sidebar lets users switch between content refinement chat and design theme chat; `DesignChatInterface` now integrated and functional
- **`DesignChatInterface` component** — `src/components/DesignChatInterface.tsx`; Gemini-powered chat for selecting color themes; parses model response to extract `{ reply, designConfig }` JSON; embeds `GoogleSlidesButton` for one-click export; 6 suggested prompts; shows current theme badge (Navy & Gold / Slate & Blue / Forest Green)
- **`ColorTheme` + `DesignConfig` types** — `src/types/proposal.ts`; `ColorTheme = 'navy-gold' | 'slate-blue' | 'forest-green'`; `DesignConfig = { colorTheme: ColorTheme }`; `DEFAULT_DESIGN_CONFIG` exported; `designConfig` state added to `App.tsx`
- **`iterateDesign()` LLM function** — `src/utils/llmService.ts`; accepts `currentDesignConfig`, `userInstruction`, and `history`; sends system prompt that maps natural language to one of three themes; returns `{ reply: string; designConfig?: DesignConfig }` via Gemini JSON mode (temperature 0.5)
- **Palette theming in Google Slides** — `src/utils/googleSlides.ts`; added `SlidePalette` interface (`primary`, `primaryLighter`, `primaryDarker`, `accent` — all `RgbColor`) and `PALETTE_MAP: Record<ColorTheme, SlidePalette>` with three theme entries (navy-gold, slate-blue, forest-green); all 7 slide-builder functions (`titleSlide`, `challengeSlide`, `problemDeepDive`, `problemsCombined`, `solutionSlide`, `investmentSlide`, `closingSlide`) now accept `palette: SlidePalette`; `createGoogleSlidesPresentation` resolves palette from optional `designConfig` at call site
- **`ThemeTokens` + `THEME_MAP` in SlidePreview** — `src/components/SlidePreview.tsx`; `ThemeTokens` interface maps 6 Tailwind slot names (`accentBar`, `badgeBg`, `badgeText`, `title`, `subtitle`, `bullet`) to class strings; `THEME_MAP` covers all three `ColorTheme` values; `SlideCard` accepts `theme?: ThemeTokens` so HTML preview and Google Slides export stay visually in sync
- **Error state + retry for AI generation** — `src/App.tsx`; if Gemini content generation fails, shows error panel with retry and back-to-draft buttons instead of infinite skeleton
- **`slideBuilder.ts` utility** — `src/utils/slideBuilder.ts`; `buildSlidesFromData()` extracted from `SlidePreview.tsx` to fix HMR Fast Refresh warnings
- **Real Google auth state** — `src/App.tsx`; Header `isConnected` badge now reflects actual OAuth state via `getAuthState()` polling

### Changed
- **Removed T-Mobile demo deck as fallback** — `src/components/SlidePreview.tsx`; no longer imports `TMOBILE_PARAMOUNT_SLIDES`; shows clean empty state when no brief data exists
- **Cleaned export fallback defaults** — `src/components/GoogleSlidesButton.tsx`; `buildProposalData()` now uses empty strings instead of `'Client'`, `'Company'`, `'$0'`, `'client@example.com'` so missing fields are omitted from exported decks
- **Cleaned preview fallback text** — `src/utils/slideBuilder.ts`; replaced `'Digital Transformation'`, `'TBD'`, `'Problem 1'` etc. with `'—'` or conditional omission
- **Replaced Starbucks placeholder** — `src/components/BriefEditor.tsx`; textarea placeholder now shows generic format guide instead of branded Starbucks example
- **Header wired up** — `src/App.tsx`; `onNew={handleReset}` connected; non-functional Templates/History buttons removed
- **Step navigation guarded** — `src/App.tsx`; `handleStepClick` now prevents forward jumps to incomplete steps
- **Chat history capped** — `src/utils/llmService.ts`; `iterateProposalContent` and `iterateDesign` now send only the last 10 messages to Gemini
- **Step flow collapsed to 3** — `src/types/proposal.ts`; steps are now Draft/Refine/Export (removed standalone Design step)

### Removed
- 9 orphaned legacy files: `DocumentPreview.tsx`, `ContentEditor.tsx`, `StructuredForm.tsx`, `TranscriptInput.tsx`, `InputModeSelector.tsx`, `Layout.tsx`, `GammaPromptGenerator.tsx`, `ProposalReview.tsx`, `useProposalState.ts`
- Non-functional Templates and History header buttons

---

## [2026-02-26] — Previous

### Added
- **Gemini multimodal PDF analysis** — `src/utils/llmService.ts`; new `analyzeBriefPdf(file: File): Promise<string>` function uses Gemini's `inline_data` multimodal API to send the entire PDF as base64-encoded data; Gemini Vision reads every page (text, images, logos, brand colors) and returns structured brief text covering client info, project details, problems, benefits, and brand visual notes; new `fileToBase64()` helper handles the File → base64 conversion
- **4-step app flow: Draft → Iteration → Design → Share** — `src/App.tsx` fully restructured; `ProgressStepper.tsx` now wired in with a fixed step-nav bar below the header
- **Real PDF extraction via Gemini Vision** — `src/components/PdfUploader.tsx` now calls `analyzeBriefPdf()` directly instead of a fake processing animation; three real loading stages: "Uploading to Gemini" → "Extracting structure & content" → "Building brief from PDF"; extracted text feeds into `useBriefParser` automatically via `onTextExtracted` callback prop; shows actual error messages on failure instead of silent failure
- **`ChatInterface` component** — `src/components/ChatInterface.tsx` (new file); Step 2 chatbot for multi-turn AI content iteration; users request tone/language/focus changes; Gemini refines `problemExpansions` + `benefitExpansions` inline with conversation history; suggested prompt chips pre-populate common requests; fires `onExpansionsUpdated` callback
- **`iterateProposalContent()` LLM function** — `src/utils/llmService.ts`; accepts brief, parsed data, current expansions, instruction, and conversation history; returns `{reply, updatedExpansions?}`; also exports new `ChatMessage` interface for multi-turn history
- **Live slide preview with real data (Step 3)** — `src/components/SlidePreview.tsx` updated; `data?: Partial<ProposalData>` prop added; `buildSlidesFromData()` generates 10 slide cards from real proposal content; falls back to T-Mobile static demo when no real data is present
- **Outlook mailto share (Step 4)** — share step renders `mailto:` link pre-filled with client email, subject `RFP: {project}`, and body containing Google Slides URL; no API integration required
- **`onSuccess` callback on `GoogleSlidesButton`** — triggers step advance to Share on successful slide creation; `preGeneratedContent` prop skips LLM re-call when chatbot already generated expansions

### Changed
- **`PdfUploader` replaces fake animation with real Gemini Vision extraction** — `src/components/PdfUploader.tsx`; previously showed a fake progress animation that never read the file; now calls `analyzeBriefPdf()` and surfaces real loading stages and error messages; `onTextExtracted` callback prop added
- **`SlidePreview` accepts real proposal data** — `src/components/SlidePreview.tsx`; updated to accept `data?: Partial<ProposalData>` prop; previously rendered only static content
- **`GoogleSlidesButton` extended with new props** — `src/components/GoogleSlidesButton.tsx`; added `preGeneratedContent` (skips redundant LLM call when ChatInterface already ran) and `onSuccess` callback (advances to Share step on completion)
- **`Step` type updated** — `src/types/proposal.ts`; `Step` union type changed from previous values to `'draft' | 'iterate' | 'design' | 'share'`; `STEPS` array updated accordingly
- **`useProposalState` hook updated** — `src/hooks/useProposalState.ts`; minor updates to align with new step types and multi-step flow

---

## [Unreleased]

### Changed
- **Cover slide redesigned: right-panel split layout** — `src/utils/googleSlides.ts`
  - Removed decorative `ELLIPSE` blobs from cover and closing slides
  - Cover slide split into left content zone (65%) and branded right panel (35%, `NAVY_LIGHTER`)
  - Thin orange vertical accent line divides the two zones
  - Client and Paramount logos now live inside the right panel: stacked vertically, centered, with labels (`STARBUCKS` / `PARAMOUNT`) and an orange horizontal rule between them — drawn in Phase 2 as structural elements, logos inserted in Phase 3
  - All text content constrained to `CONTENT_W` (left 65%) so it never bleeds into the panel
  - Closing slide: ellipse removed; two thin orange horizontal rules now bracket the CTA text
  - New module-level layout constants: `PANEL_X`, `PANEL_W`, `CONTENT_W`, `LOGO_SIZE`, `LOGO_X`, `COVER_CLABEL_Y`, `COVER_CLOGO_Y`, `COVER_DIV_Y`, `COVER_PLABEL_Y`, `COVER_PLOGO_Y` — keeps Phase 2 labels/divider and Phase 3 images pixel-aligned
- **Switched LLM from OpenAI GPT-4o to Google Gemini 2.5 Flash** — `src/utils/llmService.ts` now calls the Gemini REST API instead of OpenAI; uses `responseMimeType: "application/json"` for native JSON output; env var changed from `VITE_OPENAI_API_KEY` to `VITE_GEMINI_API_KEY`; `src/vite-env.d.ts` updated accordingly
- **Removed TEXT_AUTOFIT from Google Slides** — Google Slides API no longer supports `autofitType: 'TEXT_AUTOFIT'`; removed the `autofit()` helper and all 23 call sites in `src/utils/googleSlides.ts` to fix `400 Autofit types other than NONE are not supported` error

### Added
- **E2E testing with Playwright** — 15 tests covering app shell, input mode toggle, brief editor, document preview, Google Slides button, and PDF uploader
  - `e2e/app.spec.ts` — test suite
  - `playwright.config.ts` — Playwright configuration (Chromium, Vite preview server)
  - `npm test`, `npm run test:ui`, `npm run test:headed` scripts
- **GitHub Actions CI** — `.github/workflows/e2e.yml` runs E2E tests on every push and PR to main
  - Uploads Playwright HTML report and failure traces as artifacts

### Fixed
- **Google Slides `updateShapeProperties` autofit field mask** — Changed `fields: 'autofit'` to `fields: 'autofit.autofitType'` in `googleSlides.ts` to avoid including read-only subfields (`fontScale`, `lineSpacingReduction`) that caused `400 Invalid field mask: * includes read-only fields` on batchUpdate request #19
- **App.tsx** — Removed stale `setGeneratedUrl(null)` call in `handleFileUpload` that caused a build failure
- **Paramount branding for Google Slides export**
  - Brand palette switched from navy/gold/cream to Paramount navy (`#0D1F40`) + orange (`#F27321`)
  - Fonts updated: headings use Montserrat (Bold), body uses Inter (replaces Playfair Display + DM Sans)
  - Agency name changed from "Look After You" to "Paramount" on cover and closing slides
- **Auto-fetched brand logos** on cover and closing slides via Clearbit Logo API
  - Paramount logo on cover (top-right) and closing (centered)
  - Client logo on cover (bottom-right), fetched by `companyDomain`
  - Logo insertion is best-effort — failures don't break the presentation
- **`companyDomain` field** added to `ClientInfo` type and both intake forms (StructuredForm, TranscriptInput)
- **Text autofit** (`TEXT_AUTOFIT`) applied to every text box across all slides — text auto-shrinks to fit containers

### Fixed
- **Slide text overlap** — `problemDeepDive` headline box enlarged (700K → 1M EMU), font reduced (30pt → 24pt), body pushed down (y 1.5M → 1.65M EMU); same fix applied to `problemsCombined` two-column layout

### Added (prior)
- **Google Slides API integration** — replaces manual Gamma.app workflow
  - `src/utils/googleAuth.ts` — OAuth 2.0 token management via Google Identity Services (GIS)
  - `src/utils/googleSlides.ts` — Google Slides REST API client using two-phase batchUpdate approach
  - `src/components/GoogleSlidesButton.tsx` — self-contained button with 5-step animated progress, OAuth popup, and "Open in Google Slides" success link
  - `VITE_GOOGLE_CLIENT_ID` environment variable for OAuth Client ID
  - GIS library script tag added to `index.html`
  - `window.google` type declarations added to `src/vite-env.d.ts`
- Documenter sub-agent system for automatic change tracking
- Error handling utilities for local development - `src/utils/errorHandler.ts`
- ErrorBoundary component for React error catching - `src/components/ErrorBoundary.tsx`
- DevTools floating panel for error viewing - `src/components/DevTools.tsx`
- Global error handlers in main.tsx (window.onerror, unhandledrejection)
- Internal documentation structure (`docs/`)
- Documenter directive - `directives/documenter.md`
- **GammaPromptGenerator component** - `src/components/GammaPromptGenerator.tsx`
  - Generates tailored Gamma presentation prompts from client brief data
  - Smart prompt builder that responds to client's budget, challenges, and goals
  - Includes creative strategies (social media, video storytelling, experiential marketing, etc.)
  - Copy-to-clipboard functionality for easy transfer to gamma.app
  - Expandable UI with preview of generated prompt
  - Added alongside GenerateButton with "or" divider in App.tsx
- **LLM Service** - `src/utils/llmService.ts` - personalized proposal content generation (originally OpenAI GPT-4o, now Gemini 2.0 Flash)
- `VITE_GEMINI_API_KEY` environment variable for Gemini API authentication (previously `VITE_OPENAI_API_KEY`)

### Changed
- **App.tsx** — Replaced `GammaPromptGenerator` with `GoogleSlidesButton` (direct API integration replaces manual copy-paste Gamma workflow); added `briefText` prop forwarding
- **GammaPromptGenerator.tsx** - Replaced generic prompt with coffee-themed 10-slide creative agency deck template branded for "Look After You"
  - Agency identity: Prompt now explicitly presents as "Look After You" agency
  - Uses coffee metaphors throughout (brew, blend, roast, espresso shot, pour-over, etc.)
  - Fixed 10-slide structure: Executive Brew, The Grind, Look After You's Strategic Approach, Customer Journey Roast, Data Espresso Shot, Personalization Pour-Over, Brew Plan, Investment Recipe, Flavor Profile, Why Look After You
  - Injects client brief data (company, contact, timeline, budget, problems, benefits) dynamically
  - Removed random creative strategies in favor of structured coffee-themed approach
- **useBriefParser.ts** - Extended parser to extract `platformCosts`, `monthOneInvestment`, `monthTwoInvestment`, `monthThreeInvestment` from brief text
- **BriefEditor.tsx** - Updated placeholder example with Starbucks demo brief including all pricing fields
- Updated App.tsx to include ErrorBoundary wrapper and DevTools panel
- Updated main.tsx with global error capturing
- **App.tsx** - Simplified to single generation path (Google Slides only); removed PandaDoc flow, "or" divider, and PandaDoc toasts

### Fixed
- **vite-env.d.ts** — Removed invalid `declare global` wrapper; ambient `.d.ts` files augment `Window` directly. Resolved 5× TS2339 TypeScript errors on `window.google`.
- **vite.config.ts** — Added `port: 5173, strictPort: true` to prevent OAuth `redirect_uri_mismatch` errors caused by the dev server silently bumping to a different port when 5173 is occupied.

### Removed
- **PandaDoc integration fully removed** — `src/utils/pandadoc.ts`, `src/components/GenerateButton.tsx`, `src/components/SuccessScreen.tsx` deleted; PandaDoc imports, state, `handleGenerate`, `buildProposalData`, proxy config, and env vars all stripped; Google Slides is now the sole presentation output
- **GammaPromptGenerator** removed from `App.tsx` (component file retained but no longer rendered; replaced by `GoogleSlidesButton`)

---

## How This Works

The Documenter sub-agent automatically reviews changes after each modification and logs them here. Each entry includes:
- **What changed**: Component, file, or feature affected
- **Why it changed**: Brief rationale
- **Impact**: Any side effects or dependencies affected
