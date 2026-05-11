import { Pad, RULE, typeStyle, Space, muteColor } from '../../utils/design/system'
import type { VariantProps } from './types'
import { effectiveTitle, effectiveBullets } from './types'

/**
 * Closing slide — call to action. Ink background, minimal decoration.
 * One short next-step line at the top, a clear CTA in the middle, attribution
 * footer at the bottom. No corner marks, no double-decorated treatments.
 */
export default function ClosingCta({ slide, theme, overrides }: VariantProps) {
  const title = effectiveTitle(slide, overrides)
  const bullets = effectiveBullets(slide, overrides).slice(0, 3)
  const company = slide.subtitle?.trim()

  return (
    <div style={{
      position: 'absolute', inset: 0,
      padding: `${Pad.generous.top}px ${Pad.generous.right}px ${Pad.generous.bottom}px ${Pad.generous.left}px`,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      boxSizing: 'border-box',
    }}>
      <div style={{
        ...typeStyle('eyebrow'),
        color: theme.accent,
        marginBottom: Space.xl,
      }}>
        Next Steps
      </div>

      <h2 className="slide-headline" style={{
        ...typeStyle('h1'),
        color: theme.paper,
        margin: 0,
        marginBottom: Space.xl,
        maxWidth: 1500,
      }}>
        {title}
      </h2>

      <div style={{
        width: RULE.medium, height: RULE.thickness,
        background: theme.accent,
        marginBottom: Space.xl,
      }} />

      {bullets.length > 0 && (
        <ul style={{
          margin: 0, padding: 0, listStyle: 'none',
          display: 'flex', flexDirection: 'column', gap: Space.m,
          maxWidth: 1400,
        }}>
          {bullets.map((b, i) => (
            <li key={i} style={{
              ...typeStyle('bodyLarge'),
              color: muteColor(theme, 'ink'),
            }}>
              {b}
            </li>
          ))}
        </ul>
      )}

      {company && (
        <div style={{
          marginTop: 'auto', paddingTop: Space.xxl,
          display: 'flex', alignItems: 'baseline', gap: Space.m,
        }}>
          <span style={{
            ...typeStyle('caption'),
            color: theme.accent,
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
          }}>
            {company}
          </span>
        </div>
      )}
    </div>
  )
}
