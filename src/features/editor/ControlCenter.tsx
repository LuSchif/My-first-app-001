import { releaseLabel } from '../../release.ts'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'
import type { Features } from '../../engine/editor/features.ts'
import { Switch } from '../../design/index.ts'

const GROUPS: { title: string; items: [keyof Features, string, string][] }[] = [
  {
    title: 'Writing',
    items: [
      ['suggestions', 'Suggestions', 'Auto shape, Auto fill, tables and clefs after drawing'],
      ['holdToShape', 'Hold for perfect shapes', 'Rest the pen after drawing a shape or an arrow'],
      ['pressure', 'Pen pressure', 'Press harder for a wider fountain pen line'],
      ['smartHighlight', 'Smart highlighting', 'Highlighter over typed text marks it neatly'],
      ['textAutoAlign', 'Auto align text', 'New text sits on the lines of ruled paper'],
    ],
  },
  {
    title: 'Gestures and effects',
    items: [
      ['gestureUndo', 'Finger undo and redo', 'Double tap with two fingers to undo, three to redo'],
      ['askPaper', 'Ask for paper', 'Pulling past the last page asks which paper it gets'],
      ['broomDust', 'Broom dust', 'A little dust flies where the broom sweeps'],
    ],
  },
  {
    title: 'Toolbar',
    items: [
      ['magicPen', 'Magic pen', 'Lines, arrows, graphs and shapes come out clean'],
      ['eyedropper', 'Eyedropper', 'Pick a color from the page'],
      ['magnifier', 'Magnifier', 'See which layer something is on'],
      ['tape', 'Tape', 'Cover writing; double tap to reveal it'],
      ['laser', 'Laser pointer', 'Point at things while presenting'],
      ['pathTool', 'Edit paths', 'Move the anchor points of a line'],
      ['recentColors', 'Recent colors', 'The bar of your last five colors'],
    ],
  },
]

/** Switches Broomit's features on and off; the choice stays on this device. */
export function ControlCenter({ editor, state }: { editor: Editor; state: EditorState }) {
  return (
    <div className="grid gap-4">
      <p className="text-sm font-semibold">Control center</p>
      {GROUPS.map((group) => (
        <section key={group.title} className="grid gap-1">
          <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
            {group.title}
          </h3>
          {group.items.map(([key, label, hint]) => (
            <Switch
              key={key}
              label={label}
              hint={hint}
              checked={state.features[key]}
              onChange={(on) => {
                editor.setFeatures({ [key]: on })
              }}
            />
          ))}
        </section>
      ))}
      <p className="border-t border-line pt-3 text-xs font-semibold text-ink-muted">
        {releaseLabel()}
      </p>
    </div>
  )
}
