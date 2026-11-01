import { Type } from 'lucide-react'
import type { ReactNode } from 'react'
import { BroomitIcon } from '../../design/index.ts'
import type { Editor, EditorState, ToolId } from '../../engine/editor/Editor.ts'
import type { Features } from '../../engine/editor/features.ts'

/** A choice within a tool, offered on the arc above it in the wheel (e.g. pen or fountain pen). */
export interface ToolVariant {
  id: string
  label: string
  icon: (state: EditorState) => ReactNode
  active: (state: EditorState) => boolean
  choose: (editor: Editor) => void
}

/** A tool of the wheel, the inventory opened by holding a pen or finger on the page. */
export interface WheelTool {
  tool: ToolId
  label: (state: EditorState) => string
  /** In color when the tool is in use; pens show their ink at the tip. */
  icon: (state: EditorState, size: number, colored?: boolean) => ReactNode
  variants?: ToolVariant[]
}

const icon = (size: number) => ({ size, strokeWidth: 1.75 })

/** The tools in the wheel, clockwise from the top; those switched off in the control center are left out. */
export function wheelTools(features: Features): WheelTool[] {
  const all: (WheelTool | false)[] = [
    {
      tool: 'pen',
      label: (s) => (s.pen.nib === 'fountain' ? 'Fountain pen' : 'Pen'),
      icon: (s, size, colored) => (
        <BroomitIcon
          name={s.pen.nib === 'fountain' ? 'fountain' : 'pen'}
          size={size}
          colored={colored}
          tip={s.pen.color}
        />
      ),
      variants: [
        {
          id: 'ballpoint',
          label: 'Ballpoint',
          icon: (s) => <BroomitIcon name="pen" size={22} tip={s.pen.color} />,
          active: (s) => s.pen.nib === 'ballpoint',
          choose: (e) => e.setPen({ nib: 'ballpoint' }),
        },
        {
          id: 'fountain',
          label: 'Fountain pen',
          icon: (s) => <BroomitIcon name="fountain" size={22} tip={s.pen.color} />,
          active: (s) => s.pen.nib === 'fountain',
          choose: (e) => e.setPen({ nib: 'fountain' }),
        },
      ],
    },
    features.magicPen && {
      tool: 'magic',
      label: () => 'Magic pen',
      icon: (s, size, colored) => (
        <BroomitIcon name="magic" size={size} colored={colored} tip={s.pen.color} />
      ),
    },
    {
      tool: 'highlighter',
      label: () => 'Highlighter',
      icon: (s, size, colored) => (
        <BroomitIcon name="highlighter" size={size} colored={colored} tip={s.highlighter.color} />
      ),
    },
    {
      tool: 'broom',
      label: () => 'Broom',
      icon: (_, size, colored) => <BroomitIcon name="broom" size={size} colored={colored} />,
      variants: [
        {
          id: 'precise',
          label: 'Precise',
          icon: () => <BroomitIcon name="broom" size={22} />,
          active: (s) => s.broom.mode === 'precise',
          choose: (e) => e.setBroom({ mode: 'precise' }),
        },
        {
          id: 'stroke',
          label: 'Whole strokes',
          icon: () => <BroomitIcon name="broom" size={22} strokeWidth={2.4} />,
          active: (s) => s.broom.mode === 'stroke',
          choose: (e) => e.setBroom({ mode: 'stroke' }),
        },
      ],
    },
    {
      tool: 'text',
      label: () => 'Text',
      icon: (_, size) => <Type {...icon(size)} />,
    },
    features.tape && {
      tool: 'tape',
      label: () => 'Tape',
      icon: (_, size, colored) => <BroomitIcon name="tape" size={size} colored={colored} />,
    },
    features.laser && {
      tool: 'laser',
      label: () => 'Laser pointer',
      icon: (_, size, colored) => <BroomitIcon name="laser" size={size} colored={colored} />,
    },
  ]
  return all.filter((t): t is WheelTool => Boolean(t))
}

/** Whether a tool lives in the wheel (rather than in the mini toolbar). */
export function isWheelTool(tool: ToolId): boolean {
  return ['pen', 'magic', 'highlighter', 'broom', 'text', 'tape', 'laser'].includes(tool)
}
