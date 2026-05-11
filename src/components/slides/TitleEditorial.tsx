import { Pad, RULE, Type, typeStyle } from '../../utils/design/system'
import type { VariantProps } from './types'
import { effectiveTitle, effectiveEyebrow } from './types'

/**
 * Title slide — editorial register.
 * Serif headline, generous whitespace, one thin accent rule above the title.
 * No gradients, no pill bullets, no corner-mark decorations.
 */
export default function TitleEditorial({ slide, theme, overrides }: VariantProps) {
  const title = effectiveTitle(slide, overrides)
  const eyebrow = effectiveEyebrow(slide, overrides)

  return (
    <div style={{
      position: 'absolute', inset: 0,
      padding: `${Pad.generous.top}px ${Pad.generous.right}px ${Pad.generous.bottom}px ${Pad.generous.left}px`,
      display: 'flex', flexDirection: 'column', justifyContent: 'center', boxSizing: 'border-box',
    }}>
      {/* Single accent rule above title */}
      <div style={{
        width: RULE.medium,
        height: RULE.thickness,
        background: theme.accent,
        marginBottom: 48,
      }} />

      {eyebrow && (
        <div style={{
          ...typeStyle('eyebrow'),
          color: theme.mute,
          marginBottom: 32,
        }}>
          {eyebrow}
        </div>
      )}

      <h1 className="slide-headline" style={{
        ...typeStyle('h1'),
        color: theme.ink,
        margin: 0,
        maxWidth: 1500,
      }}>
        {title}
      </h1>

      {/* Footer credit on title slide ONLY — single accent rule worth allowing */}
      <div style={{
        marginTop: 'auto',
        paddingTop: 64,
        display: 'flex', alignItems: 'baseline', gap: 24,
      }}>
        <div style={{ width: RULE.short, height: 2, background: theme.accent }} />
        <span style={{
          ...typeStyle('caption'),
          color: theme.mute,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          fontSize: Type.caption.size - 2,
        }}>
          Paramount Advertising
        </span>
      </div>
    </div>
  )
}
