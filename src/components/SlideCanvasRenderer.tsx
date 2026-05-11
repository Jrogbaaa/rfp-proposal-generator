import { forwardRef } from 'react'
import type { SlideData } from '../data/slideContent'
import type { DesignConfig } from '../types/proposal'

export interface SlideOverrides {
  titleFontSize?: number
  bodyFontSize?: number
  maxBullets?: number
  titleText?: string
}

interface SlideCanvasRendererProps {
  slide: SlideData
  designConfig: DesignConfig
  overrides?: SlideOverrides
  scale?: number
}

const SLIDE_W = 960
const SLIDE_H = 540

const THEME_MAP: Record<string, { primary: string; accent: string; dark: string; text: string; textMuted: string }> = {
  'navy-gold':       { primary: '#1B2A4A', accent: '#C9A84C', dark: '#0F1929', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.7)' },
  'slate-blue':      { primary: '#2C3E6B', accent: '#4A90D9', dark: '#1A2540', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.7)' },
  'forest-green':    { primary: '#1B3A2D', accent: '#5CB85C', dark: '#0F2018', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.7)' },
  'executive-dark':  { primary: '#1A1A1A', accent: '#C0A882', dark: '#0D0D0D', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.65)' },
  'paramount':       { primary: '#003087', accent: '#F5C518', dark: '#001A4D', text: '#FFFFFF', textMuted: 'rgba(255,255,255,0.7)' },
}

