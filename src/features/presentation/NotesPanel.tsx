import { ChevronDown, ChevronUp, NotebookText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { NotebookDocument } from '../../engine/document/NotebookDocument.ts'
import type { Editor, EditorState } from '../../engine/editor/Editor.ts'
import { useDocVersion } from './useDocVersion.ts'

/**
 * Speaker notes for the slide in view, under it. They are for the speaker: presenting never
 * shows them on the slide.
 */
export function NotesPanel({
  editor,
  state,
  doc,
}: {
  editor: Editor
  state: EditorState
  doc: NotebookDocument
}) {
  useDocVersion(doc)
  const [open, setOpen] = useState(true)
  const page = doc.pageList[state.pageIndex]
  if (!page) return null
  return (
    <section aria-label="Speaker notes" className="shrink-0 border-t border-line bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center gap-2 px-4 text-left text-xs font-semibold tracking-wide text-ink-muted uppercase hover:bg-hover"
      >
        <NotebookText size={14} />
        Speaker notes · Slide {state.pageIndex + 1}
        <span className="ml-auto">
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </span>
      </button>
      {open ? (
        <NotesField
          // A new field per slide (and after undo): its text is that slide's notes.
          key={`${page.id}:${page.notes ?? ''}`}
          initial={page.notes ?? ''}
          onCommit={(notes) => editor.setNotes(page.id, notes)}
        />
      ) : null}
    </section>
  )
}

function NotesField({ initial, onCommit }: { initial: string; onCommit: (notes: string) => void }) {
  const [text, setText] = useState(initial)
  // Going to another slide while typing keeps what was typed.
  const latest = useRef({ text, initial, onCommit })
  useEffect(() => {
    latest.current = { text, initial, onCommit }
  })
  useEffect(
    () => () => {
      const { text, initial, onCommit } = latest.current
      if (text !== initial) onCommit(text)
    },
    [],
  )
  return (
    <textarea
      aria-label="Speaker notes"
      value={text}
      placeholder="What you want to say on this slide. Only you see it."
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      className="block h-28 w-full resize-none bg-transparent px-4 pb-3 text-base leading-relaxed text-ink outline-none placeholder:text-ink-subtle"
    />
  )
}
