# Error Reference Guide

A living document of errors encountered during development and their solutions.

---

## How to Use This Document

When you encounter an error:
1. Search this document for similar errors
2. If found, follow the documented solution
3. If not found, debug and add the solution here

---

## LLM / Chat Iteration Errors

### Inline edit (click-to-edit) on a showcase or generic slide disappears when you click off

**Symptom:** On a `paramount-showcase` or `generic` deck the user clicks a bullet or title in the Step 2 preview, types a change, presses Enter or clicks outside the slide. The edit appears briefly while the input is focused, then reverts back to the original text the next render.

**Cause:** `App.tsx`'s `handleSlideEdit` / `handleSlideTitleEdit` only had branches for paramount-rfp slideKeys (`challenge`, `solution`, `prob1`, `nextSteps`, …) plus `additional_*`. Showcase / generic slideKeys are LLM-generated strings like `south_park`, `comedy_overview`, etc., so the handler hit a fallthrough `return` and never called `setExpansions`. For titles, `customTitles[slideKey]` got written but `buildSlidesFromData` reads titles directly from `showcaseContent.slides[i].title` / `flexibleSlides[i].title` and ignored `customTitles` on those code paths.

**Solution:** Both handlers in `App.tsx` now route by `deckType` before falling through to the paramount-rfp branches. Showcase/generic content edits mutate the slide arrays in `showcaseContent.slides` / `flexibleSlides`. `buildSlidesFromData` also now reads `customTitles[slideKey]` for the two hardcoded showcase slideKeys (`audience_insights`, `measurement`) and for `additional_*` titles, so title-edit fallbacks display correctly. See `src/App.tsx` (`handleSlideEdit`, `handleSlideTitleEdit`) and `src/utils/slideBuilder.ts` (`buildSlidesFromData`).

**Diagnostic tip:** Add a `console.log` at the top of `handleSlideEdit` with `slideKey`, `bulletIndex`, `newText`, `expansions.deckType` — if the log fires but the slide doesn't update, the handler isn't matching the slideKey for that deck type.

---

### `Failed to parse iterate response as JSON` (or chat says "done" but showcase/generic deck preview doesn't change)

**Symptom:** On a `paramount-showcase` or `generic` deck, the Step 2 chat either:
- throws `Error: Failed to parse iterate response as JSON` at `llmService.ts` (the `JSON.parse(content)` line in `iterateProposalContent`), or
- silently succeeds (AI says "Updated slide 4 to N bullets") but the slide preview never changes.

**Cause:** The iterate response schema only had `updatedContent` (which carries paramount-rfp fields like `culturalShift`, `realProblem`, …). For `paramount-showcase` decks the slides live in `currentExpansions.showcaseContent.slides`, and for `generic` decks they live in `currentExpansions.flexibleSlides`. There was no on-schema slot for either, so the LLM improvised — sometimes into a valid but unknown top-level field (silently ignored by the merge code), sometimes into structurally invalid JSON (parse failure).

**Solution:** The response schema now includes `updatedShowcaseContent` and `updatedFlexibleSlides` (both with `slideKey` per slide). `ITERATE_SYSTEM_PROMPT` has "DECK-SPECIFIC RULES" telling the model which slot to use per `activeDeckType`. The merge logic in `iterateProposalContent` writes those values into `output.updatedExpansions.showcaseContent` / `output.updatedExpansions.flexibleSlides` via the `mergeFlexibleSlidesByKey` helper — these are the exact fields `slideBuilder.ts` reads when building the preview.

**Diagnostic tip:** If chat edits don't show, log `parsed` after `JSON.parse(content)` and inspect the top-level keys. If you see `showcaseContent`, `flexibleSlides`, or any other off-schema key, the prompt and merge logic for that deck type are out of sync. Also check `activeDeckType` and whether `currentExpansions.showcaseContent` / `.flexibleSlides` exist on the deck you're iterating.

---

### Chat prompts appear to work but slide preview never changes

**Symptom:** User types in the Step 2 chat (e.g. "make slide 3 more concise", "tighten everything"). The AI replies with a confirmation message, the "Writing" indicator appears, but the slide cards in the preview do not visibly update.

**Cause:** The `ITERATE_SYSTEM_PROMPT` response schema only included `problemExpansions` and `benefitExpansions`. These fields are used by the legacy content-review UI but are **not rendered in the Paramount persuasion deck**. The actual deck slides are driven by `culturalShift`, `realProblem`, `costOfInaction`, `coreInsight`, `proofPoints`, `customPlan`, `approachSteps`, and `nextSteps`. Any chat edit silently updated invisible fields.

**Solution:** Ensure `ITERATE_SYSTEM_PROMPT` lists a slide map and the response schema covers all slide-driving fields. `iterateProposalContent` must also pass current values for all fields as context (so the LLM knows what to edit) and merge all returned fields back into `ExpandedContent`. See `src/utils/llmService.ts` — `ITERATE_SYSTEM_PROMPT` and the `uc` merge block.

