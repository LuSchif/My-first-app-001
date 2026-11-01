import type { ReactNode } from 'react'

/**
 * Broomit's own icons, drawn on a 24 px grid with round lines. Each is drawn once and painted in
 * one of two ways: as lines only (the usual look), or in color for a tool in use, with a cream
 * body and caramel details. Pens show their current ink at the tip in both looks.
 */
export interface Paint {
  /** The body of a thing: cream in color, otherwise the background (so lines behind it hide). */
  fill: string
  /** A second, softer body (cards and sheets behind others). */
  soft: string
  /** Details filled in color (bands, a tab, a bar); empty otherwise. */
  accent: string
  /** Details drawn as lines: caramel in color, otherwise the line color. */
  accentLine: string
  /** Small solid details (a sun, a drop): caramel in color, otherwise the line color. */
  solid: string
  /** A pen's tip: the ink it writes with. */
  tip: string
}

export function paintFor(colored: boolean, tip?: string): Paint {
  const bg = 'var(--icon-bg, var(--color-surface-raised))'
  return colored
    ? {
        fill: 'var(--color-icon-fill)',
        soft: 'var(--color-icon-soft)',
        accent: 'var(--color-icon-accent)',
        accentLine: 'var(--color-icon-accent)',
        solid: 'var(--color-icon-accent)',
        tip: tip ?? 'var(--color-icon-accent)',
      }
    : {
        fill: bg,
        soft: bg,
        accent: bg,
        accentLine: 'currentColor',
        solid: 'currentColor',
        tip: tip ?? bg,
      }
}

type Glyph = (p: Paint) => ReactNode

/** Pens lean with the tip down to the left, as when writing. */
const lean = (children: ReactNode, angle = 45) => (
  <g transform={`rotate(${angle} 12 12) translate(12 12) scale(1.08) translate(-12 -12)`}>
    {children}
  </g>
)

const ballpoint = (p: Paint) =>
  lean(
    <>
      <rect x="9.5" y="1.8" width="5" height="13.4" rx="2.5" fill={p.fill} />
      <path d="M15.7 3.2v6.4" />
      <path d="M9.6 10.8h4.8M9.6 12.6h4.8" stroke={p.accentLine} />
      <path d="M9.6 15.2 11 18.6h2l1.4-3.4Z" fill={p.fill} />
      <path d="M11 18.6 12 21.6l1-3Z" fill={p.tip} />
    </>,
  )

const fountain = (p: Paint) =>
  lean(
    <>
      <rect x="9.5" y="1.8" width="5" height="10.6" rx="2.5" fill={p.fill} />
      <path d="M9.6 8.6h4.8M9.6 10.3h4.8" stroke={p.accentLine} />
      <path d="M9.6 12.4c0 3 1.2 6 2.4 9.4 1.2-3.4 2.4-6.4 2.4-9.4Z" fill={p.fill} />
      <path d="M11.1 18.4 12 21.8l.9-3.4Z" fill={p.tip} stroke="none" />
      <path d="M12 21.4v-4.2" />
      <circle cx="12" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
    </>,
  )

