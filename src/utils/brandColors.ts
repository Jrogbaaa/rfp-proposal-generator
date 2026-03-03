/**
 * Brand Color Intelligence (Option 1)
 *
 * Auto-detects a client's brand palette from their company name at export time.
 * Maps ~50 major brands to a signature hex color, then derives a full SlidePalette.
 *
 * Usage:
 *   const palette = getBrandPalette('Starbucks') ?? PALETTE_MAP['navy-gold']
 */

type RgbColor = { red: number; green: number; blue: number }

export interface SlidePalette {
  primary: RgbColor
  primaryLighter: RgbColor
  primaryDarker: RgbColor
  accent: RgbColor
}

// ---------------------------------------------------------------------------
// Brand signature colors — the one color everyone associates with each brand
// ---------------------------------------------------------------------------

const BRAND_HEX_MAP: Record<string, string> = {
  // Sportswear / Consumer
  'nike':         '#FF6600',
  'adidas':       '#000000',
  'underarmour':  '#E31837',
  'lululemon':    '#B0303C',

  // Tech Giants
  'apple':        '#555555',
  'google':       '#4285F4',
  'microsoft':    '#00A4EF',
  'amazon':       '#FF9900',
  'meta':         '#0866FF',
  'facebook':     '#0866FF',
  'instagram':    '#E1306C',
  'twitter':      '#1DA1F2',
  'linkedin':     '#0A66C2',
  'youtube':      '#FF0000',
  'tiktok':       '#010101',
  'snapchat':     '#FFFC00',
  'pinterest':    '#E60023',
  'reddit':       '#FF4500',

  // Entertainment / Streaming
  'netflix':      '#E50914',
  'disney':       '#113CCF',
  'spotify':      '#1DB954',
  'hbo':          '#6B2D8B',

  // SaaS / Enterprise
  'salesforce':   '#00A1E0',
  'slack':        '#4A154B',
  'zoom':         '#2D8CFF',
  'hubspot':      '#FF7A59',
  'shopify':      '#96BF48',
  'stripe':       '#635BFF',
  'atlassian':    '#0052CC',
  'dropbox':      '#0061FF',
  'adobe':        '#FF0000',
  'oracle':       '#F80000',
  'ibm':          '#0062FF',

  // Finance / Payments
  'visa':         '#1A1F71',
  'mastercard':   '#EB001B',
  'paypal':       '#003087',
  'tesla':        '#CC0000',

  // F&B / Retail
  'starbucks':    '#00704A',
  'mcdonalds':    '#DA291C',
  'cocacola':     '#F40009',
  'pepsi':        '#004B93',
  'samsung':      '#1428A0',

  // Consulting / Professional Services
  'deloitte':     '#86BC25',
  'mckinsey':     '#2251FF',
  'accenture':    '#A100FF',
  'pwc':          '#E0301E',
  'kpmg':         '#00338D',
  'ey':           '#FFE600',
  'bain':         '#CC0000',
  'bcg':          '#00965E',

  // Ride-share / Travel
  'uber':         '#000000',
  'lyft':         '#FF00BF',
  'airbnb':       '#FF5A5F',
}

// ---------------------------------------------------------------------------
// Color math: hex ↔ RGB ↔ HSL
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): RgbColor {
  const h = hex.replace('#', '')
  return {
    red:   parseInt(h.slice(0, 2), 16) / 255,
    green: parseInt(h.slice(2, 4), 16) / 255,
    blue:  parseInt(h.slice(4, 6), 16) / 255,
  }
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): RgbColor {
  if (s === 0) return { red: l, green: l, blue: l }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hue2rgb = (t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return {
    red:   hue2rgb(h + 1 / 3),
    green: hue2rgb(h),
    blue:  hue2rgb(h - 1 / 3),
  }
}

// ---------------------------------------------------------------------------
// Derive a full SlidePalette from a single brand hex
// ---------------------------------------------------------------------------

function hexToPalette(hex: string): SlidePalette {
  const { red, green, blue } = hexToRgb(hex)
  const [h, s, l] = rgbToHsl(red, green, blue)

  // Light brand colors (bright yellows, lime greens, etc.) — use neutral dark primary
  // so white text on the background is readable. Brand color becomes accent only.
  const isLightBrand = l > 0.60 || (h > 0.10 && h < 0.20 && l > 0.50)

  if (isLightBrand) {
    return {
      primary:        { red: 0.08, green: 0.08, blue: 0.10 },
      primaryLighter: { red: 0.13, green: 0.13, blue: 0.16 },
      primaryDarker:  { red: 0.04, green: 0.04, blue: 0.06 },
      accent:         { red, green, blue },
    }
  }

  // Normal brand color: derive a dark background in the same hue family.
  // Lightness capped at 0.17 so backgrounds are always dark enough for white text.
  const primaryL       = Math.min(0.17, Math.max(0.10, l * 0.50))
  const primary        = hslToRgb(h, Math.max(0.30, s * 0.70), primaryL)
  const primaryLighter = hslToRgb(h, Math.max(0.25, s * 0.65), primaryL + 0.07)
  const primaryDarker  = hslToRgb(h, Math.max(0.30, s * 0.75), Math.max(0.04, primaryL - 0.06))

  return { primary, primaryLighter, primaryDarker, accent: { red, green, blue } }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Derives a full SlidePalette from a single hex color string (e.g. "#FF6600").
 * Exported for direct use when a user supplies a custom brand hex.
 */
export function derivePaletteFromHex(hex: string): SlidePalette {
  return hexToPalette(hex)
}

/**
 * Returns a SlidePalette derived from the company's brand color,
 * or null if the company is not in the lookup table.
 */
export function getBrandPalette(company: string): SlidePalette | null {
  // Normalize: lowercase, strip non-alpha characters
  const key = company.toLowerCase().replace(/[^a-z]/g, '')
  if (!key) return null

  // 1. Exact match
  if (BRAND_HEX_MAP[key]) return hexToPalette(BRAND_HEX_MAP[key])

  // 2. Substring match: "Nike Inc" → "nikeinc" contains "nike"
  for (const [brandKey, hex] of Object.entries(BRAND_HEX_MAP)) {
    if (key.includes(brandKey) || brandKey.includes(key)) {
      return hexToPalette(hex)
    }
  }

  return null
}
