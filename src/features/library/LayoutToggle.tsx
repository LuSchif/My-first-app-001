import { LayoutGrid, List } from 'lucide-react'
import { IconButton } from '../../design/index.ts'
import type { LibraryLayout } from './libraryLayout.ts'

/** Switches the library between tiles and a list. */
export function LayoutToggle({
  value,
  onChange,
}: {
  value: LibraryLayout
  onChange: (layout: LibraryLayout) => void
}) {
  return (
    <div
      role="group"
      aria-label="Show as"
      className="flex shrink-0 gap-0.5 rounded-control bg-surface-raised p-0.5 ring-1 ring-line ring-inset"
    >
      <IconButton
        label="Tiles"
        icon={<LayoutGrid size={18} />}
        active={value === 'tiles'}
        className="size-10"
        onClick={() => onChange('tiles')}
      />
      <IconButton
        label="List"
        icon={<List size={18} />}
        active={value === 'list'}
        className="size-10"
        onClick={() => onChange('list')}
      />
    </div>
  )
}
