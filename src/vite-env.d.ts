/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Google Identity Services (GIS) global type declaration
// Loaded via <script src="https://accounts.google.com/gsi/client"> in index.html
// Note: ambient .d.ts files augment Window directly (no `declare global` wrapper needed)
interface GISTokenResponse {
  access_token: string
  expires_in: number
  error?: string
  error_description?: string
}

interface GISTokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void
}

interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string
          scope: string
          callback: (response: GISTokenResponse) => void
        }) => GISTokenClient
        revoke: (token: string, callback: () => void) => void
      }
    }
  }
}
