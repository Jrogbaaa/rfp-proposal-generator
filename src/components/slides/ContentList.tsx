import { Pad, RULE, typeStyle, Space } from '../../utils/design/system'
import type { VariantProps } from './types'
import { effectiveTitle, effectiveEyebrow, effectiveBullets } from './types'

/**
 * Standard content slide: title + bullet list, on paper background.
 * No cards, no rounded corners, no left-border accent (the trope).
 * One thin accent rule under the title — that is the entire decoration.
 */
export default function ContentList({ slide, theme, overrides }: VariantProps) {
  const title = effectiveTitle(slide, overrides)
  const eyebrow = effectiveEyebrow(slide, overrides)
  const bullets = effectiveBullets(slide, overrides)
  const density = overrides?.density ?? 'balanced'

  // Body sized by density so reviewer can tighten over-stuffed slides.
  const bodyRole: 'body' | 'bodyLarge' = density === 'sparse' ? 'bodyLarge' : 'body'

  return (
    <div style={{
      position: 'absolute', inset: 0,
      padding: `${Pad.balanced.top}px ${Pad.balanced.right}px ${Pad.balanced.bottom}px ${Pad.balanced.left}px`,
      display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
    }}>
      {eyebrow && (
        <div style={{ ...typeStyle('eyebrow'), color: theme.accent, marginBottom: Space.m }}>
          {eyebrow}
        </div>
      )}

      <h2 className="slide-headline" style={{
        ...typeStyle('h2'),
        color: theme.ink,
        margin: 0,
        marginBottom: Space.l,
        maxWidth: 1500,
      }}>
        {title}
      </h2>

      {/* Single accent rule */}
      <div style={{
        width: RULE.medium,
        height: RULE.thickness,
        background: theme.accent,
        marginBottom: Space.xl,
      }} />

      <ol style={{
        margin: 0, padding: 0, listStyle: 'none',
        display: 'flex', flexDirection: 'column', gap: Space.l,
        maxWidth: 1500,
      }}>
        {bullets.map((b, i) => (
          <li key={i} style={{
            ...typeStyle(bodyRole),
            color: theme.ink,
            display: 'flex',
            gap: Space.m,
            alignItems: 'baseline',
          }}>
            <span style={{
              ...typeStyle('caption'),
              color: theme.accent,
              fontWeight: 700,
              minWidth: 44,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{ flex: 1 }}>{b}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
