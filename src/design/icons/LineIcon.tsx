import { createElement, type CSSProperties, type SVGProps } from 'react'
import { COLORED_VARS, GLYPHS, paintFor, type GlyphName } from './glyphs.tsx'
import { LINE_GLYPHS } from './lineGlyphs.ts'

export type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string
  /** The colored look (a tool or choice in use); chosen icon buttons show it by themselves. */
  colored?: boolean
}

const ROLE_FILL = {
  f: 'var(--bi-fill, none)',
  a: 'var(--bi-accent, none)',
  s: 'currentColor',
} as const

/** One icon: a Broome drawing (`glyph`) or a line icon (`line`), in Broome's style. */
export function LineIcon({
  glyph,
  line,
  size = 24,
  colored = false,
  strokeWidth = 1.75,
  style,
  ...props
}: IconProps & { glyph?: GlyphName; line?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={props['aria-label'] ? undefined : true}
      data-bicon=""
      style={colored ? ({ ...COLORED_VARS, ...style } as CSSProperties) : style}
      {...props}
    >
      {glyph
        ? GLYPHS[glyph](paintFor())
        : (LINE_GLYPHS[line ?? ''] ?? []).map(([tag, attrs, role], i) =>
            createElement(tag, { key: i, ...attrs, ...(role ? { fill: ROLE_FILL[role] } : {}) }),
          )}
    </svg>
  )
}