**Diagnostic tip:** If chat edits seem to have no effect, log `output.updatedExpansions` after the iterate call and check which fields are non-null. Cross-reference with `slideBuilder.ts` to confirm those fields actually drive any slide cards.

---

### E2E tests: `goToShareStep` times out waiting for "Presentation created!"

**Symptom:** Tests that call `goToShareStep()` fail at `expect(page.getByText('Presentation created!')).toBeVisible()`.

**Cause (1):** Drive mock uses `'https://www.googleapis.com/drive/**'` which only matches paths starting with `/drive/`. The pptx-upload path is `https://www.googleapis.com/upload/drive/v3/files` (note `/upload/` prefix). The mock never fires, the real request fails or is blocked, and `onSuccess` is never called.

**Solution:** Use `'https://www.googleapis.com/**drive**'` as the Playwright route pattern — `**` matches across slashes so it catches both `/drive/...` and `/upload/drive/...`.

**Cause (2):** Mock response returns `{ id: 'fake-presentation-id' }` without `webViewLink`. `uploadPptxToDrive` returns `result.webViewLink` which is `undefined`, so `onSuccess(undefined)` is called. `slidesUrl` becomes falsy and the share screen's "Open in Google Slides" link never renders — but more critically `handleSlidesSuccess` still calls `setCurrentStep('share')` so the heading appears. **However**, if `onSuccess` is not called at all (e.g. because the mock doesn't match), the entire step 3 transition never happens.

**Solution:** Always include `webViewLink` in the Drive mock response: `{ id: 'fake-presentation-id', webViewLink: 'https://docs.google.com/presentation/d/fake-presentation-id/edit' }`.

---

## Build / CI Errors

### `TS2307: Cannot find module 'pptxgenjs' or its corresponding type declarations`
**Error (Vercel / GitHub Actions):**
```
src/utils/pptxExport.ts(19,21): error TS2307: Cannot find module 'pptxgenjs' or its corresponding type declarations.
Error: Process completed with exit code 2.
```
Local `npm run build` succeeds; CI fails.

**Cause:** `src/utils/pptxExport.ts` imports `pptxgenjs`, but the package was never declared in `package.json`. The local `node_modules` happened to have it (likely from an interactive `npm install pptxgenjs` that ran without `--save`), so local builds pass. CI does a fresh `npm install` driven by `package.json` / `package-lock.json`, which omits the package, and `tsc` then can't resolve the import.

**Solution:** Declare the dependency. `npm install pptxgenjs@^4.0.1 --save-exact=false` (or hand-edit `package.json`) so both `package.json` and `package-lock.json` capture it, then commit both. CI's next `npm install` will fetch it and `tsc` will be happy.

**Diagnostic tip:** When `tsc` says `TS2307` for a package that "obviously" exists locally, run `git show origin/main:package.json | grep <pkg>` — if it's missing there, that's the entire bug. Always declare deps via `npm install <pkg>` (not by manually dropping things into `node_modules`).

---

## Express / API Server Errors

### PDF upload returns 500 / `GEMINI_500: Internal server error` (PayloadTooLargeError masked)
**Error (browser console):**
```
:5173/api/gemini/generate-content:1  Failed to load resource: the server responded with a status of 500 (Internal Server Error)
[fetchWithRetry] 500 on /api/gemini/generate-content — retrying in 1s (attempt 1/3)
...
[PdfUploader] Extraction failed: FetchRetryExhaustedError: GEMINI_500: Internal server error
```
Text-only prompting (no PDF) works fine.

**Cause:** Two compounding bugs:
1. `server/routes/gemini.ts` mounted `express.json({ limit: '2mb' })` on `/generate-content`. PDFs up to 15 MB are sent inline as base64 (~1.33× overhead → JSON bodies up to ~20 MB), so any PDF over ~1.4 MB tripped `PayloadTooLargeError` before the handler ran.
2. The global error handler in `server/index.ts` always returned `res.status(500).json(...)`, ignoring `err.status`/`err.statusCode`. The real 413 was therefore masked as a 500, which `fetchWithRetry` (correctly) retries — exhausting all retries before failing.

**Solution:**
- Bump the `/generate-content` body-parser limit to `25mb` to cover the inline-PDF threshold (`LARGE_PDF_THRESHOLD = 15 MB` in `src/utils/llmService.ts`).
- Make the global error handler respect `err.status`/`err.statusCode` and surface 413/4xx with their real status and a descriptive message.

**Diagnostic tip:** When `/api/gemini/generate-content` returns 500 only for PDF requests, check whether `req.headers['content-length']` exceeds the route's `express.json` limit. The body-parser error has `err.type === 'entity.too.large'`, `err.status === 413`, and `err.length`/`err.limit` populated — none of which surface to the client unless the error handler preserves them.

