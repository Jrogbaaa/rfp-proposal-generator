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

const THEME_MAP: Record<string, {
  primary: string
  accent: string
  dark: string
  mid: string
  text: string
  textMuted: string
  textDark: string
  surface: string
}> = {
  'navy-gold': {
    primary: '#1B2A4A',
    accent: '#C9A84C',
    dark: '#0F1929',
    mid: '#243560',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.62)',
    textDark: '#1B2A4A',
    surface: '#F7F4EE',
  },
  'slate-blue': {
    primary: '#2C3E6B',
    accent: '#4A90D9',
    dark: '#1A2540',
    mid: '#374E85',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.62)',
    textDark: '#2C3E6B',
    surface: '#F4F6FA',
  },
  'forest-green': {
    primary: '#1B3A2D',
    accent: '#5CB85C',
    dark: '#0F2018',
    mid: '#234D3A',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.62)',
    textDark: '#1B3A2D',
    surface: '#F3F7F4',
  },
  'executive-dark': {
    primary: '#1A1A1A',
    accent: '#C0A882',
    dark: '#0D0D0D',
    mid: '#2A2A2A',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.55)',
    textDark: '#1A1A1A',
    surface: '#F5F2EE',
  },
  'paramount': {
    primary: '#003087',
    accent: '#F5C518',
    dark: '#001A4D',
    mid: '#003FAD',
    text: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.62)',
    textDark: '#003087',
    surface: '#F4F6FC',
  },
}

