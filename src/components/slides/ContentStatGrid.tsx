import { Pad, RULE, typeStyle, Space } from '../../utils/design/system'
import type { VariantProps } from './types'
import { effectiveTitle, effectiveEyebrow, effectiveBullets, extractStat } from './types'

/**
 * 2-4 stat tiles. Each tile = big numeric token + caption.
 * No cards, no rounded corners. Tiles divided by whitespace and a single
 * underline rule per tile — never a left-border-accent box.
 */
export default function ContentStatGrid({ slide, theme, overrides }: VariantProps) {
  const title = effectiveTitle(slide, overrides)
  const eyebrow = effectiveEyebrow(slide, overrides)
  const bullets = effectiveBullets(slide, overrides).slice(0, 4)

  const tiles = bullets.map(b => {
    const stat = extractStat(b) ?? ''
    const rest = stat ? b.replace(stat, '').trim().replace(/^[—–\-:]\s*/, '') : b
    return { stat: stat || b.slice(0, 6), caption: stat ? rest : '' }
  })

  const cols = tiles.length <= 2 ? 2 : tiles.length === 3 ? 3 : 2

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
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: Space.xxl,
        alignContent: 'center',
      }}>
        {tiles.map((t, i) => (
          <div key={i}>
            <div style={{
              ...typeStyle(tiles.length <= 2 ? 'numeralL' : 'numeralM'),
              color: theme.ink,
              marginBottom: Space.s,
            }}>
              {t.stat}
            </div>
            <div style={{
              width: RULE.short, height: 2,
              background: theme.accent,
              marginBottom: Space.m,
            }} />
            {t.caption && (
              <div style={{ ...typeStyle('body'), color: theme.mute }}>
                {t.caption}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
