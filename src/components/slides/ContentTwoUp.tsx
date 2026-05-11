import { Pad, RULE, typeStyle, Space } from '../../utils/design/system'
import type { VariantProps } from './types'
import { effectiveTitle, effectiveEyebrow, effectiveBullets } from './types'

/**
 * Two parallel ideas, equal weight, with a single hairline rule between.
 * Used when content is exactly two bullets — comparison or "before/after"
 * structures.
 */
export default function ContentTwoUp({ slide, theme, overrides }: VariantProps) {
  const title = effectiveTitle(slide, overrides)
  const eyebrow = effectiveEyebrow(slide, overrides)
  const bullets = effectiveBullets(slide, overrides).slice(0, 2)
  const [a, b] = [bullets[0] ?? '', bullets[1] ?? '']

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
        ...typeStyle('h3'),
        color: theme.ink,
        margin: 0,
        marginBottom: Space.xl,
        maxWidth: 1500,
      }}>
        {title}
      </h2>

      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1px 1fr',
        gap: Space.xxl,
        alignItems: 'start',
        marginTop: Space.m,
      }}>
        <div>
          <div style={{
            ...typeStyle('eyebrow'),
            color: theme.mute,
            marginBottom: Space.s,
          }}>
            01
          </div>
          <div style={{ ...typeStyle('bodyLarge'), color: theme.ink }}>{a}</div>
        </div>

        {/* Hairline rule between columns — the single accent gesture */}
        <div style={{
          background: theme.accent,
          width: 2,
          height: '70%',
          alignSelf: 'center',
          opacity: 0.6,
        }} />

        <div>
          <div style={{
            ...typeStyle('eyebrow'),
            color: theme.mute,
            marginBottom: Space.s,
          }}>
            02
          </div>
          <div style={{ ...typeStyle('bodyLarge'), color: theme.ink }}>{b}</div>
        </div>
      </div>

      <div style={{
        width: RULE.short, height: RULE.thickness,
        background: theme.accent, marginTop: 'auto',
      }} />
    </div>
  )
}
