import { Bandage, Highlighter, PenLine, Type, WandSparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { BroomIcon, FountainPenIcon, LaserBroomIcon } from '../../design/index.ts'
import type { Editor, EditorState, ToolId } from '../../engine/editor/Editor.ts'
import type { Features } from '../../engine/editor/features.ts'

/** A choice within a tool, offered on the arc above it in the wheel (e.g. pen or fountain pen). */
export interface ToolVariant {
  id: string
  label: string
  icon: ReactNode
  active: (state: EditorState) => boolean
  choose: (editor: Editor) => void
}

/** A tool of the wheel, the inventory opened by holding a pen or finger on the page. */
export interface WheelTool {
  tool: ToolId
  label: (state: EditorState) => string
  icon: (state: EditorState, size: number) => ReactNode
  variants?: ToolVariant[]
}

const icon = (size: number) => ({ size, strokeWidth: 1.75 })

/** The tools in the wheel, clockwise from the top; those switched off in the control center are left out. */
export function wheelTools(features: Features): WheelTool[] {
  const all: (WheelTool | false)[] = [
    {
      tool: 'pen',
      label: (s) => (s.pen.nib === 'fountain' ? 'Fountain pen' : 'Pen'),
      icon: (s, size) =>
        s.pen.nib === 'fountain' ? <FountainPenIcon size={size} /> : <PenLine {...icon(size)} />,
      variants: [
        {
          id: 'ballpoint',
          label: 'Ballpoint',
          icon: <PenLine {...icon(20)} />,
          active: (s) => s.pen.nib === 'ballpoint',
          choose: (e) => e.setPen({ nib: 'ballpoint' }),
        },
        {
          id: 'fountain',
          label: 'Fountain pen',
          icon: <FountainPenIcon size={20} />,
          active: (s) => s.pen.nib === 'fountain',
          choose: (e) => e.setPen({ nib: 'fountain' }),
        },
      ],
    },
    features.magicPen && {
      tool: 'magic',
      label: () => 'Magic pen',
      icon: (_, size) => <WandSparkles {...icon(size)} />,
    },
    {
      tool: 'highlighter',
      label: () => 'Highlighter',
      icon: (_, size) => <Highlighter {...icon(size)} />,
    },
    {
      tool: 'broom',
      label: () => 'Broom',
      icon: (_, size) => <BroomIcon size={size} />,
      variants: [
        {
          id: 'precise',
          label: 'Precise',
          icon: <BroomIcon size={20} />,
          active: (s) => s.broom.mode === 'precise',
          choose: (e) => e.setBroom({ mode: 'precise' }),
        },
        {
          id: 'stroke',
          label: 'Whole strokes',
          icon: <BroomIcon size={20} strokeWidth={2.5} />,
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
      icon: (_, size) => <Bandage {...icon(size)} />,
    },
    features.laser && {
      tool: 'laser',
      label: () => 'Laser pointer',
      icon: (_, size) => <LaserBroomIcon size={size} />,
    },
  ]
  return all.filter((t): t is WheelTool => Boolean(t))
}

/** Whether a tool lives in the wheel (rather than in the mini toolbar). */
export function isWheelTool(tool: ToolId): boolean {
  return ['pen', 'magic', 'highlighter', 'broom', 'text', 'tape', 'laser'].includes(tool)
}