const SlideCanvasRenderer = forwardRef<HTMLDivElement, SlideCanvasRendererProps>(
  ({ slide, designConfig, overrides, scale = 1 }, ref) => {
    const theme = THEME_MAP[designConfig.colorTheme] ?? THEME_MAP['navy-gold']

    const titleText = overrides?.titleText ?? slide.title
    const bullets = slide.bullets.slice(0, overrides?.maxBullets ?? 4)
    const titleSize = overrides?.titleFontSize ?? (slide.type === 'title' ? 40 : slide.type === 'impact' ? 36 : 28)
    const bodySize = overrides?.bodyFontSize ?? 16

    const wrapperStyle: React.CSSProperties = {
      width: SLIDE_W * scale,
      height: SLIDE_H * scale,
      overflow: 'hidden',
      flexShrink: 0,
      position: 'relative',
    }

    const innerStyle: React.CSSProperties = {
      width: SLIDE_W,
      height: SLIDE_H,
      transformOrigin: 'top left',
      transform: scale !== 1 ? `scale(${scale})` : undefined,
      position: 'absolute',
      top: 0,
      left: 0,
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    }

    if (slide.type === 'title') {
      return (
        <div ref={ref} style={wrapperStyle}>
          <div style={{ ...innerStyle, background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.dark} 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 80px', boxSizing: 'border-box' }}>
            {/* Accent bar */}
            <div style={{ width: 64, height: 4, background: theme.accent, marginBottom: 32, borderRadius: 2 }} />
            <div style={{ color: theme.text, fontSize: titleSize, fontWeight: 700, textAlign: 'center', lineHeight: 1.2, marginBottom: 20, letterSpacing: '-0.02em' }}>
              {titleText}
            </div>
            {slide.subtitle && (
              <div style={{ color: theme.textMuted, fontSize: 18, textAlign: 'center', lineHeight: 1.5, maxWidth: 640 }}>
                {slide.subtitle}
              </div>
            )}
            {bullets.length > 0 && (
              <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                {bullets.map((b, i) => (
                  <div key={i} style={{ color: theme.textMuted, fontSize: 15, textAlign: 'center' }}>{b}</div>
                ))}
              </div>
            )}
            {/* Footer brand line */}
            <div style={{ position: 'absolute', bottom: 24, right: 40, color: theme.accent, fontSize: 11, letterSpacing: '0.12em', fontWeight: 600, opacity: 0.8 }}>
              PARAMOUNT · ADVERTISING SOLUTIONS
            </div>
          </div>
        </div>
      )
    }

    if (slide.type === 'impact') {
      return (
        <div ref={ref} style={wrapperStyle}>
          <div style={{ ...innerStyle, background: theme.dark, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 80px', boxSizing: 'border-box' }}>
            <div style={{ color: theme.accent, fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 24 }}>
              {slide.subtitle || 'Key Insight'}
            </div>
            <div style={{ color: theme.text, fontSize: titleSize, fontWeight: 700, textAlign: 'center', lineHeight: 1.25, letterSpacing: '-0.02em', maxWidth: 720 }}>
              {titleText}
            </div>
            {bullets.length > 0 && (
              <div style={{ marginTop: 40, display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
                {bullets.map((b, i) => (
                  <div key={i} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '14px 20px', color: theme.textMuted, fontSize: 14, maxWidth: 260, lineHeight: 1.4 }}>
                    {b}
                  </div>
                ))}
              </div>
            )}
            <div style={{ position: 'absolute', bottom: 24, right: 40, color: theme.accent, fontSize: 11, letterSpacing: '0.12em', fontWeight: 600, opacity: 0.8 }}>
              PARAMOUNT · ADVERTISING SOLUTIONS
            </div>
          </div>
        </div>
      )
    }

    if (slide.type === 'section') {
      return (
        <div ref={ref} style={wrapperStyle}>
          <div style={{ ...innerStyle, background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.dark} 100%)`, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 80px', boxSizing: 'border-box' }}>
            <div style={{ width: 48, height: 3, background: theme.accent, marginBottom: 28, borderRadius: 2 }} />
            <div style={{ color: theme.text, fontSize: titleSize, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em', maxWidth: 700 }}>
              {titleText}
            </div>
            {slide.subtitle && (
              <div style={{ color: theme.textMuted, fontSize: 16, marginTop: 16 }}>{slide.subtitle}</div>
            )}
            <div style={{ position: 'absolute', bottom: 24, right: 40, color: theme.accent, fontSize: 11, letterSpacing: '0.12em', fontWeight: 600, opacity: 0.8 }}>
              PARAMOUNT · ADVERTISING SOLUTIONS
            </div>
          </div>
        </div>
      )
    }

    if (slide.type === 'closing') {
      return (
        <div ref={ref} style={wrapperStyle}>
          <div style={{ ...innerStyle, background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.dark} 100%)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 80px', boxSizing: 'border-box' }}>
            <div style={{ color: theme.accent, fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 24 }}>
              Next Steps
            </div>
            <div style={{ color: theme.text, fontSize: titleSize, fontWeight: 700, textAlign: 'center', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 20 }}>
              {titleText}
            </div>
            {bullets.length > 0 && (
              <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', maxWidth: 600 }}>
                {bullets.map((b, i) => (
                  <div key={i} style={{ color: theme.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 1.4 }}>{b}</div>
                ))}
              </div>
            )}
            <div style={{ marginTop: 40, width: 48, height: 3, background: theme.accent, borderRadius: 2 }} />
            <div style={{ position: 'absolute', bottom: 24, right: 40, color: theme.accent, fontSize: 11, letterSpacing: '0.12em', fontWeight: 600, opacity: 0.8 }}>
              PARAMOUNT · ADVERTISING SOLUTIONS
            </div>
          </div>
        </div>
      )
    }

    // Default: content type
    return (
      <div ref={ref} style={wrapperStyle}>
        <div style={{ ...innerStyle, background: '#FFFFFF', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
          {/* Top accent bar */}
          <div style={{ height: 4, background: `linear-gradient(90deg, ${theme.primary} 0%, ${theme.accent} 100%)`, flexShrink: 0 }} />
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {/* Left brand strip */}
            <div style={{ width: 6, background: theme.primary, flexShrink: 0 }} />
            <div style={{ flex: 1, padding: '32px 44px 28px 40px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Eyebrow */}
              {slide.subtitle && (
                <div style={{ color: theme.primary, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10, opacity: 0.7 }}>
                  {slide.subtitle}
                </div>
              )}
              {/* Title */}
              <div style={{ color: theme.primary, fontSize: titleSize, fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 24, flexShrink: 0 }}>
                {titleText}
              </div>
              {/* Divider */}
              <div style={{ height: 2, background: theme.accent, width: 40, marginBottom: 20, borderRadius: 1, flexShrink: 0 }} />
              {/* Bullets */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
                {bullets.map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: theme.accent, flexShrink: 0, marginTop: bodySize * 0.5 }} />
                    <div style={{ color: '#2D3748', fontSize: bodySize, lineHeight: 1.5, flex: 1 }}>{b}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Footer */}
          <div style={{ height: 32, background: theme.primary, display: 'flex', alignItems: 'center', paddingRight: 24, justifyContent: 'flex-end', flexShrink: 0 }}>
            <span style={{ color: theme.accent, fontSize: 10, letterSpacing: '0.12em', fontWeight: 600 }}>
              PARAMOUNT · ADVERTISING SOLUTIONS
            </span>
          </div>
        </div>
      </div>
    )
  }
)

SlideCanvasRenderer.displayName = 'SlideCanvasRenderer'

export default SlideCanvasRenderer
