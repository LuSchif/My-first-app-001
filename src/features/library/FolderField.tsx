import { ChevronDown, FolderPlus, Inbox } from 'lucide-react'
import { createElement, useState } from 'react'
import type { Folder, Id } from '../../engine/model/types.ts'
import { Button, Dialog, Popover, PopoverContent, PopoverTrigger } from '../../design/index.ts'
import { FolderEditorDialog } from '../folders/FolderEditorDialog.tsx'
import { folderIcon } from '../folders/folderIcons.ts'
import { MoveList } from './MoveList.tsx'

/** Choosing the folder for a new notebook, or making a new folder for it right here. */
export function FolderField({
  folders,
  value,
  onChange,
  onCreated,
}: {
  folders: readonly Folder[]
  value: Id | null
  onChange: (folderId: Id | null) => void
  onCreated: (folder: Folder) => void
}) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const current = folders.find((f) => f.id === value)
  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">Folder</span>
      <div className="flex flex-wrap gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-control bg-surface-raised px-3 text-left ring-1 ring-line ring-inset hover:bg-hover"
            >
              <span className="text-ink-muted">
                {current ? (
                  createElement(folderIcon(current.icon), { size: 18 })
                ) : (
                  <Inbox size={18} />
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">{current?.name ?? 'No folder'}</span>
              <ChevronDown size={16} />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="grid w-72 gap-1 p-2">
            <MoveList
              folders={folders}
              current={value}
              onPick={(id) => {
                onChange(id)
                setOpen(false)
              }}
            />
          </PopoverContent>
        </Popover>
        <Button icon={<FolderPlus size={18} />} onClick={() => setCreating(true)}>
          New folder
        </Button>
      </div>
      <Dialog open={creating} onOpenChange={setCreating}>
        {creating ? (
          <FolderEditorDialog
            onSaved={(folder) => {
              setCreating(false)
              onCreated(folder)
            }}
          />
        ) : null}
      </Dialog>
    </div>
  )
}
