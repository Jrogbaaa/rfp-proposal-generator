// 408 = client request timeout, 504 = upstream/gateway timeout.
// Both are transient and frequently recover on a second attempt
// (e.g. Gemini cold path on `gemini-3-flash-preview` for large PDFs).
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504])

export interface FetchRetryOptions {
  maxRetries?: number
  timeoutMs?: number
  baseDelayMs?: number
  maxDelayMs?: number
}

export class FetchTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`TIMEOUT: Request to ${url} timed out after ${Math.round(timeoutMs / 1000)}s`)
    this.name = 'FetchTimeoutError'
  }
}

export class FetchRetryExhaustedError extends Error {
  public readonly status: number
  constructor(status: number, url: string, attempts: number, detail?: string) {
    const msg = detail
      ? `GEMINI_${status}: ${detail}`
      : `GEMINI_${status}: Request to ${url} failed after ${attempts} attempts`
    super(msg)
    this.name = 'FetchRetryExhaustedError'
    this.status = status
  }
}

/**
 * Drop-in fetch replacement with exponential backoff, timeout, and automatic
 * retries on transient HTTP errors (429, 500, 502, 503).
 *
 * Non-retryable codes (400, 401, 403) fail fast so auth and validation errors
 * propagate immediately.
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts: FetchRetryOptions = {},
): Promise<Response> {
  const {
    maxRetries = 3,
    timeoutMs = 90_000,
    baseDelayMs = 1000,
    maxDelayMs = 32_000,
  } = opts

  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const mergedInit: RequestInit = {
      ...init,
      signal: controller.signal,
    }

    try {
      const response = await fetch(input, mergedInit)
      clearTimeout(timer)

      if (response.ok || !RETRYABLE_STATUS_CODES.has(response.status)) {
        return response
      }

      if (attempt === maxRetries) {
        const body = await response.text().catch(() => '')
        let detail: string | undefined
        try {
          const json = JSON.parse(body)
          detail = json?.error?.message || json?.error || body.slice(0, 200)
        } catch {
          detail = body.slice(0, 200)
        }
        throw new FetchRetryExhaustedError(response.status, url, attempt + 1, detail)
      }

      const retryAfter = response.headers.get('Retry-After')
      const retryDelayMs = retryAfter
        ? Math.min(parseInt(retryAfter, 10) * 1000 || baseDelayMs, maxDelayMs)
        : Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000, maxDelayMs)

      console.warn(
        `[fetchWithRetry] ${response.status} on ${url} — retrying in ${Math.round(retryDelayMs / 1000)}s (attempt ${attempt + 1}/${maxRetries})`,
      )
      await new Promise(r => setTimeout(r, retryDelayMs))
    } catch (err) {
      clearTimeout(timer)

      if (err instanceof FetchRetryExhaustedError) throw err

      if (err instanceof DOMException && err.name === 'AbortError') {
        if (attempt === maxRetries) throw new FetchTimeoutError(url, timeoutMs)
        console.warn(`[fetchWithRetry] Timeout on ${url} — retrying (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(r => setTimeout(r, Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)))
        continue
      }

      if (attempt === maxRetries) throw err

      console.warn(
        `[fetchWithRetry] Network error on ${url} — retrying (attempt ${attempt + 1}/${maxRetries}):`,
        err instanceof Error ? err.message : err,
      )
      await new Promise(r => setTimeout(r, Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)))
    }
  }

  throw new Error(`fetchWithRetry: unreachable`)
}
