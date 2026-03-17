/**
 * Google OAuth 2.0 token management via Google Identity Services (GIS)
 *
 * Uses the implicit token flow — no backend required. The access token is
 * persisted in localStorage so it survives page refreshes until it expires
 * (~1 hour). After expiry, GIS re-authenticates via popup.
 *
 * Scopes requested:
 *   - presentations: create & write Google Slides presentations
 *   - drive: full Drive access (required to copy shared templates)
 */

const SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive',
].join(' ')

const TOKEN_STORAGE_KEY = 'gis_access_token'
const TOKEN_EXPIRY_KEY = 'gis_token_expires_at'
const SCOPE_VERSION = 'v3'
const SCOPE_VERSION_KEY = 'gis_scope_version'
const CONSENTED_KEY = 'gis_has_consented'

if (localStorage.getItem(SCOPE_VERSION_KEY) !== SCOPE_VERSION) {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
  localStorage.removeItem(CONSENTED_KEY)
  localStorage.setItem(SCOPE_VERSION_KEY, SCOPE_VERSION)
}

let cachedToken: string | null = null
let tokenExpiresAt: number | null = null

const _storedToken = localStorage.getItem(TOKEN_STORAGE_KEY)
const _storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY)
if (_storedToken && _storedExpiry && Date.now() < Number(_storedExpiry)) {
  cachedToken = _storedToken
  tokenExpiresAt = Number(_storedExpiry)
}

export interface GoogleAuthState {
  isSignedIn: boolean
  accessToken: string | null
}

export function getAuthState(): GoogleAuthState {
  const isExpired = tokenExpiresAt ? Date.now() > tokenExpiresAt : true
  const isSignedIn = cachedToken !== null && !isExpired
  return {
    isSignedIn,
    accessToken: isSignedIn ? cachedToken : null,
  }
}

export function requestGoogleToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject(new Error('Google Identity Services library not loaded yet. Please wait a moment and try again.'))
      return
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      reject(new Error('VITE_GOOGLE_CLIENT_ID is not configured.'))
      return
    }

    let settled = false
    const settle = (fn: () => void) => {
      if (!settled) { settled = true; fn() }
    }

    const timeoutId = setTimeout(() => {
      settle(() => reject(new Error('AUTH_TIMEOUT: Sign-in timed out. Please try again.')))
    }, 60000)

    const hasConsented = localStorage.getItem(CONSENTED_KEY) === 'true'

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        clearTimeout(timeoutId)
        if (response.error) {
          settle(() => reject(new Error(`AUTH_DENIED: ${response.error_description || response.error}`)))
          return
        }
        cachedToken = response.access_token
        tokenExpiresAt = Date.now() + (response.expires_in - 60) * 1000
        localStorage.setItem(TOKEN_STORAGE_KEY, cachedToken)
        localStorage.setItem(TOKEN_EXPIRY_KEY, String(tokenExpiresAt))
        localStorage.setItem(CONSENTED_KEY, 'true')
        settle(() => resolve(response.access_token))
      },
    })

    tokenClient.requestAccessToken({ prompt: hasConsented ? '' : 'consent' })
  })
}

export async function getValidToken(): Promise<string> {
  const { isSignedIn, accessToken } = getAuthState()
  if (isSignedIn && accessToken) return accessToken
  return requestGoogleToken()
}

/**
 * Returns a token guaranteed to be valid for at least `bufferMs` more
 * milliseconds. Use before multi-step flows to prevent mid-flow expiry.
 */
export async function ensureFreshToken(bufferMs = 120_000): Promise<string> {
  if (cachedToken && tokenExpiresAt && (tokenExpiresAt - Date.now()) > bufferMs) {
    return cachedToken
  }
  return requestGoogleToken()
}

export function clearExpiredToken(): void {
  if (tokenExpiresAt && Date.now() > tokenExpiresAt) {
    cachedToken = null
    tokenExpiresAt = null
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
  }
}

export function revokeToken(): void {
  if (cachedToken && window.google) {
    window.google.accounts.oauth2.revoke(cachedToken, () => {})
    cachedToken = null
    tokenExpiresAt = null
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem(TOKEN_EXPIRY_KEY)
  }
}