---

## Vercel Deployment Errors

### API routes return 404 on Vercel (`/api/gemini/generate-content` not found)
**Error:** `Failed to load resource: the server responded with a status of 404` for all `/api/*` endpoints on the Vercel deployment.

**Cause:** The Express backend (`server/index.ts`, port 3001) is a standalone Node.js server that only runs in local dev via `npm run dev:server`. Vercel only deploys the static Vite build (`dist/`). The Vite dev proxy (`/api -> localhost:3001`) has no equivalent in production.

**Solution:** Created Vercel Serverless Functions in the `api/` directory that mirror every Express route:
- `api/gemini/generate-content.ts` — Gemini proxy
- `api/gemini/upload-file.ts` — Files API upload
- `api/gemini/files/[fileId].ts` — Files API delete
- `api/brand-voice/index.ts` — Brand voice CRUD
- `api/proposals/index.ts` — Proposals list/create
- `api/proposals/[id].ts` — Proposals read/update/delete
- `api/health.ts` — Health check

**Required Vercel env vars:** `GEMINI_API_KEY`, `DATABASE_URL`, `VITE_GOOGLE_CLIENT_ID`, `FRONTEND_ORIGIN`.

**Fix applied:** Added `vercel.json`, `api/` directory with all serverless functions, and `@vercel/node` dev dependency.

---

## Google Slides / OAuth Errors

### Slide text cut off with "..." — bullets and body text truncated mid-sentence
**Error:** Generated Google Slides presentations show "..." at the end of bullet points and body text, cutting off content mid-sentence. Visible on content slides, cost cards, how-it-works steps, and ROI tier inclusions.

**Cause:** `truncateBullets()` and `truncate()` in `googleSlides.ts` hard-cut text at fixed character limits (80-200 chars depending on slide type) and appended an ellipsis `…` — BEFORE attempting any font size reduction. The `adaptiveFontSize()` system existed but was only applied to title/heading text, never to body/bullet text.

**Solution:** Replaced all `truncateBullets()` / `truncate()` calls in slide builder functions with two new adaptive helpers:
1. `fitBullets(bullets, width, height, targetPt, minPt, maxBullets)` — tries full untruncated text at target font, steps down by 1pt to a 10pt floor, only truncates individual bullets at the minimum font size if text still overflows. Returns `{ text, fontSize }`.
2. `fitText(text, width, height, targetPt, minPt)` — same approach for single text blocks (cost cards, step descriptions, integration mechanics).

Each slide builder function now passes its actual text box EMU dimensions to these helpers, so font reduction is box-aware. Preview limits in `slideBuilder.ts` also raised (120→300 chars, 100→250 for steps) to avoid clipping in the in-app preview.

---

### Programmatic slides have overlapping text — headings overflow into body content
**Error:** Generated Google Slides presentations show heading text overlapping with bullet content below. Visible on content slides with long LLM-generated titles (e.g. "Live Sports: The Ultimate Reach Vehicle") and on the title slide when the project title wraps to 2+ lines.

**Cause:** Text boxes are created with fixed EMU coordinates and fixed font sizes. Google Slides API no longer supports `autofit` (TEXT_AUTOFIT is read-only, returns 400). When text wraps to more lines than the box can hold, it overflows visually and collides with elements below. The heading box in `additionalContentSlide` was only 600,000 EMU tall -- barely enough for one line at 36pt (640,000 EMU per line). The body started only 100,000 EMU below the heading box bottom.

**Solution:** Added adaptive font sizing system to `googleSlides.ts`:
1. `estimateMaxChars(h, w, fontSize)` calculates character capacity of a text box
2. `adaptiveFontSize(text, h, w, targetPt, minPt)` steps down font size until text fits
3. Heading boxes made taller (600k -> 1.2M EMU), body pushed down (1.1M -> 1.7M)
4. Title slide: project title box 500k -> 800k, rule/date moved 320k down
5. `paragraphSpacing()` adds lineSpacing and spaceBelow for bullet readability

**Fix applied:** All changes in `src/utils/googleSlides.ts`. Affects `titleSlide()`, `additionalContentSlide()`, and the utility functions section.

---

### Template output has overlapping text — static "Lorem ipsum" text boxes
**Error:** Generated Google Slides presentations show overlapping text on Benefits, Investment, and other slides. Template sample text ("Lorem ipsum dolor sit amet...") renders on top of the replaced placeholder content.

**Cause:** The template contains two layers of text boxes on many slides: `{{PLACEHOLDER}}` marker boxes (used by code) and static sample text boxes (design mockup content). The code replaces the placeholder text but leaves static elements untouched.

**Solution:** Added `buildStaticTextCleanupRequests()` in `googleSlidesTemplate.ts` that scans kept slides for text elements matching patterns in `STATIC_TEXT_PATTERNS` (e.g. "lorem ipsum", "feedback date") and deletes them via `deleteObject` before running `replaceAllText`. For any additional static text that overlaps, either add the pattern to `STATIC_TEXT_PATTERNS` or remove the element directly in the Google Slides template.

