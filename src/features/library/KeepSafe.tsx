import { ArchiveRestore, Download, HardDriveDownload, Share, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button, Popover, PopoverContent, PopoverTrigger } from '../../design/index.ts'
import { isInstalled } from '../../lib/install.ts'
import { formatEdited } from '../../lib/time.ts'
import {
  BackupError,
  backupFileName,
  createBackup,
  parseBackup,
  restoreBackup,
} from '../../storage/backup.ts'

const LAST_BACKUP_KEY = 'broomit.lastBackup'
const INSTALL_DISMISSED_KEY = 'broomit.installHintDismissed'

/** Saves all notebooks to a file, or adds the notebooks from a saved file. */
export function BackupMenu({ onRestored }: { onRestored: () => void }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [lastBackup, setLastBackup] = useState(() => Number(read(LAST_BACKUP_KEY)) || null)
  const fileInput = useRef<HTMLInputElement>(null)

  const save = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const backup = await createBackup()
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = backupFileName()
      document.body.append(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      write(LAST_BACKUP_KEY, String(backup.exportedAt))
      setLastBackup(backup.exportedAt)
      const count = backup.notebooks.length
      setMessage({ text: `Saved ${count} ${count === 1 ? 'notebook' : 'notebooks'}.` })
    } catch (err) {
      console.error(err)
      setMessage({ text: 'The backup could not be created.', error: true })
    } finally {
      setBusy(false)
    }
  }

  const restore = async (file: File) => {
    setBusy(true)
    setMessage(null)
    try {
      const count = await restoreBackup(parseBackup(await file.text()))
      setMessage({ text: `Restored ${count} ${count === 1 ? 'notebook' : 'notebooks'}.` })
      onRestored()
    } catch (err) {
      console.error(err)
      const text = err instanceof BackupError ? err.message : 'The backup could not be restored.'
      setMessage({ text, error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setMessage(null)
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="secondary" icon={<HardDriveDownload size={18} />}>
          Backup
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-80 gap-3">
        <div className="grid gap-1">
          <p className="text-sm font-semibold">Backup</p>
          <p className="text-sm text-ink-muted">
            Your notebooks live only on this device. Save a backup file now and then, e.g. to Files
            or iCloud Drive.
          </p>
          <p className="text-xs text-ink-muted">
            {lastBackup ? `Last backup ${formatEdited(lastBackup)}.` : 'No backup saved yet.'}
          </p>
        </div>
        <Button variant="primary" icon={<Download size={18} />} disabled={busy} onClick={save}>
          Save backup
        </Button>
        <Button
          variant="secondary"
          icon={<ArchiveRestore size={18} />}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          Restore from file…
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void restore(file)
          }}
        />
        <p className="text-xs text-ink-muted">
          Restoring adds the notebooks from the file. Notebooks that are also in the file are
          replaced by their saved version; all others stay as they are.
        </p>
        {message ? (
          <p
            role="status"
            className={message.error ? 'text-sm text-danger' : 'text-sm font-semibold'}
          >
            {message.text}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

/**
 * Asks to add Broomit to the Home Screen. Installed, it starts offline, and iPadOS no longer
 * clears its storage after a week without visits.
 */
export function InstallHint() {
  const [hidden, setHidden] = useState(() => isInstalled() || read(INSTALL_DISMISSED_KEY) === '1')
  if (hidden) return null
  return (
    <aside className="flex items-start gap-4 rounded-panel bg-surface-raised p-5 shadow-soft">
      <span className="grid size-11 shrink-0 place-items-center rounded-control bg-sand text-ink">
        <Share size={20} />
      </span>
      <div className="grid flex-1 gap-1">
        <p className="font-semibold">Install Broomit on your iPad</p>
        <p className="text-sm text-ink-muted">
          Tap <span className="font-semibold text-ink">Share</span>, then{' '}
          <span className="font-semibold text-ink">Add to Home Screen</span>. Installed, Broomit
          opens full screen, works offline, and iPadOS keeps your notebooks even when you don’t open
          it for a while.
        </p>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          write(INSTALL_DISMISSED_KEY, '1')
          setHidden(true)
        }}
        className="-mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-control hover:bg-hover"
      >
        <X size={18} />
      </button>
    </aside>
  )
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private browsing: these are reminders only.
  }
}
