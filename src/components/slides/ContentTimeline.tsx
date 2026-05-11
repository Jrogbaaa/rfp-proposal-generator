import { Pad, typeStyle, Space } from '../../utils/design/system'
import type { VariantProps } from './types'
import { effectiveTitle, effectiveEyebrow, effectiveBullets } from './types'

/**
 * Ordered steps laid out horizontally. Each step = numeral + caption.
 * Connected by a single thin rule that runs through all steps.
 * Used when content is a sequence (approach, process, "how it works").
 */
export default function ContentTimeline({ slide, theme, overrides }: VariantProps) {
  const title = effectiveTitle(slide, overrides)
  const eyebrow = effectiveEyebrow(slide, overrides)
  const steps = effectiveBullets(slide, overrides).slice(0, 5)

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
      }}>
        {title}
      </h2>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
          gap: Space.xl,
          width: '100%',
          position: 'relative',
        }}>
          {/* Single rule that connects all steps */}
          <div style={{
            position: 'absolute',
            top: 36, left: 0, right: 0,
            height: 2,
            background: theme.accent,
            opacity: 0.5,
          }} />

          {steps.map((s, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <div style={{
                width: 72, height: 72,
                borderRadius: '50%',
                background: theme.ink,
                color: theme.paper,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...typeStyle('caption'),
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                marginBottom: Space.l,
              }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <div style={{
                ...typeStyle('body'),
                color: theme.ink,
                maxWidth: 360,
              }}>
                {s}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
