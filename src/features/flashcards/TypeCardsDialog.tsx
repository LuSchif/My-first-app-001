import { Plus } from 'lucide-react'
import { useId, useState } from 'react'
import type { Editor } from '../../engine/editor/Editor.ts'
import { Button, DialogClose, DialogContent, DialogFooter } from '../../design/index.ts'

/**
 * Typing cards instead of writing them: a front and a back, then "Add card" puts them on a new
 * card after card `after` (centered, sized to fit) and clears the fields for the next one.
 */
export function TypeCardsDialog({ editor, after }: { editor: Editor; after: number }) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [added, setAdded] = useState(0)
  const ready = front.trim() !== '' || back.trim() !== ''

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ready) return
    editor.addTypedCard(front, back, after + 1)
    setAdded((n) => n + 1)
    setFront('')
    setBack('')
  }

  return (
    <DialogContent
      title="Type cards"
      description="Each card gets the front and back you type. Written cards and typed ones can be mixed."
      className="w-[min(36rem,calc(100%-2rem))]"
    >
      <form className="grid gap-4" onSubmit={add}>
        <Area label="Front" placeholder="e.g. la pomme" value={front} onChange={setFront} />
        <Area label="Back" placeholder="e.g. the apple" value={back} onChange={setBack} />
        <DialogFooter className="justify-between">
          <span className="text-sm text-ink-muted" aria-live="polite">
            {added ? `${added} ${added === 1 ? 'card' : 'cards'} added` : ''}
          </span>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
            <Button variant="primary" type="submit" icon={<Plus size={18} />} disabled={!ready}>
              Add card
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function Area({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        maxLength={400}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-none rounded-control bg-surface-raised px-3.5 py-2.5 text-base text-ink ring-1 ring-line ring-inset transition-shadow duration-150 placeholder:text-ink-subtle focus:ring-2 focus:ring-accent focus:outline-none"
      />
    </div>
  )
}