---

### `Unknown name "autoFitType"` / `Unknown name "auto_fit_type"` — wrong autofit field name
**Error:** `Invalid JSON payload received. Unknown name "autoFitType" at 'requests[N].update_shape_properties.shape_properties.autofit': Cannot find field.`

**Cause:** The Google Slides REST API serializes proto field `autofit_type` as `autofitType` (camelCase, lowercase `f`). Using `autoFitType` (capital F) or `auto_fit_type` (snake_case) both fail.

**Solution:** Use `autofitType` (all lowercase except T):
```ts
autofit: { autofitType: 'TEXT_AUTOFIT' }
```

---

### `redirect_uri_mismatch` — wrong port (dev)
**Error:** `Error 400: redirect_uri_mismatch` when OAuth popup attempts to authenticate locally.

**Cause:** The app started on a port other than the one registered in Google Cloud Console Authorized JavaScript Origins (e.g. port 5177 instead of 5173 because other Vite instances held earlier ports).

**Solution:** Kill all other Vite dev server processes so the app claims port 5173 (the registered port):
```bash
lsof -ti :5173,:5174,:5175,:5176 | xargs kill -9
# Then restart: npm run dev
```
Long-term: `strictPort: true` added to `vite.config.ts` so the server fails fast if 5173 is taken rather than silently bumping to another port.

---

### `redirect_uri_mismatch` — www subdomain (production)
**Error:** `Error 400: redirect_uri_mismatch` with `origin=https://www.rfpparamount.com` when clicking "Export to Google Slides" on the live site.

**Cause:** Vercel's domain config has `www.rfpparamount.com` as the primary domain — `rfpparamount.com` 307-redirects to `www`. But the GCP OAuth client only had `https://rfpparamount.com` (non-www) in Authorized JavaScript Origins. Since the app actually runs on the `www` origin, Google rejects the OAuth request.

**Solution:** Add `https://www.rfpparamount.com` to the OAuth client's Authorized JavaScript Origins in Google Cloud Console: APIs & Services → Credentials → OAuth 2.0 Client IDs → Edit → add `https://www.rfpparamount.com`.

**Anti-pattern (causes ERR_TOO_MANY_REDIRECTS):** Do NOT add a `www` → non-www redirect in `vercel.json` when Vercel's domain settings already redirect non-www → www. That creates an infinite loop.

---

### TS2339: `Property 'google' does not exist on type 'Window'`
**Error:** TypeScript compilation fails in `googleAuth.ts` with TS2339 on `window.google`.

**Cause:** `declare global { interface Window { ... } }` syntax is only valid inside a TypeScript *module* (file with at least one `import`/`export`). `vite-env.d.ts` is an ambient declaration file with no imports/exports.

**Solution:** In ambient `.d.ts` files, augment `Window` directly without the `declare global` wrapper:
```typescript
// ✅ Correct in ambient .d.ts files
interface Window {
  google?: { ... }
}
// ❌ Only valid inside a .ts module file
declare global { interface Window { google?: { ... } } }
```

**Fix applied:** Removed `declare global` wrapper from `vite-env.d.ts`; Window interface augmented directly. Zero TS errors now.

---

### "Google Identity Services library not loaded yet"
**Cause:** GIS script (`accounts.google.com/gsi/client`) hasn't finished loading — the `window.google` global is undefined.
**Solution:** Wait a moment and try again. The script tag in `index.html` uses `async defer` so it loads after the page. In production this is rarely an issue; in dev it can happen if you click the button within milliseconds of page load.

---

### "Google sign-in failed: access_denied"
**Cause:** User clicked "Cancel" on the OAuth consent screen, or the OAuth app is in "Testing" mode and the user's email isn't added as a test user.
**Solution:**
1. Check Google Cloud Console → APIs & Services → OAuth consent screen → Test users — add the user's email.
2. Or publish the app (requires Google verification for `drive.file` scope beyond 100 users).

---

### "Google sign-in failed: popup_blocked_by_browser"
**Cause:** Browser blocked the OAuth popup (common in Safari with strict popup blocking).
**Solution:** User needs to allow popups for `localhost:5173`. In Safari: Preferences → Websites → Pop-up Windows → Allow for localhost.

---

### Google Slides API 403 Forbidden
**Cause:** The OAuth token doesn't have the required scope, or the token has expired.
**Solution:** The component will show "Try again" — clicking this re-triggers `getValidToken()` which requests a fresh token. If it persists, check that the OAuth Client ID has the `presentations` and `drive.file` scopes added in the consent screen.

---

