import { Camera, ImagePlus, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Editor } from '../../engine/editor/Editor.ts'
import { Button, IconButton, Popover, PopoverContent, PopoverTrigger } from '../../design/index.ts'
import { insertPicture } from './images.ts'

/** Adds pictures (and later tables and charts) to the current page. */
export function InsertMenu({ editor, notebookId }: { editor: Editor; notebookId: string }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const library = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)

  const onFile = (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    setOpen(false)
    insertPicture(editor, notebookId, file).catch((err: unknown) => {
      console.error(err)
      setError('This picture could not be added.')
      setOpen(true)
    })
  }

  // The file fields live outside the menu: it closes while the photo picker is open, and the
  // fields must still be there when the picture comes back.
  return (
    <>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setError(null)
        }}
      >
        <PopoverTrigger asChild>
          <IconButton label="Insert" icon={<Plus size={22} strokeWidth={1.75} />} />
        </PopoverTrigger>
        <PopoverContent className="grid w-64 gap-1 p-2">
          <Button
            variant="ghost"
            className="justify-start"
            icon={<ImagePlus size={18} />}
            onClick={() => library.current?.click()}
          >
            Picture from photos
          </Button>
          <Button
            variant="ghost"
            className="justify-start"
            icon={<Camera size={18} />}
            onClick={() => camera.current?.click()}
          >
            Take a photo
          </Button>
          {error ? <p className="px-3 py-1 text-sm text-danger">{error}</p> : null}
        </PopoverContent>
      </Popover>
      <input
        ref={library}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.currentTarget)}
      />
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.currentTarget)}
      />
    </>
  )
}