/** A four-pointed sparkle around (x, y). */
const sparkle = (p: Paint, x: number, y: number, r = 3) => (
  <path
    d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`}
    fill={p.solid}
    strokeWidth="1.2"
  />
)

const cursor = (p: Paint) => (
  <path d="M13.6 12.4 14.4 21l2.1-2.2 1.9 3.1 1.5-.9-1.9-3.1 3-.4Z" fill={p.fill} />
)

const plusBadge = (p: Paint) => (
  <>
    <circle cx="18.2" cy="18.2" r="4.6" fill={p.accent === p.fill ? p.fill : p.accent} />
    <path d="M18.2 16v4.4M16 18.2h4.4" strokeWidth="1.9" />
  </>
)

const picture = (p: Paint, x: number, y: number, w: number, h: number) => (
  <>
    <rect x={x} y={y} width={w} height={h} rx="1.6" fill={p.fill} />
    <path
      d={`M${x} ${y + h - 1.5}l${w * 0.3} -${h * 0.42} ${w * 0.22} ${h * 0.3} ${w * 0.14} -${h * 0.16} ${w * 0.34} ${h * 0.28}`}
    />
    <circle
      cx={x + w * 0.72}
      cy={y + h * 0.3}
      r={Math.min(w, h) * 0.12}
      fill={p.solid}
      stroke="none"
    />
  </>
)

const folderBack = (p: Paint) => (
  <>
    <path
      d="M7.5 3.5h3.4l1.8 2.1h6.8A1.5 1.5 0 0 1 21 7.1v9.1a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 6 16.2V5a1.5 1.5 0 0 1 1.5-1.5Z"
      fill={p.soft}
    />
    <path d="M7.5 3.5h3.4l1.8 2.1H6V5a1.5 1.5 0 0 1 1.5-1.5Z" fill={p.accent} />
  </>
)

const folderFront = (p: Paint) => (
  <path
    d="M4.5 7.6h3.4l1.8 2.1h7.8a1.5 1.5 0 0 1 1.5 1.5v8.3a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 19.5V9.1a1.5 1.5 0 0 1 1.5-1.5Z"
    fill={p.fill}
  />
)

const quiz = (p: Paint) => (
  <>
    <rect x="3" y="3" width="18" height="18" rx="2.2" fill={p.fill} />
    <path d="M10.6 7.4a1.5 1.5 0 1 1 2.1 1.4c-.4.2-.7.6-.7 1v.5" />
    <circle cx="12" cy="12.3" r="0.8" fill="currentColor" stroke="none" />
    <circle cx="7.4" cy="14.6" r="1.1" />
    <circle cx="7.4" cy="18.6" r="1.1" />
    <path d="M10.2 14.6h7.4M10.2 18.6h7.4" stroke={p.accentLine} />
  </>
)

const cards = (p: Paint) => (
  <>
    <rect
      x="8.6"
      y="3"
      width="12.4"
      height="10.4"
      rx="1.6"
      fill={p.soft}
      transform="rotate(7 14.8 8.2)"
    />
    <rect x="3" y="7.2" width="13" height="11" rx="1.6" fill={p.fill} />
    <path d="M7.4 15.6 9.5 10l2.1 5.6M8.2 13.8h2.6" />
  </>
)

const board = (p: Paint) => (
  <>
    <rect x="2.5" y="3" width="19" height="2.4" rx="1" fill={p.fill} />
    <rect x="3.6" y="5.4" width="16.8" height="11" fill={p.fill} />
    <path d="M6.4 8.3h5.6" stroke={p.accentLine} strokeWidth="2.2" />
    <path d="M7.6 11h8.4M7.6 13.5h6.4" stroke={p.accentLine} />
    <circle cx="6.4" cy="11" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="6.4" cy="13.5" r="0.5" fill="currentColor" stroke="none" />
    <path d="M12 16.4v2.6M12 19l-3.4 2.6M12 19l3.4 2.6" />
  </>
)

export const GLYPHS = {
  // Tools
  pen: ballpoint,
  fountain,
  magic: (p) => (
    <>
      {fountain(p)}
      {sparkle(p, 19.2, 13.6, 2.8)}
    </>
  ),
  highlighter: (p) => (
    <>
      {lean(
        <>
          <rect x="9" y="1.6" width="6" height="11.4" rx="2" fill={p.fill} />
          <path d="M9.1 8.4h5.8M9.1 10.2h5.8" stroke={p.accentLine} />
          <path d="M9 13h6v2.2H9Z" fill={p.fill} />
          <path d="M10.3 15.2v3.6l3.4-1.6v-2Z" fill={p.tip} />
        </>,
      )}
      <path d="M2.6 21.4h5.6" stroke={p.accentLine} strokeWidth="2.4" />
    </>
  ),
  broom: (p) =>
    lean(
      <>
        <rect x="10.8" y="0.8" width="2.4" height="9.6" rx="1.2" fill={p.fill} />
        <rect x="9.4" y="10.2" width="5.2" height="2.6" rx="0.7" fill={p.accent} />
        <path d="M9.5 12.8 4.6 20.6c2.4 1.6 4.9 2.3 7.4 2.3s5-.7 7.4-2.3l-4.9-7.8Z" fill={p.fill} />
        <path d="M9.4 16.6 7.8 20.6M12 16.6v5M14.6 16.6l1.6 4" stroke={p.accentLine} />
      </>,
      40,
    ),
  magnifier: (p) => (
    <>
      <rect
        x="14.4"
        y="12.6"
        width="8.2"
        height="3.6"
        rx="1.8"
        fill={p.fill}
        transform="rotate(45 14.4 14.4)"
      />
      <path d="M17.2 15.1 15.3 17M18.3 16.2 16.4 18.1" stroke={p.accentLine} />
      <circle cx="10" cy="10" r="6.6" fill={p.fill} />
      <path d="M10 7v6M7 10h6" strokeWidth="2" />
    </>
  ),
  tape: (p) => (
    <g transform="rotate(-28 12 12)">
      <path
        d="M4 8.6h16l1.4 1.4-1.4 1.4 1.4 1.4-1.4 1.4 1.4 1.4-1.4 1.4H4l1.4-1.4L4 13.8l1.4-1.4L4 11l1.4-1.4Z"
        fill={p.fill}
      />
      <path d="M13.2 8.6v7.8M15 8.6v7.8" stroke={p.accentLine} />
    </g>
  ),
  laser: (p) => (
    <>
      {lean(
        <>
          <rect x="9.8" y="0.6" width="4.4" height="11.6" rx="2.2" fill={p.fill} />
          <path d="M9.9 7.8h4.2M9.9 9.4h4.2" stroke={p.accentLine} />
          <path d="M10.8 12.2h2.4l-.5 1.6h-1.4Z" fill={p.fill} />
          <path d="M12 13.8v4.6" stroke={p.accentLine} strokeWidth="1.6" />
        </>,
      )}
      <circle cx="5" cy="19" r="2.2" fill={p.fill} />
      <circle cx="5" cy="19" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  lasso: (p) => (
    <>
      <path
        d="M11 3.4c-4.3-.3-7.8 2.4-7.9 5.6-.1 3.3 3 5.8 6.6 6.1 1.6.1 2.4-.4 2.7-1.5"
        strokeDasharray="2.2 2.2"
      />
      <path d="M14.4 4.3c2.2 1 3.4 2.9 3.2 5.2" strokeDasharray="2.2 2.2" />
      {cursor(p)}
    </>
  ),
  selection: (p) => (
    <>
      <rect x="2.6" y="3.6" width="15.6" height="12" rx="0.8" strokeDasharray="2.2 2.2" />
      {cursor(p)}
    </>
  ),
  anchor: (p) => (
    <>
      <path d="M5 18.6c3.4 0 4-6.6 7-6.6s3.2-6.6 7-6.6" />
      <circle cx="4.4" cy="18.6" r="2" fill={p.fill} />
      <circle cx="12" cy="12" r="2" fill={p.fill} />
      <circle cx="19.6" cy="5.4" r="2" fill={p.fill} />
      <circle cx="4.4" cy="18.6" r="0.8" fill={p.solid} stroke="none" />
      <circle cx="12" cy="12" r="0.8" fill={p.solid} stroke="none" />
      <circle cx="19.6" cy="5.4" r="0.8" fill={p.solid} stroke="none" />
    </>
  ),

  // Interface
  layers: (p) => (
    <>
      <path d="M12 11.2 21 16l-9 4.8L3 16Z" fill={p.accent} />
      <path d="M12 7.2 21 12l-9 4.8L3 12Z" fill={p.fill} />
      <path d="M12 3.2 21 8l-9 4.8L3 8Z" fill={p.fill} />
    </>
  ),
  pages: (p) => (
    <>
      <path
        d="M9.4 2.5h6.1l3.5 3.5v10.9a1.2 1.2 0 0 1-1.2 1.2H9.4a1.2 1.2 0 0 1-1.2-1.2V3.7a1.2 1.2 0 0 1 1.2-1.2Z"
        fill={p.soft}
      />
      <path
        d="M6.2 5.6h6.1l3.5 3.5v10.9a1.2 1.2 0 0 1-1.2 1.2H6.2A1.2 1.2 0 0 1 5 20V6.8a1.2 1.2 0 0 1 1.2-1.2Z"
        fill={p.fill}
      />
      <path d="M12.3 5.6v3.5h3.5" />
      <path d="M7.6 13.4h5M7.6 16.4h3.6" stroke={p.accentLine} />
    </>
  ),
  settings: (p) => (
    <>
      <path
        d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z"
        fill={p.fill}
      />
      <circle cx="12" cy="12" r="3.2" fill={p.accent} />
    </>
  ),
  eyedropper: (p) => (
    <>
      {lean(
        <>
          <rect x="9.9" y="1" width="4.2" height="5.4" rx="2.1" fill={p.fill} />
          <rect x="8.6" y="6.4" width="6.8" height="2.4" rx="1" fill={p.fill} />
          <path d="M10.4 8.8v6.6l1.6 2.6 1.6-2.6V8.8" fill={p.fill} />
          <path d="M10.5 11h3" stroke={p.accentLine} />
        </>,
      )}
      <path
        d="M4.4 17.6c-1 1.4-1.5 2.4-1.5 3.1a1.5 1.5 0 0 0 3 0c0-.7-.5-1.7-1.5-3.1Z"
        fill={p.solid}
        stroke="none"
      />
    </>
  ),
  shapes: (p) => (
    <>
      <rect
        x="3.4"
        y="3.6"
        width="7.2"
        height="7.2"
        rx="1.6"
        fill={p.fill}
        transform="rotate(-16 7 7.2)"
      />
      <circle cx="17.2" cy="7.4" r="3.9" fill={p.accent} />
      <path
        d="M12.6 11.8a1 1 0 0 1 1.7 0l4.6 8a1 1 0 0 1-.9 1.5H8.8a1 1 0 0 1-.9-1.5Z"
        fill={p.fill}
      />
    </>
  ),
  table: (p) => (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="1.8" fill={p.fill} />
      <path
        d="M4.3 4.5h15.4a1.8 1.8 0 0 1 1.8 1.8v3.2h-19V6.3a1.8 1.8 0 0 1 1.8-1.8Z"
        fill={p.accent}
      />
      <path d="M2.5 9.5h19M2.5 14.5h19M8.8 4.5v15M15.2 4.5v15" />
    </>
  ),
  chart: (p) => (
    <>
      <rect x="4" y="13" width="4" height="7.5" rx="1" fill={p.fill} />
      <rect x="10" y="8.6" width="4" height="11.9" rx="1" fill={p.accent} />
      <rect x="16" y="3.6" width="4" height="16.9" rx="1" fill={p.soft} />
      <path d="M2.4 20.5h19.2" />
    </>
  ),
  sticker: (p) => (
    <>
      <path
        d="M5 3h12.2A2.8 2.8 0 0 1 20 5.8v7.6l-6.6 6.6H5A2.8 2.8 0 0 1 2.2 17.2V5.8A2.8 2.8 0 0 1 5 3Z"
        fill={p.fill}
      />
      <path d="M20 13.4h-3.8a2.8 2.8 0 0 0-2.8 2.8V20" fill={p.soft} />
      <circle cx="8.6" cy="9" r="1" fill="currentColor" stroke="none" />
      <circle cx="13.6" cy="9" r="1" fill="currentColor" stroke="none" />
      <path d="M8 12.6c1.7 1.6 4.5 1.6 6.2 0" />
    </>
  ),
  photo: (p) => picture(p, 2.5, 4.5, 19, 15),
  photos: (p) => (
    <>
      <rect
        x="8.2"
        y="2.4"
        width="12.6"
        height="10.6"
        rx="1.6"
        fill={p.soft}
        transform="rotate(8 14.5 7.7)"
      />
      <rect x="5.6" y="4.4" width="12.6" height="10.6" rx="1.6" fill={p.soft} />
      {picture(p, 2.6, 8, 13.2, 11.6)}
    </>
  ),
  camera: (p) => (
    <>
      <path d="M4.6 5.2h2.6v1.8H4.6Z" fill={p.fill} />
      <path
        d="M3 8.6A1.6 1.6 0 0 1 4.6 7h3l1.6-2.6h5.6L16.4 7h3A1.6 1.6 0 0 1 21 8.6v9.8a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 18.4Z"
        fill={p.fill}
      />
      <circle cx="12" cy="13.2" r="4" fill={p.fill} />
      <circle cx="12" cy="13.2" r="2.2" fill={p.accent} />
      <circle cx="18" cy="9.8" r="0.9" fill={p.solid} stroke="none" />
    </>
  ),
  folder: (p) => (
    <>
      {folderBack(p)}
      {folderFront(p)}
    </>
  ),

  // Library
  edit: (p) => (
    <>
      <g transform="translate(1.5 -1.2) scale(0.9)">{ballpoint(p)}</g>
      <path d="M2.6 21.6c2.4-1.6 4.6-1.6 6.4-.6s3.6.8 5.4-.6" stroke={p.accentLine} />
    </>
  ),
  notebook: (p) => (
    <>
      <rect x="5" y="2.5" width="14" height="17.6" rx="1.6" fill={p.fill} />
      <path
        d="M6.6 2.5H8.4v17.6H6.6A1.6 1.6 0 0 1 5 18.5V4.1a1.6 1.6 0 0 1 1.6-1.6Z"
        fill={p.accent}
      />
      <rect x="10.6" y="5.6" width="5.8" height="2.8" rx="0.5" fill={p.soft} />
      <path d="M10.2 20.1v3l1.3-1 1.3 1v-3" fill={p.accent} />
    </>
  ),
  presentation: board,
  flashcards: cards,
  quiz,
  shop: (p) => (
    <>
      <path d="M5 8h14l1.2 12.4a1 1 0 0 1-1 1.1H4.8a1 1 0 0 1-1-1.1Z" fill={p.fill} />
      <path d="M8.6 8V6.4a3.4 3.4 0 0 1 6.8 0V8" />
      <path d="m15.4 11.6 2.8-1.4 2.2 4.6-2.6 1.3-2.6-2Z" fill={p.accent} />
      <circle cx="17.2" cy="12.4" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  'new-folder': (p) => (
    <>
      {folderBack(p)}
      {folderFront(p)}
      {plusBadge(p)}
    </>
  ),
  'new-quiz': (p) => (
    <>
      {quiz(p)}
      {plusBadge(p)}
    </>
  ),
  'new-flashcards': (p) => (
    <>
      {cards(p)}
      {plusBadge(p)}
    </>
  ),
  'new-presentation': (p) => (
    <>
      {board(p)}
      {plusBadge(p)}
    </>
  ),
} satisfies Record<string, Glyph>

export type GlyphName = keyof typeof GLYPHS
