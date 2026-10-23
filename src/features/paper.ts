import type { PaperKind } from '../engine/model/types.ts'

export const PAPER_OPTIONS: { kind: PaperKind; label: string }[] = [
  { kind: 'lined', label: 'Lined' },
  { kind: 'grid', label: 'Grid' },
  { kind: 'dotted', label: 'Dotted' },
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
    case 'blank':
      return { backgroundColor: '#fffdf8' }
  }
}
