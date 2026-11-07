import type { ReactNode } from 'react'

/**
 * Broome's own icons, drawn on a 24 px grid with round white lines over soft grey bodies (see
 * tokens.css, --color-icon-*). For a tool in use the bodies turn blue-tinted and details blue.
 * Pens show their current ink at the tip in both looks.
 */
export interface Paint {
  /** The body of a thing: grey, blue-tinted in color. Opaque, so lines behind it hide. */
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

/**
 * The paints of an icon. They read CSS variables, so the colored look can be switched on by the
 * icon itself (`colored`) or by a chosen button around it (index.css); without them the icon is
 * lines only. Pens show `tip` in both looks.
 */
export function paintFor(tip?: string): Paint {
  return {
    fill: 'var(--bi-fill, var(--color-icon-fill))',
    soft: 'var(--bi-soft, var(--color-icon-soft))',
    accent: 'var(--bi-accent, var(--color-icon-soft))',
    accentLine: 'var(--bi-accent-line, currentColor)',
    solid: 'currentColor',
    tip: tip ?? 'var(--bi-accent, var(--color-icon-soft))',
  }
}

/** The CSS variables of the colored look. */
export const COLORED_VARS = {
  color: 'var(--color-icon-line)',
  '--bi-fill': 'var(--color-icon-active-fill)',
  '--bi-soft': 'var(--color-icon-soft)',
  '--bi-accent': 'var(--color-icon-accent)',
  '--bi-accent-line': 'var(--color-icon-accent)',
} as Record<string, string>

type Glyph = (p: Paint) => ReactNode

/** Pens lean with the tip down to the left, as when writing. */
const lean = (children: ReactNode, angle = 45) => (
  <g transform={`rotate(${angle} 12 12) translate(12 12) scale(1.08) translate(-12 -12)`}>
    {children}
  </g>
)

/**
 * The ballpoint, traced from Broome's tool sheet: drawn upright with the tip down, then turned
 * 45° so the tip points down to the left. A rounded button behind the top, the body with its
 * clip, the cone and the ball (which shows the ink).
 */
const ballpoint = (p: Paint) => (
  <g transform="rotate(45 12 12)" strokeWidth="0.55">
    <rect x="9.4" y="0.15" width="5.2" height="4" rx="1.3" fill={p.fill} />
    <path
      d="M8.5 4.05a1.1 1.1 0 0 1 1.1-1.1h4.8a1.1 1.1 0 0 1 1.1 1.1V16.3Q15.4 17.5 14.73 18.28H9.27Q8.6 17.5 8.5 16.3Z"
      fill={p.fill}
    />
    <rect x="10.88" y="2.28" width="1.88" height="8.26" rx="0.94" fill={p.fill} />
    <path d="M9.27 18.28 10.8 22.22h2.4l1.53-3.94Z" fill={p.fill} />
    <path d="M11.22 22.22v.83a.78.78 0 0 0 1.56 0v-.83Z" fill={p.tip} />
  </g>
)

const fountain = (p: Paint) =>
  lean(
    <>
      <rect x="8.4" y="1.2" width="7.2" height="11.6" rx="3.4" fill={p.fill} />
      <rect x="8.9" y="12.8" width="6.2" height="2.2" rx="0.6" fill={p.fill} />
      <path d="M9.1 15 9.6 19 12 22.8 14.4 19l.5-4Z" fill={p.tip} />
      <path d="M12 22.6v-3.6" />
      <circle cx="12" cy="18.2" r="0.9" fill="currentColor" stroke="none" />
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

const plusBadge = () => (
  <>
    <circle cx="18.2" cy="18.2" r="4.6" fill="var(--color-surface)" />
    <path d="M18.2 16v4.4M16 18.2h4.4" strokeWidth="1.9" />
  </>
)

const picture = (p: Paint, x: number, y: number, w: number, h: number) => (
  <>
    <rect x={x} y={y} width={w} height={h} rx="1.8" fill={p.fill} />
    <path
      d={`M${x + 0.6} ${y + h - 0.6}l${w * 0.3} -${h * 0.44} ${w * 0.2} ${h * 0.26} ${w * 0.14} -${h * 0.16} ${w * 0.34} ${h * 0.34}Z`}
      fill={p.soft}
    />
    <circle cx={x + w * 0.72} cy={y + h * 0.3} r={Math.min(w, h) * 0.14} fill={p.soft} />
  </>
)

/** The eraser: a block leaning to the right, with its rubber end in a lighter grey. */
const eraser = (p: Paint) => (
  <g transform="rotate(-38 12 12)">
    <rect x="3" y="7.6" width="18" height="8.8" rx="2.4" fill={p.fill} />
    <path d="M5.4 7.6h3.4v8.8H5.4A2.4 2.4 0 0 1 3 14V10a2.4 2.4 0 0 1 2.4-2.4Z" fill={p.accent} />
  </g>
)

/** A folder, moved by (dx, dy). */
const folderShape = (p: Paint, dx: number, dy: number) => (
  <path
    transform={`translate(${dx} ${dy})`}
    d="M4.6 5.4h4l2 2.2h8.8a1.8 1.8 0 0 1 1.8 1.8v8.8a1.8 1.8 0 0 1-1.8 1.8H4.6a1.8 1.8 0 0 1-1.8-1.8V7.2a1.8 1.8 0 0 1 1.8-1.8Z"
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
    <rect x="2.6" y="3" width="18.8" height="12.6" rx="1.6" fill={p.fill} />
    <path d="m2.8 14.4 5-5 3.6 3.6 2.4-2.4 4.4 4.4" />
    <circle cx="16.6" cy="7" r="1.6" fill={p.fill} />
    <path d="M12 15.6v3M12 18.6l-3.6 3M12 18.6l3.6 3" />
  </>
)

export const GLYPHS = {
  // Tools
  pen: ballpoint,
  fountain,
  magic: (p) => (
    <>
      {lean(
        <>
          <rect x="8.6" y="1.4" width="6.8" height="14" rx="3.4" fill={p.fill} />
          <path d="M8.6 15.4 10.4 20h3.2l1.8-4.6Z" fill={p.fill} />
          <path d="M10.4 20 12 22.8l1.6-2.8Z" fill={p.tip} />
        </>,
      )}
      {sparkle(p, 18.6, 19.2, 3)}
    </>
  ),
  highlighter: (p) =>
    lean(
      <>
        <rect x="8" y="1.2" width="8" height="12.4" rx="3" fill={p.fill} />
        <path d="M8.6 13.6h6.8l-.8 3.2H9.4Z" fill={p.fill} />
        <path d="M9.6 16.8h4.8l-1.2 4.8-3.6-1.2Z" fill={p.tip} />
      </>,
    ),
  broom: (p) => eraser(p),
  magnifier: (p) => (
    <>
      <path d="m8.4 15.6-5 5" strokeWidth="2.8" />
      <circle cx="14" cy="10" r="7.4" fill={p.fill} />
      <path d="M14 6.6v6.8M10.6 10h6.8" strokeWidth="1.9" />
    </>
  ),
  tape: (p) => (
    <>
      <path d="M8.6 17.6 4.4 19l-1.8 1.4.9.5-.4.9 1 .3-.2 1 5.6-2.4 2.4-1.8Z" fill={p.accent} />
      <ellipse cx="13.6" cy="10.6" rx="8" ry="8.2" fill={p.fill} />
      <ellipse cx="15" cy="10.6" rx="3.4" ry="4.2" fill={p.soft} />
      <ellipse cx="15.3" cy="10.6" rx="1.6" ry="2.2" fill="var(--icon-hole, #0d1016)" />
    </>
  ),
  laser: (p) => (
    <g transform="rotate(45 12 12)">
      <rect x="9" y="0.8" width="6" height="11.2" rx="3" fill={p.fill} />
      <path d="M9.2 8.6h5.6" stroke={p.accentLine} />
      <path d="M12 12v7.6" />
      <circle cx="12" cy="21.4" r="1.6" fill={p.solid} stroke="none" />
    </g>
  ),
  lasso: (p) => (
    <>
      <path
        d="M10.2 15.6c-4.4.4-7.6-1.6-7.6-4.6 0-3.8 4.6-6.8 10-6.8 4.4 0 8 2 8 4.8 0 1.4-.9 2.6-2.4 3.4"
        strokeDasharray="2.3 2.3"
      />
      {cursor(p)}
    </>
  ),
  selection: (p) => (
    <>
      <path d="M5.4 4h9.6M5.4 15.6h4.6M4 5.4V14M16.4 5.4v4.8" strokeDasharray="2.2 2.2" />
      <rect x="2.6" y="2.6" width="2.8" height="2.8" rx="0.7" fill={p.fill} />
      <rect x="15" y="2.6" width="2.8" height="2.8" rx="0.7" fill={p.fill} />
      <rect x="2.6" y="14.2" width="2.8" height="2.8" rx="0.7" fill={p.fill} />
      {cursor(p)}
    </>
  ),
  anchor: (p) => (
    <>
      <path d="M5 18.4c2.4-3.4 4.4-6 7-6.4s4.6-2.4 7-6.6" />
      <circle cx="4.6" cy="18.8" r="2" fill={p.fill} />
      <circle cx="12" cy="12" r="2" fill={p.fill} />
      <circle cx="19.4" cy="5" r="2" fill={p.fill} />
    </>
  ),
  tools: (p) => (
    <>
      <g transform="rotate(45 12 12)">
        <rect x="9.1" y="1.6" width="5.8" height="20.8" rx="1.3" fill={p.soft} />
        <path d="M9.1 5h2.2M9.1 8h1.4M9.1 11h2.2M9.1 14h1.4M9.1 17h2.2M9.1 20h1.4" />
      </g>
      <g transform="rotate(-45 12 12)">
        <rect x="9.5" y="1.4" width="5" height="14.4" rx="1.4" fill={p.fill} />
        <path d="M9.5 4.6h5" />
        <path d="M9.5 15.8 12 21l2.5-5.2Z" fill={p.fill} />
        <path d="M11.2 19.4 12 21l.8-1.6Z" fill={p.tip} />
      </g>
    </>
  ),
  text: () => (
    <>
      <path d="M2.6 5.2h10.4M7.8 5.2v14" strokeWidth="2" />
      <path d="M13.8 10.4h7M17 7.4v9.6c0 1.4.8 2.2 2 2.2h1.4" strokeWidth="1.8" />
    </>
  ),
  eraser: (p) => eraser(p),

  // Interface
  addons: (p) => (
    <path
      d="M4.6 7h4.2a3.2 3.2 0 1 1 6.4 0h3.6a1.4 1.4 0 0 1 1.4 1.4v4a3 3 0 1 0 0 5.6v1.6a1.4 1.4 0 0 1-1.4 1.4h-4.2a3 3 0 1 0-5.6 0H4.6a1.4 1.4 0 0 1-1.4-1.4V8.4A1.4 1.4 0 0 1 4.6 7Z"
      fill={p.fill}
    />
  ),
  layers: (p) => (
    <>
      <path
        d="M12.9 11.7 20 15.4a.7.7 0 0 1 0 1.2l-7.1 3.7a2 2 0 0 1-1.8 0L4 16.6a.7.7 0 0 1 0-1.2l7.1-3.7a2 2 0 0 1 1.8 0Z"
        fill={p.fill}
      />
      <path
        d="M12.9 7.7 20 11.4a.7.7 0 0 1 0 1.2l-7.1 3.7a2 2 0 0 1-1.8 0L4 12.6a.7.7 0 0 1 0-1.2l7.1-3.7a2 2 0 0 1 1.8 0Z"
        fill={p.fill}
      />
      <path
        d="M12.9 3.7 20 7.4a.7.7 0 0 1 0 1.2l-7.1 3.7a2 2 0 0 1-1.8 0L4 8.6a.7.7 0 0 1 0-1.2l7.1-3.7a2 2 0 0 1 1.8 0Z"
        fill={p.fill}
      />
    </>
  ),
  pages: (p) => (
    <>
      <rect x="3.4" y="5.6" width="12.6" height="15.6" rx="2" fill={p.fill} />
      <path
        d="M9.4 2.6h6.8l4.4 4.4v9.4a2 2 0 0 1-2 2H9.4a2 2 0 0 1-2-2V4.6a2 2 0 0 1 2-2Z"
        fill={p.fill}
      />
      <path d="M16.2 2.6V7h4.4" />
    </>
  ),
  settings: (p) => (
    <>
      <path
        d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2Z"
        fill={p.fill}
      />
      <circle cx="12" cy="12" r="3.2" fill="var(--icon-hole, #0d1016)" />
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
        y="2.8"
        width="8"
        height="8"
        rx="1.8"
        fill={p.fill}
        transform="rotate(-14 7.4 6.8)"
      />
      <path
        d="M17.2 8.2a1 1 0 0 1 1.7 0l3.2 5.6a1 1 0 0 1-.9 1.5h-6.3a1 1 0 0 1-.9-1.5Z"
        fill={p.fill}
      />
      <circle cx="9.2" cy="17" r="4.8" fill={p.fill} />
    </>
  ),
  table: (p) => (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2.4" fill={p.fill} />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </>
  ),
  chart: (p) => (
    <>
      <rect x="3.6" y="13" width="4.2" height="6.6" rx="1.2" fill={p.fill} />
      <rect x="9.9" y="9" width="4.2" height="10.6" rx="1.2" fill={p.fill} />
      <rect x="16.2" y="3.6" width="4.2" height="16" rx="1.2" fill={p.fill} />
      <path d="M2.4 21.4h19.2" />
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
  folder: (p) => folderShape(p, 0, 0),
  folders: (p) => (
    <>
      {folderShape(p, 3, -2.6)}
      {folderShape(p, -0.6, 1.4)}
    </>
  ),

  // Library
  edit: (p) => ballpoint(p),
  notebook: (p) => (
    <>
      <rect x="4.4" y="2.6" width="15.2" height="17.6" rx="2" fill={p.fill} />
      <path d="M8.2 2.6v17.6" />
      <path d="M11 7.4h5.6M11 10.4h5.6" />
      <path d="M14.2 20.2v2.4l1.3-1 1.3 1v-2.4" fill={p.fill} />
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
      {folderShape(p, -0.6, -0.4)}
      {plusBadge()}
    </>
  ),
  'new-quiz': (p) => (
    <>
      {quiz(p)}
      {plusBadge()}
    </>
  ),
  'new-flashcards': (p) => (
    <>
      {cards(p)}
      {plusBadge()}
    </>
  ),
  'new-presentation': (p) => (
    <>
      {board(p)}
      {plusBadge()}
    </>
  ),
} satisfies Record<string, Glyph>

export type GlyphName = keyof typeof GLYPHS
