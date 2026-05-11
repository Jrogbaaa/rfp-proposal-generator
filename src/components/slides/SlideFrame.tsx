import { forwardRef, type CSSProperties, type ReactNode } from 'react'
import { SLIDE_W, SLIDE_H, bgColor, fgColor, type ThemeColors, type BgMode } from '../../utils/design/system'

interface SlideFrameProps {
  theme: ThemeColors
  bg: BgMode
  scale?: number
  children: ReactNode
}

/**
 * Outer 1920x1080 slide canvas. Owns scaling for display, background fill,
 * default text color, and ref forwarding for html2canvas.
 *
 * Variants render inside as absolute-positioned content; they should not
 * set their own background or width/height.
 */
const SlideFrame = forwardRef<HTMLDivElement, SlideFrameProps>(
  ({ theme, bg, scale = 1, children }, ref) => {
    const wrapper: CSSProperties = {
      width: SLIDE_W * scale,
      height: SLIDE_H * scale,
      overflow: 'hidden',
      flexShrink: 0,
      position: 'relative',
    }

    const inner: CSSProperties = {
      width: SLIDE_W,
      height: SLIDE_H,
      transformOrigin: 'top left',
      transform: scale !== 1 ? `scale(${scale})` : undefined,
      position: 'absolute',
      top: 0,
      left: 0,
      background: bgColor(theme, bg),
      color: fgColor(theme, bg),
      overflow: 'hidden',
    }

    return (
      <div ref={ref} style={wrapper} className="slide-canvas">
        <div style={inner}>{children}</div>
      </div>
    )
  },
)

SlideFrame.displayName = 'SlideFrame'
export default SlideFrame
