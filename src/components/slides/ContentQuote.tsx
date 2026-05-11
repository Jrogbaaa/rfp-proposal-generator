import { Pad, typeStyle, Space } from '../../utils/design/system'
import type { VariantProps } from './types'
import { effectiveTitle, effectiveBullets } from './types'

/**
 * Pulled quote layout. Used when a bullet is wrapped in quotes — promotes
 * it to the slide subject; the slide title becomes attribution.
 * Big oversized opening quote glyph as the only decorative gesture.
 */
export default function ContentQuote({ slide, theme, overrides }: VariantProps) {
  const title = effectiveTitle(slide, overrides)
  const bullets = effectiveBullets(slide, overrides)
  const quote = bullets.find(b => /^[“"'']/.test(b) || /[”"'']$/.test(b)) ?? bullets[0] ?? ''
  const stripped = quote.replace(/^[“"'']\s*/, '').replace(/\s*[”"'']$/, '')

  return (
    <div style={{
      position: 'absolute', inset: 0,
      padding: `${Pad.generous.top}px ${Pad.generous.right}px ${Pad.generous.bottom}px ${Pad.generous.left}px`,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      boxSizing: 'border-box',
    }}>
      {/* Oversized opening glyph */}
      <div style={{
        ...typeStyle('numeralL'),
        color: theme.accent,
        lineHeight: 0.8,
        marginBottom: Space.l,
        userSelect: 'none',
      }}>
        &ldquo;
      </div>

      <blockquote className="slide-headline" style={{
        ...typeStyle('h2'),
        color: theme.ink,
        fontWeight: 400,
        fontStyle: 'italic',
        margin: 0,
        maxWidth: 1500,
      }}>
        {stripped}
      </blockquote>

      <div style={{
        marginTop: Space.xl,
        display: 'flex', alignItems: 'baseline', gap: Space.m,
      }}>
        <div style={{ width: 56, height: 2, background: theme.accent }} />
        <span style={{
          ...typeStyle('caption'),
          color: theme.mute,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
        }}>
          {title}
        </span>
      </div>
    </div>
  )
}
