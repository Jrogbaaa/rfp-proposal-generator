import { Pad, typeStyle, muteColor } from '../../utils/design/system'
import type { VariantProps } from './types'
import { effectiveTitle, effectiveEyebrow } from './types'

/**
 * Section divider. The one place a giant numeral is the slide.
 * Ink background to break visual rhythm between content blocks.
 */
export default function SectionNumeral({ slide, theme, overrides }: VariantProps) {
  const title = effectiveTitle(slide, overrides)
  const eyebrow = effectiveEyebrow(slide, overrides)
  const numeral = String(slide.slideNumber ?? 1).padStart(2, '0')

  return (
    <div style={{
      position: 'absolute', inset: 0,
      padding: `${Pad.generous.top}px ${Pad.generous.right}px ${Pad.generous.bottom}px ${Pad.generous.left}px`,
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      boxSizing: 'border-box',
    }}>
      {/* Faint giant numeral, sized by the type scale — single accent gesture */}
      <div style={{
        ...typeStyle('numeralXL'),
        color: 'rgba(255,255,255,0.06)',
        position: 'absolute',
        right: Pad.generous.right - 40,
        top: Pad.generous.top - 40,
        userSelect: 'none',
        pointerEvents: 'none',
      }}>
        {numeral}
      </div>

      {eyebrow && (
        <div style={{
          ...typeStyle('eyebrow'),
          color: theme.accent,
          marginBottom: 32,
        }}>
          {eyebrow}
        </div>
      )}

      <h2 className="slide-headline" style={{
        ...typeStyle('h2'),
        color: theme.paper,
        margin: 0,
        maxWidth: 1400,
      }}>
        {title}
      </h2>

      <div style={{
        ...typeStyle('caption'),
        color: muteColor(theme, 'ink'),
        marginTop: 32,
      }}>
        Section {numeral}
      </div>
    </div>
  )
}
