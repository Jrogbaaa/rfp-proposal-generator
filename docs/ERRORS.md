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
1. Check `.env` has valid API keys (`VITE_OPENAI_API_KEY`, `VITE_GOOGLE_CLIENT_ID`)
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

### OpenAI API Errors

#### 429 - Insufficient Quota
**Error:** `You exceeded your current quota, please check your plan and billing details`

**Causes:**
- OpenAI account has run out of credits
- Hit maximum monthly spending limit
- Prepaid credits have been consumed

**Solutions:**
1. Check billing at https://platform.openai.com/account/billing
2. Add payment method or purchase more credits
3. Check usage at https://platform.openai.com/usage
4. Consider increasing monthly spending limit in account settings

**Note:** This is different from rate limiting (too many requests). Quota errors require adding funds to your OpenAI account.

---

#### 429 - Rate Limit Reached
**Error:** `Rate limit reached for requests`

**Causes:**
- Sending too many requests per minute
- Concurrent API calls exceeding tier limits

**Solutions:**
1. Implement exponential backoff retry logic
2. Add delays between requests
3. Check your rate limit tier at https://platform.openai.com/account/limits
4. Consider upgrading API tier for higher limits

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

## Error Log

| Date | Error | File | Solution | Status |
|------|-------|------|----------|--------|
| 2026-01-19 | useContext null (framer-motion) | App.tsx | Restart dev server / clear .vite cache | Workaround |
| 2026-01-20 | OpenAI 429 insufficient_quota | llmService.ts | Add credits to OpenAI account | Fixed |

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
