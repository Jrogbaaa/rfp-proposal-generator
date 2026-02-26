# Error Reference Guide

A living document of errors encountered during development and their solutions.

---

## How to Use This Document

When you encounter an error:
1. Search this document for similar errors
2. If found, follow the documented solution
3. If not found, debug and add the solution here

---

## Google Slides / OAuth Errors

### `redirect_uri_mismatch` — wrong port
**Error:** `Error 400: redirect_uri_mismatch` when OAuth popup attempts to authenticate.

**Cause:** The app started on a port other than the one registered in Google Cloud Console Authorized JavaScript Origins (e.g. port 5177 instead of 5173 because other Vite instances held earlier ports).

**Solution:** Kill all other Vite dev server processes so the app claims port 5173 (the registered port):
```bash
lsof -ti :5173,:5174,:5175,:5176 | xargs kill -9
# Then restart: npm run dev
```
Long-term: `strictPort: true` added to `vite.config.ts` so the server fails fast if 5173 is taken rather than silently bumping to another port.

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

### "Autofit types other than NONE are not supported" (updateShapeProperties)
**Error:** `Invalid requests[N].updateShapeProperties: Autofit types other than NONE are not supported`

**Cause:** Google Slides API deprecated `TEXT_AUTOFIT` as an autofit type. Any `updateShapeProperties` request that sets `autofitType: 'TEXT_AUTOFIT'` is now rejected with a 400.

**Solution:** Remove all autofit requests entirely. Text boxes should be sized generously at creation time instead of relying on auto-shrink.

**Fix applied:** Removed the `autofit()` helper function and all 23 call sites from `src/utils/googleSlides.ts`.

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
**Error:** TypeScript errors in `useProposalState.ts` referencing old step names after migration.

**Cause:** The `Step` type was updated from `'input' | 'expand' | 'review' | 'success'` to `'draft' | 'iterate' | 'design' | 'share'` in `src/types/proposal.ts`. Any file using the old step IDs will fail.

**Solution:** Update `useProposalState.ts` (and any other files) to map to the new step names:
```
case 0: return 'draft'  // was 'input'
case 1: return 'iterate' // was 'expand'
case 2: return 'design'  // was 'review'
case 3: return 'share'   // was 'success'
```

**Fix applied:** `src/hooks/useProposalState.ts` updated.

---

## Error Log

| Date | Error | File | Solution | Status |
|------|-------|------|----------|--------|
| 2026-01-19 | useContext null (framer-motion) | App.tsx | Restart dev server / clear .vite cache | Workaround |
| 2026-01-20 | OpenAI 429 insufficient_quota | llmService.ts | Migrated to Gemini — no longer applicable | Obsolete |
| 2026-02-26 | TS2322 Step type mismatch after migration | useProposalState.ts | Updated step IDs to draft/iterate/design/share | Fixed |

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
