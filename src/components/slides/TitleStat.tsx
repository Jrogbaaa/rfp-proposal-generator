import { Pad, RULE, typeStyle } from '../../utils/design/system'
import type { VariantProps } from './types'
import { effectiveTitle, effectiveEyebrow, extractStat } from './types'

/**
 * Title slide variant where the subtitle contains a number worth heroing.
 * The number becomes the visual subject; the title becomes the caption.
 */
export default function TitleStat({ slide, theme, overrides }: VariantProps) {
  const title = effectiveTitle(slide, overrides)
  const eyebrow = effectiveEyebrow(slide, overrides)
  const promoted = overrides?.promotedStat
  const stat = promoted?.value || (slide.subtitle && extractStat(slide.subtitle)) || ''
  const caption = promoted?.caption || title

  return (
    <div style={{
      position: 'absolute', inset: 0,
      padding: `${Pad.generous.top}px ${Pad.generous.right}px ${Pad.generous.bottom}px ${Pad.generous.left}px`,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box',
    }}>
      {eyebrow && (
        <div style={{
          ...typeStyle('eyebrow'),
          color: theme.accent,
          marginBottom: 48,
        }}>
          {eyebrow}
        </div>
      )}

      {/* Hero number */}
      <div style={{
        ...typeStyle('numeralXL'),
        color: theme.ink,
        marginBottom: 32,
      }}>
        {stat || title}
      </div>

      {/* Caption / framing line */}
      {stat && (
        <div style={{
          ...typeStyle('h4'),
          color: theme.ink,
          fontWeight: 400,
          maxWidth: 1200,
          margin: 0,
        }}>
          {caption}
        </div>
      )}

      <div style={{
        marginTop: 'auto', paddingTop: 64,
        width: RULE.medium, height: RULE.thickness, background: theme.accent,
      }} />
    </div>
  )
}
