/**
 * Broome's own stickers, drawn for the app: each is an SVG on a 120 × 120 grid with a white
 * die-cut edge and a soft shadow, added to the page as a picture.
 */
export interface Sticker {
  id: string
  label: string
  svg: string
}

const INK = '#3e2d25'

/** Wraps sticker art: the white edge comes from a wide white outline under every shape. */
function sticker(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="-6 -6 132 132">
<defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#3e2d25" flood-opacity="0.22"/></filter></defs>
<g filter="url(#s)"><g stroke="#fff" stroke-width="10" stroke-linejoin="round" stroke-linecap="round" fill="#fff">${body
    .replace(/fill="[^"]*"/g, '')
    .replace(/stroke="[^"]*"/g, '')
    .replace(/stroke-width="[^"]*"/g, '')}</g></g>
<g stroke-linejoin="round" stroke-linecap="round">${body}</g>
</svg>`
}

function label(text: string, color: string, rotate = -6): string {
  const width = Math.max(64, text.length * 11 + 28)
  const x = 60 - width / 2
  return sticker(`<g transform="rotate(${rotate} 60 60)">
<rect x="${x}" y="40" width="${width}" height="40" rx="10" fill="${color}" stroke="${INK}" stroke-width="3"/>
<text x="60" y="67" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="20" fill="#fffdf8">${text}</text>
</g>`)
}

export const STICKERS: Sticker[] = [
  {
    id: 'star',
    label: 'Star',
    svg: sticker(
      `<path d="M60 10l14.7 29.8 32.9 4.8-23.8 23.2 5.6 32.7L60 85.1 30.6 100.5l5.6-32.7L12.4 44.6l32.9-4.8z" fill="#f2c94c" stroke="${INK}" stroke-width="3"/><circle cx="50" cy="58" r="3.5" fill="${INK}"/><circle cx="70" cy="58" r="3.5" fill="${INK}"/><path d="M52 68q8 6 16 0" fill="none" stroke="${INK}" stroke-width="3"/>`,
    ),
  },
  {
    id: 'heart',
    label: 'Heart',
    svg: sticker(
      `<path d="M60 104C24 80 10 62 10 42c0-15 11-26 25-26 11 0 19 6 25 15 6-9 14-15 25-15 14 0 25 11 25 26 0 20-14 38-50 62z" fill="#e88a9a" stroke="${INK}" stroke-width="3"/><path d="M30 38q4-10 14-10" fill="none" stroke="#fff" stroke-width="5" opacity=".7"/>`,
    ),
  },
  {
    id: 'done',
    label: 'Done',
    svg: sticker(
      `<circle cx="60" cy="60" r="48" fill="#7fbf7f" stroke="${INK}" stroke-width="3"/><path d="M36 61l16 16 32-34" fill="none" stroke="#fffdf8" stroke-width="10"/>`,
    ),
  },
  { id: 'important', label: 'Important', svg: label('Important!', '#c4513f') },
  { id: 'todo', label: 'To do', svg: label('To do', '#5b8bd6', 5) },
  { id: 'exam', label: 'Exam', svg: label('Exam', '#8a5cc2', -4) },
  { id: 'great', label: 'Great job', svg: label('Great job', '#3f8f6a', 4) },
  {
    id: 'idea',
    label: 'Idea',
    svg: sticker(
      `<path d="M60 12c-20 0-34 15-34 33 0 13 7 21 13 28 4 5 6 9 6 15h30c0-6 2-10 6-15 6-7 13-15 13-28 0-18-14-33-34-33z" fill="#f6d55c" stroke="${INK}" stroke-width="3"/><rect x="44" y="90" width="32" height="16" rx="5" fill="#b9a48f" stroke="${INK}" stroke-width="3"/><path d="M52 60l8 10 8-10M60 70v18" fill="none" stroke="${INK}" stroke-width="3"/>`,
    ),
  },
  {
    id: 'smile',
    label: 'Smile',
    svg: sticker(
      `<circle cx="60" cy="60" r="48" fill="#f7cf5b" stroke="${INK}" stroke-width="3"/><circle cx="44" cy="50" r="5.5" fill="${INK}"/><circle cx="76" cy="50" r="5.5" fill="${INK}"/><path d="M38 70q22 22 44 0" fill="none" stroke="${INK}" stroke-width="5"/><circle cx="34" cy="68" r="6" fill="#ef9a7a" opacity=".7"/><circle cx="86" cy="68" r="6" fill="#ef9a7a" opacity=".7"/>`,
    ),
  },
  {
    id: 'sun',
    label: 'Sun',
    svg: sticker(
      `<g stroke="${INK}" stroke-width="4">${Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return `<line x1="${(60 + Math.cos(a) * 38).toFixed(1)}" y1="${(60 + Math.sin(a) * 38).toFixed(1)}" x2="${(60 + Math.cos(a) * 54).toFixed(1)}" y2="${(60 + Math.sin(a) * 54).toFixed(1)}"/>`
      }).join(
        '',
      )}</g><circle cx="60" cy="60" r="30" fill="#f4b740" stroke="${INK}" stroke-width="3"/>`,
    ),
  },
  {
    id: 'cloud',
    label: 'Cloud',
    svg: sticker(
      `<path d="M30 92c-12 0-20-8-20-19s9-19 20-19c2-15 14-26 29-26 13 0 24 8 28 20 13 0 23 10 23 22s-10 22-23 22z" fill="#cfe3f5" stroke="${INK}" stroke-width="3"/>`,
    ),
  },
  {
    id: 'bolt',
    label: 'Lightning',
    svg: sticker(
      `<path d="M68 8L24 68h30l-8 44 50-64H64z" fill="#f2c94c" stroke="${INK}" stroke-width="3"/>`,
    ),
  },
  {
    id: 'flower',
    label: 'Flower',
    svg: sticker(
      `${Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * 360
        return `<ellipse cx="60" cy="32" rx="16" ry="24" transform="rotate(${a} 60 60)" fill="#f4a9bc" stroke="${INK}" stroke-width="3"/>`
      }).join('')}<circle cx="60" cy="60" r="15" fill="#f6d55c" stroke="${INK}" stroke-width="3"/>`,
    ),
  },
  {
    id: 'pin',
    label: 'Pin',
    svg: sticker(
      `<path d="M60 112V70" stroke="${INK}" stroke-width="4"/><circle cx="60" cy="44" r="34" fill="#e0533f" stroke="${INK}" stroke-width="3"/><circle cx="48" cy="34" r="9" fill="#fff" opacity=".55"/>`,
    ),
  },
  {
    id: 'bookmark',
    label: 'Bookmark',
    svg: sticker(
      `<path d="M30 8h60v104L60 88l-30 24z" fill="#5f9e8f" stroke="${INK}" stroke-width="3"/><path d="M60 30l5 10 11 1.6-8 7.8 2 11-10-5.3-10 5.3 2-11-8-7.8 11-1.6z" fill="#fffdf8"/>`,
    ),
  },
  {
    id: 'warning',
    label: 'Warning',
    svg: sticker(
      `<path d="M60 10L112 104H8z" fill="#f6b26b" stroke="${INK}" stroke-width="3"/><path d="M60 42v30" stroke="${INK}" stroke-width="8"/><circle cx="60" cy="88" r="5" fill="${INK}"/>`,
    ),
  },
  {
    id: 'question',
    label: 'Question',
    svg: sticker(
      `<path d="M16 22c0-7 5-12 12-12h64c7 0 12 5 12 12v52c0 7-5 12-12 12H52l-22 22V86h-2c-7 0-12-5-12-12z" fill="#a9c8ec" stroke="${INK}" stroke-width="3"/><path d="M48 38c0-8 6-13 12-13s12 5 12 12c0 9-12 10-12 20" fill="none" stroke="${INK}" stroke-width="6"/><circle cx="60" cy="70" r="4.5" fill="${INK}"/>`,
    ),
  },
  {
    id: 'coffee',
    label: 'Coffee',
    svg: sticker(
      `<path d="M22 44h62v34c0 15-12 26-27 26H49c-15 0-27-11-27-26z" fill="#d9b48f" stroke="${INK}" stroke-width="3"/><path d="M84 52h6c9 0 14 6 14 13s-6 13-14 13h-7" fill="none" stroke="${INK}" stroke-width="5"/><path d="M40 14q-6 8 0 16M54 10q-6 10 0 20M68 14q-6 8 0 16" fill="none" stroke="${INK}" stroke-width="3.5"/>`,
    ),
  },
  {
    id: 'book',
    label: 'Book',
    svg: sticker(
      `<path d="M14 24c16-6 32-4 46 6v80c-14-10-30-12-46-6z" fill="#fffdf8" stroke="${INK}" stroke-width="3"/><path d="M106 24c-16-6-32-4-46 6v80c14-10 30-12 46-6z" fill="#f2e6d6" stroke="${INK}" stroke-width="3"/><path d="M24 42q14-3 26 3M24 56q14-3 26 3M70 45q12-6 26-3M70 59q12-6 26-3" fill="none" stroke="#b98b65" stroke-width="3"/>`,
    ),
  },
  {
    id: 'pencil',
    label: 'Pencil',
    svg: sticker(
      `<g transform="rotate(45 60 60)"><rect x="46" y="4" width="28" height="78" rx="4" fill="#f2c94c" stroke="${INK}" stroke-width="3"/><rect x="46" y="4" width="28" height="14" rx="4" fill="#e88a9a" stroke="${INK}" stroke-width="3"/><path d="M46 82h28l-14 30z" fill="#f2e6d6" stroke="${INK}" stroke-width="3"/><path d="M55 101l5 11 5-11z" fill="${INK}"/></g>`,
    ),
  },
  {
    id: 'clock',
    label: 'Clock',
    svg: sticker(
      `<circle cx="60" cy="60" r="48" fill="#fffdf8" stroke="${INK}" stroke-width="3"/><circle cx="60" cy="60" r="40" fill="none" stroke="#b98b65" stroke-width="3" stroke-dasharray="2 19"/><path d="M60 30v30l20 12" fill="none" stroke="${INK}" stroke-width="6"/>`,
    ),
  },
  {
    id: 'trophy',
    label: 'Trophy',
    svg: sticker(
      `<path d="M34 14h52v26c0 16-12 28-26 28S34 56 34 40z" fill="#f2c94c" stroke="${INK}" stroke-width="3"/><path d="M34 22H18c0 16 8 24 18 24M86 22h16c0 16-8 24-18 24" fill="none" stroke="${INK}" stroke-width="5"/><path d="M52 68h16v16H52z" fill="#d9a43c" stroke="${INK}" stroke-width="3"/><rect x="34" y="84" width="52" height="20" rx="4" fill="#795a46" stroke="${INK}" stroke-width="3"/>`,
    ),
  },
  {
    id: 'leaf',
    label: 'Leaf',
    svg: sticker(
      `<path d="M18 102C14 50 46 16 104 16c2 58-30 92-86 86z" fill="#8fc27a" stroke="${INK}" stroke-width="3"/><path d="M22 98C46 72 66 52 92 30" fill="none" stroke="${INK}" stroke-width="3"/>`,
    ),
  },
  {
    id: 'wow',
    label: 'Wow',
    svg: sticker(
      `<path d="M60 6l10 18 20-8-2 21 21 4-14 16 14 16-21 4 2 21-20-8-10 18-10-18-20 8 2-21-21-4 14-16-14-16 21-4-2-21 20 8z" fill="#f4a24a" stroke="${INK}" stroke-width="3"/><text x="60" y="68" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="24" fill="#fffdf8">WOW</text>`,
    ),
  },
]