const SlideCanvasRenderer = forwardRef<HTMLDivElement, SlideCanvasRendererProps>(
  ({ slide, designConfig, overrides, scale = 1 }, ref) => {
    const theme = THEME_MAP[designConfig.colorTheme] ?? THEME_MAP['navy-gold']
    const isParamount = designConfig.colorTheme === 'paramount'

    const titleText = overrides?.titleText ?? slide.title
    const maxBullets = overrides?.maxBullets ?? 4
    const bullets = slide.bullets.slice(0, maxBullets)
    const titleSize = overrides?.titleFontSize ?? (
      slide.type === 'title' ? 48 :
      slide.type === 'impact' ? 44 :
      slide.type === 'section' ? 40 : 30
    )
    const bodySize = overrides?.bodyFontSize ?? 16

    const wrapper: React.CSSProperties = {
      width: SLIDE_W * scale,
      height: SLIDE_H * scale,
      overflow: 'hidden',
      flexShrink: 0,
      position: 'relative',
    }

    const inner: React.CSSProperties = {
      width: SLIDE_W,
      height: SLIDE_H,
      transformOrigin: 'top left',
      transform: scale !== 1 ? `scale(${scale})` : undefined,
      position: 'absolute',
      top: 0,
      left: 0,
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    }

    const paramountFooter = isParamount ? (
      <div style={{
        position: 'absolute', bottom: 20, right: 36,
        color: theme.accent, fontSize: 10, letterSpacing: '0.14em',
        fontWeight: 700, opacity: 0.85, textTransform: 'uppercase',
      }}>
        Paramount · Advertising Solutions
      </div>
    ) : null

    // ── TITLE slide ──────────────────────────────────────────────────────────
    if (slide.type === 'title') {
      return (
        <div ref={ref} style={wrapper}>
          <div style={{
            ...inner,
            background: `linear-gradient(150deg, ${theme.primary} 0%, ${theme.dark} 60%, ${theme.dark} 100%)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 96px',
            boxSizing: 'border-box',
            position: 'absolute',
          }}>
            {/* Decorative top-left corner mark */}
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: 6, height: '40%',
              background: theme.accent, opacity: 0.9,
            }} />
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: '25%', height: 6,
              background: theme.accent, opacity: 0.9,
            }} />

            {/* Eyebrow label */}
            {slide.subtitle && (
              <div style={{
                color: theme.accent,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginBottom: 28,
                opacity: 0.9,
              }}>
                {slide.subtitle}
              </div>
            )}

            {/* Main title */}
            <div style={{
              color: theme.text,
              fontSize: titleSize,
              fontWeight: 800,
              textAlign: 'center',
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              maxWidth: 720,
            }}>
              {titleText}
            </div>

            {/* Bullets as metadata pills */}
            {bullets.length > 0 && (
              <div style={{
                marginTop: 36,
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}>
                {bullets.map((b, i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: `1px solid rgba(255,255,255,0.12)`,
                    borderRadius: 4,
                    padding: '7px 16px',
                    color: theme.textMuted,
                    fontSize: 13,
                    letterSpacing: '0.02em',
                  }}>
                    {b}
                  </div>
                ))}
              </div>
            )}

            {/* Bottom decorative rule */}
            <div style={{
              position: 'absolute',
              bottom: 0, left: 0, right: 0,
              height: 4,
              background: `linear-gradient(90deg, ${theme.accent} 0%, transparent 60%)`,
            }} />

            {paramountFooter}
          </div>
        </div>
      )
    }

    // ── IMPACT slide (money slide / core insight) ─────────────────────────────
    if (slide.type === 'impact') {
      return (
        <div ref={ref} style={wrapper}>
          <div style={{
            ...inner,
            background: theme.dark,
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            position: 'absolute',
          }}>
            {/* Accent side-bar */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: 6, background: theme.accent,
            }} />

            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '56px 72px 56px 84px',
            }}>
              {/* Eyebrow */}
              <div style={{
                color: theme.accent,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginBottom: 20,
              }}>
                {slide.subtitle || 'Key Insight'}
              </div>

              {/* Big statement */}
              <div style={{
                color: theme.text,
                fontSize: titleSize,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.025em',
                maxWidth: 720,
                marginBottom: bullets.length > 0 ? 40 : 0,
              }}>
                {titleText}
              </div>

              {/* Supporting evidence tags */}
              {bullets.length > 0 && (
                <div style={{
                  display: 'flex',
                  gap: 16,
                  flexWrap: 'wrap',
                }}>
                  {bullets.map((b, i) => (
                    <div key={i} style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: `1px solid rgba(255,255,255,0.1)`,
                      borderRadius: 6,
                      padding: '10px 18px',
                      color: theme.textMuted,
                      fontSize: bodySize - 1,
                      lineHeight: 1.4,
                      maxWidth: 260,
                    }}>
                      {b}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {paramountFooter}
          </div>
        </div>
      )
    }

    // ── SECTION divider slide ─────────────────────────────────────────────────
    if (slide.type === 'section') {
      return (
        <div ref={ref} style={wrapper}>
          <div style={{
            ...inner,
            background: `linear-gradient(135deg, ${theme.mid} 0%, ${theme.primary} 50%, ${theme.dark} 100%)`,
            display: 'flex',
            alignItems: 'center',
            boxSizing: 'border-box',
            position: 'absolute',
          }}>
            {/* Large section number watermark */}
            <div style={{
              position: 'absolute',
              right: 64,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 200,
              fontWeight: 900,
              color: 'rgba(255,255,255,0.04)',
              lineHeight: 1,
              letterSpacing: '-0.05em',
              userSelect: 'none',
            }}>
              {String(slide.slideNumber ?? 1).padStart(2, '0')}
            </div>

            <div style={{ padding: '60px 72px', flex: 1 }}>
              {/* Accent rule */}
              <div style={{
                width: 48, height: 4,
                background: theme.accent,
                borderRadius: 2,
                marginBottom: 24,
              }} />

              <div style={{
                color: theme.text,
                fontSize: titleSize,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.025em',
                maxWidth: 560,
              }}>
                {titleText}
              </div>

              {slide.subtitle && (
                <div style={{
                  color: theme.textMuted,
                  fontSize: 16,
                  marginTop: 18,
                  letterSpacing: '0.01em',
                }}>
                  {slide.subtitle}
                </div>
              )}
            </div>

            {paramountFooter}
          </div>
        </div>
      )
    }

    // ── CLOSING slide ──────────────────────────────────────────────────────────
    if (slide.type === 'closing') {
      return (
        <div ref={ref} style={wrapper}>
          <div style={{
            ...inner,
            background: theme.primary,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 96px',
            boxSizing: 'border-box',
            position: 'absolute',
          }}>
            {/* Decorative corner mark — bottom right */}
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 6, height: '35%',
              background: theme.accent, opacity: 0.9,
            }} />
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: '25%', height: 6,
              background: theme.accent, opacity: 0.9,
            }} />

            {/* Eyebrow */}
            <div style={{
              color: theme.accent,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              marginBottom: 24,
            }}>
              Next Steps
            </div>

            <div style={{
              color: theme.text,
              fontSize: titleSize,
              fontWeight: 800,
              textAlign: 'center',
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              maxWidth: 640,
              marginBottom: bullets.length > 0 ? 32 : 0,
            }}>
              {titleText}
            </div>

            {bullets.length > 0 && (
              <div style={{
                marginTop: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                alignItems: 'center',
                maxWidth: 560,
              }}>
                {bullets.map((b, i) => (
                  <div key={i} style={{
                    color: theme.textMuted,
                    fontSize: bodySize,
                    textAlign: 'center',
                    lineHeight: 1.4,
                  }}>
                    {b}
                  </div>
                ))}
              </div>
            )}

            {/* Company name if subtitle present */}
            {slide.subtitle && (
              <div style={{
                marginTop: 32,
                color: theme.accent,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                opacity: 0.8,
              }}>
                {slide.subtitle}
              </div>
            )}

            {paramountFooter}
          </div>
        </div>
      )
    }

    // ── CONTENT slides — 3 cycling layouts ────────────────────────────────────
    const variant = (slide.slideNumber ?? 1) % 3

    // Variant A: Two-column — wide title on left, bullets stacked on right
    if (variant === 0) {
      const half = Math.ceil(bullets.length / 2)
      const colA = bullets.slice(0, half)
      const colB = bullets.slice(half)
      return (
        <div ref={ref} style={wrapper}>
          <div style={{
            ...inner,
            background: theme.surface,
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            position: 'absolute',
          }}>
            {/* Top accent bar full-width */}
            <div style={{
              height: 5,
              background: `linear-gradient(90deg, ${theme.primary} 0%, ${theme.accent} 100%)`,
              flexShrink: 0,
            }} />

            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* Left dark column — title area */}
              <div style={{
                width: 340,
                background: theme.primary,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: '36px 36px 40px 40px',
                boxSizing: 'border-box',
              }}>
                {slide.subtitle && (
                  <div style={{
                    color: theme.accent,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    marginBottom: 12,
                    opacity: 0.85,
                  }}>
                    {slide.subtitle}
                  </div>
                )}
                <div style={{
                  color: theme.text,
                  fontSize: titleSize,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                }}>
                  {titleText}
                </div>
                <div style={{
                  width: 36, height: 3,
                  background: theme.accent,
                  borderRadius: 2,
                  marginTop: 20,
                }} />
              </div>

              {/* Right content area — two-column bullets */}
              <div style={{
                flex: 1,
                padding: '36px 40px 36px 44px',
                display: 'flex',
                gap: 28,
                boxSizing: 'border-box',
              }}>
                {[colA, colB].map((col, ci) => (
                  col.length > 0 && (
                    <div key={ci} style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                    }}>
                      {col.map((b, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{
                            width: 6, height: 6,
                            borderRadius: '50%',
                            background: theme.accent,
                            flexShrink: 0,
                            marginTop: bodySize * 0.45,
                          }} />
                          <div style={{
                            color: theme.textDark,
                            fontSize: bodySize,
                            lineHeight: 1.45,
                            flex: 1,
                            fontWeight: 400,
                          }}>
                            {b}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ))}
              </div>
            </div>

            {/* Bottom footer strip */}
            <div style={{
              height: 28,
              background: theme.primary,
              flexShrink: 0,
            }} />

            {paramountFooter}
          </div>
        </div>
      )
    }

    // Variant B: Hero-title with single column bullets — clean white, big headline
    if (variant === 1) {
      return (
        <div ref={ref} style={wrapper}>
          <div style={{
            ...inner,
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            boxSizing: 'border-box',
            position: 'absolute',
          }}>
            {/* Top accent band */}
            <div style={{ height: 4, background: theme.primary, flexShrink: 0 }} />

            <div style={{
              flex: 1,
              padding: '36px 56px 32px 56px',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}>
              {/* Eyebrow */}
              {slide.subtitle && (
                <div style={{
                  color: theme.primary,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  marginBottom: 12,
                  opacity: 0.6,
                }}>
                  {slide.subtitle}
                </div>
              )}

              {/* Large title */}
              <div style={{
                color: theme.primary,
                fontSize: titleSize,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: '-0.025em',
                marginBottom: 20,
                flexShrink: 0,
              }}>
                {titleText}
              </div>

              {/* Accent divider */}
              <div style={{
                width: 48, height: 3,
                background: theme.accent,
                borderRadius: 2,
                marginBottom: 24,
                flexShrink: 0,
              }} />

              {/* Bullets */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                overflow: 'hidden',
              }}>
                {bullets.map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 6, height: 6,
                      borderRadius: '50%',
                      background: theme.accent,
                      flexShrink: 0,
                      marginTop: bodySize * 0.48,
                    }} />
                    <div style={{
                      color: '#2D3748',
                      fontSize: bodySize,
                      lineHeight: 1.5,
                      flex: 1,
                    }}>
                      {b}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom colored strip */}
            <div style={{
              height: 6,
              background: `linear-gradient(90deg, ${theme.accent} 0%, ${theme.primary} 100%)`,
              flexShrink: 0,
            }} />

            {paramountFooter}
          </div>
        </div>
      )
    }

    // Variant C: Card grid — title + subtitle bar + bullets as bordered cards
    return (
      <div ref={ref} style={wrapper}>
        <div style={{
          ...inner,
          background: theme.surface,
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          position: 'absolute',
        }}>
          {/* Header band */}
          <div style={{
            background: theme.primary,
            padding: '28px 48px 24px',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}>
            {slide.subtitle && (
              <div style={{
                color: theme.accent,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                marginBottom: 8,
                opacity: 0.85,
              }}>
                {slide.subtitle}
              </div>
            )}
            <div style={{
              color: theme.text,
              fontSize: titleSize,
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
            }}>
              {titleText}
            </div>
          </div>

          {/* Card grid */}
          <div style={{
            flex: 1,
            padding: '28px 48px 24px',
            display: 'grid',
            gridTemplateColumns: bullets.length <= 2 ? '1fr 1fr' : bullets.length <= 4 ? '1fr 1fr' : '1fr 1fr 1fr',
            gap: 16,
            alignContent: 'start',
            boxSizing: 'border-box',
          }}>
            {bullets.map((b, i) => (
              <div key={i} style={{
                background: '#FFFFFF',
                border: `1px solid rgba(0,0,0,0.08)`,
                borderRadius: 6,
                padding: '14px 18px',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              }}>
                <div style={{
                  width: 4,
                  alignSelf: 'stretch',
                  background: theme.accent,
                  borderRadius: 2,
                  flexShrink: 0,
                }} />
                <div style={{
                  color: theme.textDark,
                  fontSize: bodySize - 1,
                  lineHeight: 1.45,
                  flex: 1,
                }}>
                  {b}
                </div>
              </div>
            ))}
          </div>

          {paramountFooter}
        </div>
      </div>
    )
  }
)

SlideCanvasRenderer.displayName = 'SlideCanvasRenderer'

export default SlideCanvasRenderer