### "Failed to create presentation: 400 Bad Request"
**Cause:** Usually means the presentation title is empty or contains invalid characters.
**Solution:** Check `data.project.title` is populated. The `buildProposalData` fallback sets it to `'Proposal'` so this shouldn't occur in practice.

---

### "Failed to build slides: 400 Bad Request" (batchUpdate)
**Cause:** An objectId in the batch is duplicated, or a shape references a non-existent slide ID.
**Solution:** Check `googleSlides.ts` — ensure all objectIds within a slide use the `${slideId}_suffix` pattern and are unique. The 10 slide IDs are hardcoded as `s01_cover` through `s10_close`.

---

### Logo images are blank/white rectangles in generated slides

**Symptom:** Logo placeholder rectangles appear on the slide but are white/blank — no actual logo image is visible.

**Cause:** The original `logo.clearbit.com` free API was deprecated after HubSpot's 2023 acquisition. It now returns HTTP 302 redirects instead of serving image bytes directly. The Google Slides `createImage` API does **not** follow redirects — it receives the empty 302 response and renders a blank image shape.

**Solution:** Switch logo URL source to a service that returns direct image bytes. Google's own favicon service is the most reliable option since the Slides API makes server-side requests from Google's infrastructure:
```
https://www.google.com/s2/favicons?domain=starbucks.com&sz=128
```
Returns a direct 128×128 PNG — no redirect, no auth required.

**Fix applied:** Replaced `LOGO_API = 'https://logo.clearbit.com'` with `FAVICON_API = 'https://www.google.com/s2/favicons'` and added `logoUrl(domain)` helper. Also changed logo shape from rectangular (1.5" × 0.5") to square (0.75" × 0.75") to match the square favicon aspect ratio. Error logging added to Phase 3 so future failures are visible in the browser console.

**Note:** If a company's Google favicon is a generic/low-quality icon, add `Company Domain: company.com` to the brief — this sets `data.client.companyDomain` which is used directly, allowing you to specify a domain with a better favicon.

---

### "field mask: * includes read-only fields" / "Autofit types other than NONE" (updateShapeProperties)
**Error:** `Invalid requests[N].updateShapeProperties: Invalid field mask: * includes read-only fields` or `Autofit types other than NONE are not supported`

**Cause:** Google Slides API now treats `autofit` as a read-only field in `ShapeProperties`. Any `updateShapeProperties` request that includes `autofit` in the field mask (e.g. `fields: 'autofit'`) returns a 400.

**Solution:** Remove all autofit requests entirely. Text boxes should be sized generously at creation time instead of relying on auto-shrink.

**Fix applied:** Removed the `autoFitRequest()` helper function and all 20 call sites from `src/utils/googleSlides.ts`.

---

### VITE_GOOGLE_CLIENT_ID not configured
**Cause:** The `.env` file is missing `VITE_GOOGLE_CLIENT_ID`.
**Solution:** Add to `.env`:
```
VITE_GOOGLE_CLIENT_ID=1077225057398-juibh7lmevfjot7qin4hkaio2v4vlhfe.apps.googleusercontent.com
```
Restart the dev server after changing `.env`.

---

## Common Error Categories

### Build Errors (TypeScript/Vite)

#### TS2307: Cannot find module
**Error:** `Cannot find module 'X' or its corresponding type declarations`

**Causes:**
- Missing dependency
- Incorrect import path
- Missing type definitions

**Solutions:**
```bash
# Install missing dependency
npm install <package-name>

# Install type definitions
npm install -D @types/<package-name>

# Check import path is correct (case-sensitive)
```

---

#### TS2339: Property does not exist
**Error:** `Property 'X' does not exist on type 'Y'`

**Causes:**
- Typo in property name
- Missing interface property
- Incorrect type assertion

**Solutions:**
- Check spelling
- Update interface in `src/types/proposal.ts`
- Use proper type guards

---

### Runtime Errors (Browser Console)

#### CORS Errors
**Error:** `Access to fetch at 'X' from origin 'Y' has been blocked by CORS`

**Causes:**
- Direct API calls without proxy
- Misconfigured Vite proxy

**Solutions:**
- Use server-side proxy for APIs that don't support CORS
- Check `vite.config.ts` proxy settings if applicable

---

#### Network Errors
**Error:** `Failed to fetch` or `NetworkError`

**Causes:**
- API server down
- Invalid API key
- Network connectivity

**Solutions:**
1. Check `.env` has valid API keys (`VITE_GEMINI_API_KEY`, `VITE_GOOGLE_CLIENT_ID`)
2. Verify network connection
3. Check API status at provider's status page

---

### React Errors

#### Invalid Hook Call
**Error:** `Invalid hook call. Hooks can only be called inside of the body of a function component`

**Causes:**
- Hook called outside component
- Multiple React versions
- Breaking Rules of Hooks

**Solutions:**
- Ensure hooks are at top level of component
- Run `npm ls react` to check for duplicates

---

