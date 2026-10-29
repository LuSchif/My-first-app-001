import { Info } from 'lucide-react'
import { uniqueName } from './uniqueName.ts'

/** Under a name field: says that the name is taken and what it will be saved as. */
export function NameHint({
  name,
  taken,
  noun,
}: {
  name: string
  taken: readonly string[]
  /** E.g. "folder", "notebook", "group". */
  noun: string
}) {
  const trimmed = name.trim()
  const final = uniqueName(trimmed, taken)
  if (!trimmed || final === trimmed) return null
  return (
    <p role="status" className="-mt-2 flex items-start gap-1.5 text-sm text-ink-muted">
      <Info size={16} className="mt-0.5 shrink-0 text-accent" />
      <span>
        A {noun} named “{trimmed}” already exists. This one will be called{' '}
        <span className="font-semibold text-ink">“{final}”</span>.
      </span>
    </p>
  )
}
