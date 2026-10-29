import { createElement, useState } from 'react'
import { createFolder } from '../../engine/model/factory.ts'
import type { Fill } from '../../engine/model/fill.ts'
import type { Folder, Id } from '../../engine/model/types.ts'
import { Button, DialogContent, DialogFooter, Fold, TextField } from '../../design/index.ts'
import { fillToCss } from '../../engine/model/fill.ts'
import { createFolderRecord, updateFolder } from '../../storage/folders.ts'
import { FillEditor } from './FillEditor.tsx'
import { FolderGraphic } from './FolderGraphic.tsx'
import { DEFAULT_FOLDER_ICON, FOLDER_ICON_GROUPS, folderIcon } from './folderIcons.ts'
import { NameHint } from '../library/NameHint.tsx'
import { useTakenNames } from '../library/useTakenNames.ts'
import { uniqueName } from '../library/uniqueName.ts'

const DEFAULT_FILL: Fill = {
  type: 'linear',
  angle: 135,
  stops: [
    { offset: 0, color: '#d8c1a5' },
    { offset: 1, color: '#795a46' },
  ],
}

/**
 * Creates a folder or changes one: its name, its color or gradient and its icon, with a live
 * picture of the folder.
 */
export function FolderEditorDialog({
  folder,
  parentId = null,
  onSaved,
}: {
  /** The folder to change; without it, a new folder is made. */
  folder?: Folder
  /** Where a new folder goes. */
  parentId?: Id | null
  onSaved: (folder: Folder) => void
}) {
  const [name, setName] = useState(folder?.name ?? '')
  const taken = useTakenNames('folder', folder?.id)
  const [fill, setFill] = useState<Fill>(folder?.fill ?? DEFAULT_FILL)
  const [icon, setIcon] = useState(folder?.icon ?? DEFAULT_FOLDER_ICON)
  // Both design options start folded, so the dialog fits without scrolling.
  const [tab, setTab] = useState<'color' | 'icon' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = uniqueName(name, taken)
    if (!trimmed || busy) return
    setBusy(true)
    setError(null)
    try {
      if (folder) {
        await updateFolder(folder.id, { name: trimmed, fill, icon })
        onSaved({ ...folder, name: trimmed, fill, icon })
      } else {
        const created = createFolder({ name: trimmed, fill, icon, parentId })
        await createFolderRecord(created)
        onSaved(created)
      }
    } catch (err) {
      console.error(err)
      setError('The folder could not be saved. Check that storage is not full and try again.')
      setBusy(false)
    }
  }

  return (
    <DialogContent
      title={folder ? 'Edit folder' : 'New folder'}
      className="w-[min(46rem,calc(100%-2rem))]"
    >
      <form className="grid gap-5" onSubmit={save}>
        <div className="grid items-start gap-5 sm:grid-cols-[11rem_1fr]">
          <div className="grid justify-items-center gap-2 sm:sticky sm:top-0">
            <FolderGraphic fill={fill} icon={icon} className="w-40" />
            <p className="max-w-40 truncate text-center font-semibold">{name.trim() || 'Folder'}</p>
          </div>
          <div className="grid gap-4">
            <TextField
              label="Name"
              placeholder="e.g. Biology"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
            />
            <NameHint name={name} taken={taken} noun="folder" />
            <Fold
              title="Color"
              open={tab === 'color'}
              onToggle={() => setTab(tab === 'color' ? null : 'color')}
              summary={
                <span
                  className="size-6 rounded-full ring-1 ring-line"
                  style={{ background: fillToCss(fill) }}
                />
              }
            >
              <FillEditor value={fill} onChange={setFill} />
            </Fold>
            <Fold
              title="Icon"
              open={tab === 'icon'}
              onToggle={() => setTab(tab === 'icon' ? null : 'icon')}
              summary={createElement(folderIcon(icon), { size: 20, strokeWidth: 1.75 })}
            >
              <div className="grid gap-4">
                {FOLDER_ICON_GROUPS.map((group) => (
                  <div key={group.name} className="grid gap-1.5">
                    <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
                      {group.name}
                    </p>
                    <div role="group" aria-label={group.name} className="flex flex-wrap gap-1">
                      {group.icons.map(([iconName, Icon]) => (
                        <button
                          key={iconName}
                          type="button"
                          aria-label={iconName}
                          aria-pressed={icon === iconName}
                          onClick={() => setIcon(iconName)}
                          className="grid size-11 place-items-center rounded-control hover:bg-hover aria-pressed:bg-ink aria-pressed:text-ink-inverse"
                        >
                          <Icon size={22} strokeWidth={1.75} />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Fold>
          </div>
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <DialogFooter>
          <Button variant="primary" type="submit" disabled={!name.trim() || busy}>
            {folder ? 'Save' : busy ? 'Creating…' : 'Create folder'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