#### Maximum Update Depth Exceeded
**Error:** `Maximum update depth exceeded`

**Causes:**
- Infinite re-render loop
- Missing dependency array in useEffect
- State update in render

**Solutions:**
- Add dependency array to useEffect
- Move state updates to event handlers
- Use useCallback for memoized functions

---

---

### Gemini API Errors

#### Empty response from Gemini 2.5 Flash (thinking model)
**Error:** `No content returned from Gemini` — the API returns `finishReason: "STOP"` with zero `candidatesTokenCount` and an empty `parts` array.

**Cause:** `gemini-2.5-flash` is a "thinking" model. Its internal reasoning tokens can intermittently consume the output-token budget when `responseMimeType: 'application/json'` is set, leaving no room for the actual JSON output. This is a known Google-side bug ([googleapis/nodejs-vertexai#516](https://github.com/googleapis/nodejs-vertexai/issues/516)).

**Solution:** Disable thinking for structured-JSON calls by adding `thinkingConfig: { thinkingBudget: 0 }` inside `generationConfig`:
```ts
generationConfig: {
  temperature: 0.7,
  maxOutputTokens: 16384,
  thinkingConfig: { thinkingBudget: 0 },
  responseMimeType: 'application/json',
}
```

**Fix applied:** Added `thinkingConfig: { thinkingBudget: 0 }` to all 5 Gemini call sites in `src/utils/llmService.ts`. Also added retry logic (up to 2 retries) and increased `maxOutputTokens` to prevent recurrence. All Gemini calls now use `fetchWithRetry` which automatically retries on 429/500/502/503.

---

#### Gemini 200 OK with error in response body
**Error:** Gemini API returns HTTP 200 but the JSON body contains `{ "error": { "code": 429, "message": "Quota exceeded" } }` instead of `candidates`. The app previously treated this as an "empty response" without surfacing the real error.

**Cause:** The Vercel/Express proxy forwards the upstream Gemini status code verbatim. Gemini can return 200 with an error body for soft rate limits, quota issues, or safety blocks.

**Solution:** Added `validateGeminiBody(result)` in `llmService.ts` that checks for `result.error`, `finishReason: 'SAFETY'`, and `finishReason: 'RECITATION'` before extracting content. Throws typed `GeminiBlockedError` with an actionable message.

**Fix applied:** All 6 Gemini call sites now call `validateGeminiBody()` after parsing the response JSON.

---

#### OAuth token expires during multi-step generation
**Error:** `AUTH_EXPIRED` error when creating Google Slides after a successful Gemini generation. The Gemini generation takes 15-60 seconds, during which the OAuth token expires.

**Cause:** `getValidToken()` could return a token with only seconds remaining. After the LLM generation completes, the token is expired for the Slides API call.

**Solution:** Added `ensureFreshToken(bufferMs=120000)` in `googleAuth.ts` that guarantees the token has at least 2 minutes of lifetime remaining. `GoogleSlidesButton` calls it before generation AND again before Slides creation. Slides builders now accept a `getToken` callback and re-fetch tokens automatically on 401 errors.

**Fix applied:** `ensureFreshToken()` exported from `googleAuth.ts`; `GoogleSlidesButton` calls it at both critical points; `withBackoff()` in slides builders now handles AUTH_EXPIRED by refreshing the token and retrying.

---

#### Vercel 4.5MB body limit breaks large PDF uploads
**Error:** `413 Payload Too Large` when uploading PDFs larger than ~3.4MB on Vercel production.

**Cause:** Vercel enforces a hard 4.5MB request body limit on serverless functions. Base64 encoding inflates files by ~33%, so PDFs over ~3.4MB raw size exceed the limit. The Express dev server allows 100MB.

**Workaround:** For production, keep PDF uploads under ~3.4MB. Alternatively, use the "Paste Text" input mode for large briefs. A future fix could use chunked uploads or Vercel Edge Functions.

---

#### fetchWithRetry timeout
**Error:** `TIMEOUT: Request to /api/gemini/generate-content timed out after 90s` — the user sees "The request timed out. The AI service may be under heavy load."

**Cause:** Gemini API didn't respond within the configured timeout (90s for most calls, 120s for proposal generation). Can happen after Vercel cold starts or during high API load.

**Solution:** The `fetchWithRetry` utility retries timed-out requests up to 3 times with exponential backoff. If all retries fail, a user-friendly timeout message is shown with a "Try again" button.

---

#### 429 - Resource Exhausted
**Error:** `Gemini API error: 429` or `RESOURCE_EXHAUSTED`

**Causes:**
- Exceeded per-minute request quota for Gemini API
- Free tier daily limit reached

**Solutions:**
1. Check quota at https://aistudio.google.com/apikey
2. Wait a minute and retry (per-minute quota resets quickly)
3. Upgrade to a paid plan for higher limits
4. Consider switching model from `gemini-2.0-flash` to a lower-cost variant

---

#### 400 - Invalid API Key
**Error:** `Gemini API error: 400` with `API_KEY_INVALID`

**Causes:**
- `VITE_GEMINI_API_KEY` is missing or incorrect
- API key was revoked or regenerated

**Solutions:**
1. Generate a new key at https://aistudio.google.com/apikey
2. Add it to `.env`: `VITE_GEMINI_API_KEY=your-key-here`
3. Restart the dev server after changing `.env`

---

#### 403 - Permission Denied
**Error:** `Gemini API error: 403`

**Causes:**
- Gemini API not enabled for the Google Cloud project associated with the key
- API key restricted to specific APIs that don't include Generative Language

**Solutions:**
1. Go to https://console.cloud.google.com/apis/library and enable "Generative Language API"
2. Check API key restrictions in the Cloud Console

---

### Framer Motion Errors

#### useContext is null
**Error:** `Cannot read properties of null (reading 'useContext')`

**Causes:**
- Multiple React instances in node_modules
- Hot Module Replacement (HMR) state corruption
- Framer Motion version mismatch with React

**Solutions:**
1. Restart dev server: `Ctrl+C` then `npm run dev`
2. Clear Vite cache: `rm -rf node_modules/.vite && npm run dev`
3. Check for duplicate React: `npm ls react`
4. If persists, reinstall: `rm -rf node_modules && npm install`

---

### PDF Analysis Returns Empty Brief
**Error:** PDF uploaded but parsed fields (company, project, etc.) remain empty after extraction.

**Causes:**
- The PDF is a scanned image (not text-based) — Gemini may return empty fields
- The PDF is password-protected
- The brief text is in an unusual format that doesn't match expected key:value or list patterns

**Solutions:**
1. Ensure the PDF has selectable text (not a scanned image). If scanned, use OCR software first.
2. Try the "Paste Text" tab instead — copy text from the PDF manually.
3. If Gemini extracts garbled text, try adding a `Client:` / `Problems:` / `Benefits:` header structure.

---

### `TS2322: Type '"input"' is not assignable to type 'Step'`
**Error:** TypeScript errors referencing old step names after migration.

**Cause:** The `Step` type was updated from `'input' | 'expand' | 'review' | 'success'` → `'draft' | 'iterate' | 'design' | 'share'` → `'draft' | 'refine' | 'export'` in `src/types/proposal.ts`. Any file using old step IDs will fail.

**Solution:** Update all files to use current step names: `'draft' | 'refine' | 'export'`.

**Fix applied:** `useProposalState.ts` was deleted (state moved inline into `App.tsx`). Steps collapsed to 3.

---

### CI E2E tests show "The operation was canceled" with 0 tests completing
**Error:** `Running 54 tests using 1 worker → Error: The operation was canceled.`

**Cause:** After UI component redesigns (e.g., ChatInterface), test selectors become stale. With `retries: 2` and 1 worker, failing tests retry 3× each with 30s timeouts, easily exceeding the CI `timeout-minutes`. GitHub Actions cancels the job, producing "operation was canceled" instead of individual test failures.

**Solution:** Update stale selectors in `e2e/app.spec.ts` to match current component output. Common drift: greeting text, button aria-labels, input placeholders, section headings. Also ensure CI timeout is generous enough (25+ min) for resilience tests that use backoff delays.

**Prevention:** After any component redesign, run `npx playwright test --retries=0` locally before pushing. Zero-retry mode surfaces failures fast.

---

### E2E tests pass locally but fail in CI (12 failures in Step 2 Chat + Step 3 Share)
**Error:** Tests that require AI responses or Google Slides creation fail in GitHub Actions with timeout or "Sorry, something went wrong" errors. Locally all tests pass.

**Cause:** The CI workflow ran `npm run build` without `VITE_GEMINI_API_KEY` or `VITE_GOOGLE_CLIENT_ID` environment variables. Vite compiles `import.meta.env.VITE_*` values at build time — missing vars become `undefined` in the bundle. Guard checks in `llmService.ts` (line 4) and `googleAuth.ts` (line 46) throw before any `fetch()` call is made, so Playwright's `page.route()` mocks never intercept. Locally it works because the dev server reads from the gitignored `.env` file containing real keys.

**Solution:** Add dummy env vars to the CI build step in `.github/workflows/e2e.yml`:
```yaml
- name: Build app
  run: npm run build
  env:
    VITE_GEMINI_API_KEY: test-api-key
    VITE_GOOGLE_CLIENT_ID: test-client-id.apps.googleusercontent.com
```
Actual values don't matter since all API calls are mocked by Playwright route handlers in the test suite.

**Fix applied:** Added env vars to `.github/workflows/e2e.yml` build step. All 12 tests now pass in CI.

---

## Error Log

| Date | Error | File | Solution | Status |
|------|-------|------|----------|--------|
| 2026-03-17 | API 404 on Vercel (Express not deployed) | api/ directory | Created Vercel Serverless Functions for all routes | Fixed |
| 2026-01-19 | useContext null (framer-motion) | App.tsx | Restart dev server / clear .vite cache | Workaround |
| 2026-01-20 | OpenAI 429 insufficient_quota | llmService.ts | Migrated to Gemini — no longer applicable | Obsolete |
| 2026-02-26 | TS2322 Step type mismatch after migration | useProposalState.ts (deleted) | Steps collapsed to draft/refine/export; state inlined in App.tsx | Fixed |
| 2026-02-27 | 12 E2E failures in CI (missing VITE_* env vars) | .github/workflows/e2e.yml | Added dummy env vars to build step | Fixed |
| 2026-03-04 | Empty response from gemini-2.5-flash (thinking tokens) | src/utils/llmService.ts | Disabled thinking via thinkingBudget: 0 + retry logic | Fixed |
| 2026-03-04 | autofit read-only field mask error (Google Slides API) | src/utils/googleSlides.ts | Removed autoFitRequest() and all 20 call sites | Fixed |
| 2026-03-17 | Gemini HTTP errors (429/503) cause immediate failure | src/utils/fetchWithRetry.ts | Created fetchWithRetry with exponential backoff | Fixed |
| 2026-03-17 | Gemini 200 OK with error body not detected | src/utils/llmService.ts | Added validateGeminiBody() checking error/safety/recitation | Fixed |
| 2026-03-17 | OAuth token expires during multi-step generation | src/utils/googleAuth.ts | Added ensureFreshToken(bufferMs=120000) + token-getter callbacks | Fixed |
| 2026-03-17 | Google Slides 401 mid-batch not retried | src/utils/googleSlides.ts | Extended withBackoff to handle AUTH_EXPIRED with token refresh | Fixed |
| 2026-03-17 | Initial presentation creation has no retry | src/utils/googleSlides.ts | Wrapped POST create + Drive copy in withBackoff | Fixed |
| 2026-03-23 | Express/Vercel thinkingConfig format mismatch | server/routes/gemini.ts | Added thinkingBudget→thinkingLevel normalization to Express route | Fixed |
| 2026-03-23 | CI E2E "operation was canceled" (stale selectors + 15m timeout) | e2e/app.spec.ts | Updated 12 selectors (greeting, prompts, placeholder, heading); bumped CI timeout to 25m | Fixed |

---

### Express vs Vercel behavior mismatch — thinkingConfig format
**Error:** Gemini API returns errors or unexpected behavior in local dev but works in production (or vice versa).

**Cause:** The Express dev server (`server/routes/gemini.ts`) was forwarding the Gemini request body as-is, while the Vercel serverless function (`api/gemini/generate-content.ts`) normalized `thinkingConfig.thinkingBudget` (Gemini 2.5 format) to `thinkingConfig.thinkingLevel` (Gemini 3 format). When the client sent `{ thinkingBudget: 0 }`, production converted it to `{ thinkingLevel: 'low' }` but dev passed it through unchanged.

**Solution:** Added the same normalization logic to the Express route: if `thinkingBudget` is present without `thinkingLevel`, convert `thinkingBudget: 0` to `thinkingLevel: 'low'` and any other value to `thinkingLevel: 'medium'`.

**Fix applied:** `server/routes/gemini.ts` — `generate-content` handler now shallow-clones `req.body` and normalizes `thinkingConfig` before forwarding to Gemini.

---

### Gemini proxy hanging indefinitely (no timeout)
**Error:** Server-side Gemini proxy requests hang forever when the upstream API is slow or unresponsive. No timeout or abort signal.

**Cause:** `fetch()` calls to the Gemini API had no timeout configured. If Gemini stalled, the request would hang until the client disconnected.

**Solution:** Added `AbortController` with a 55-second timeout to all Gemini proxy `fetch()` calls in both Express routes (`server/routes/gemini.ts`) and Vercel serverless functions (`api/gemini/generate-content.ts`, `api/gemini/upload-file.ts`). Returns 504 with `"Gemini API request timed out"` when aborted.

---

### E2E tests fail — landing page blocks all test interactions
**Error:** All Playwright E2E tests fail with "element(s) not found" for basic elements like `header`, `getByText('Draft')`, etc.

**Cause:** The landing page gate (`sessionStorage.getItem('rfp_app_entered')`) blocks the main app on first visit. Tests navigate to `/` but never see the main app UI.

**Solution:** Added `test.beforeEach` with `page.addInitScript(() => sessionStorage.setItem('rfp_app_entered', '1'))` to bypass the landing page in all E2E tests.

---

## Adding New Errors

When you fix a new error, add it using this template:

```markdown
#### [Error Name/Code]
**Error:** `[Exact error message]`

**Causes:**
- [List possible causes]

**Solutions:**
[Step-by-step solution]
```
