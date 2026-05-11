import { Pad, typeStyle, Space, muteColor } from '../../utils/design/system'
import type { VariantProps } from './types'
import { effectiveTitle, effectiveEyebrow, effectiveBullets } from './types'

/**
 * One sentence, very large, ample whitespace. The "money slide."
 * Ink background — breaks the deck's visual rhythm and signals importance.
 * No bullet list, no accent rule, no decoration. Type carries everything.
 */
export default function ImpactStatement({ slide, theme, overrides }: VariantProps) {
  const title = effectiveTitle(slide, overrides)
  const eyebrow = effectiveEyebrow(slide, overrides) || 'Key insight'
  const bullets = effectiveBullets(slide, overrides)
  const supporting = bullets[0] && bullets[0] !== title ? bullets[0] : undefined

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
        {eyebrow}
      </div>

      <h2 className="slide-headline" style={{
        ...typeStyle('h1'),
        color: theme.paper,
        margin: 0,
        maxWidth: 1500,
        fontWeight: 600,
      }}>
        {title}
      </h2>

      {supporting && (
        <div style={{
          ...typeStyle('bodyLarge'),
          color: muteColor(theme, 'ink'),
          marginTop: Space.xl,
          maxWidth: 1200,
        }}>
          {supporting}
        </div>
      )}
    </div>
  )
}
