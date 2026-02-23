/**
 * Google OAuth 2.0 token management via Google Identity Services (GIS)
 *
 * Uses the implicit token flow — no backend required. The access token lives
 * in memory only (never localStorage) and expires after 1 hour.
 *
 * Scopes requested:
 *   - presentations: create & write Google Slides presentations
 *   - drive.file: least-privilege Drive access (only files this app creates)
 */

const SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive.file',
].join(' ')

// In-memory token store — wiped on page refresh (intentional, forces re-auth)
let cachedToken: string | null = null
let tokenExpiresAt: number | null = null

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

/**
 * Triggers the Google OAuth popup and resolves with a fresh access token.
 * If the user has already granted consent, the popup may close immediately.
 */
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

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(`Google sign-in failed: ${response.error_description || response.error}`))
          return
        }
        cachedToken = response.access_token
        // GIS tokens are valid for 3600 seconds; subtract 60s buffer
        tokenExpiresAt = Date.now() + (response.expires_in - 60) * 1000
        resolve(response.access_token)
      },
    })

    // prompt: '' = show consent only if not already granted (silent re-auth when possible)
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

/**
 * Returns a valid access token, requesting a new one if the cached token
 * is missing or expired.
 */
export async function getValidToken(): Promise<string> {
  const { isSignedIn, accessToken } = getAuthState()
  if (isSignedIn && accessToken) return accessToken
  return requestGoogleToken()
}

export function revokeToken(): void {
  if (cachedToken && window.google) {
    window.google.accounts.oauth2.revoke(cachedToken, () => {})
    cachedToken = null
    tokenExpiresAt = null
  }
}
