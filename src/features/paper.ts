import type { PaperKind } from '../engine/model/types.ts'

export const PAPER_OPTIONS: { kind: PaperKind; label: string }[] = [
  { kind: 'lined', label: 'Lined' },
  { kind: 'grid', label: 'Grid' },
  { kind: 'dotted', label: 'Dotted' },
  { kind: 'music', label: 'Music' },
  { kind: 'blank', label: 'Blank' },
]

/** A small CSS rendering of each paper, for pickers and thumbnails. */
export function paperPreviewStyle(kind: PaperKind): React.CSSProperties {
  const line = 'rgba(121, 90, 70, 0.28)'
  switch (kind) {
    case 'lined':
      return {
        backgroundColor: '#fffdf8',
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px)`,
        backgroundSize: '100% 12px',
        backgroundPosition: '0 18px',
      }
    case 'grid':
      return {
        backgroundColor: '#fffdf8',
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: '9px 9px',
      }
    case 'dotted':
      return {
        backgroundColor: '#fffdf8',
        backgroundImage: `radial-gradient(rgba(121, 90, 70, 0.5) 1px, transparent 1.2px)`,
        backgroundSize: '9px 9px',
      }
    case 'music': {
      // Five hairlines 3px apart per staff, then a gap.
      const stops = [0, 1, 2, 3, 4]
        .map((i) => {
          const y = 4 + i * 3
          return `transparent ${y}px, ${line} ${y}px, ${line} ${y + 1}px, transparent ${y + 1}px`
        })
        .join(', ')
      return {
        backgroundColor: '#fffdf8',
        backgroundImage: `linear-gradient(${stops})`,
        backgroundSize: 'calc(100% - 12px) 28px',
        backgroundPosition: '6px 6px',
        backgroundRepeat: 'repeat-y',
      }
    }
    case 'blank':
      return { backgroundColor: '#fffdf8' }
  }
}
