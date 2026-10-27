import { RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Editor } from '../../engine/editor/Editor.ts'
import {
  DEFAULT_CAPTION_SIZE,
  editPicture,
  FULL_CROP,
  imageCrop,
  type Crop,
} from '../../engine/model/image.ts'
import type { ImageObject } from '../../engine/model/types.ts'
import { loadImage } from '../../engine/render/images.ts'
import { Button, Dialog, DialogContent, Slider, TextField } from '../../design/index.ts'

/** The smallest crop, as a share of the picture's side. */
const MIN_SIDE = 0.05

type Grip = 'move' | 'nw' | 'ne' | 'sw' | 'se'

/**
 * Edits a picture after it was added: which part of it shows (dragging the corners or the
 * whole frame), and a title above and a caption below it. Saved together, as one undo step.
 */
export function PictureEditor({
  editor,
  image,
  open,
  onOpenChange,
}: {
  editor: Editor
  image: ImageObject
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <PictureEditorContent editor={editor} image={image} onDone={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  )
}

function PictureEditorContent({
  editor,
  image,
  onDone,
}: {
  editor: Editor
  image: ImageObject
  onDone: () => void
}) {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null)
  const [crop, setCrop] = useState<Crop>(() => imageCrop(image))
  const [title, setTitle] = useState(image.title ?? '')
  const [caption, setCaption] = useState(image.caption ?? '')
  const [fontSize, setFontSize] = useState(Math.round(image.fontSize ?? DEFAULT_CAPTION_SIZE))
  const canvas = useRef<HTMLCanvasElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const drag = useRef<{ grip: Grip; id: number; x: number; y: number; start: Crop } | null>(null)

  useEffect(() => {
    let current = true
    void loadImage(image.assetId).then((b) => {
      if (current) setBitmap(b)
    })
    return () => {
      current = false
    }
  }, [image.assetId])

  // The whole picture, so the crop can also grow again.
  useEffect(() => {
    const c = canvas.current
    if (!c || !bitmap) return
    c.width = bitmap.width
    c.height = bitmap.height
    c.getContext('2d')!.drawImage(bitmap, 0, 0)
  }, [bitmap])

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    const box = area.current?.getBoundingClientRect()
    if (!d || d.id !== e.pointerId || !box) return
    const dx = (e.clientX - d.x) / box.width
    const dy = (e.clientY - d.y) / box.height
    const s = d.start
    let { x, y, width, height } = s
    if (d.grip === 'move') {
      x = Math.min(1 - width, Math.max(0, s.x + dx))
      y = Math.min(1 - height, Math.max(0, s.y + dy))
    } else {
      if (d.grip === 'nw' || d.grip === 'sw') {
        x = Math.min(s.x + s.width - MIN_SIDE, Math.max(0, s.x + dx))
        width = s.x + s.width - x
      } else {
        width = Math.min(1 - s.x, Math.max(MIN_SIDE, s.width + dx))
      }
      if (d.grip === 'nw' || d.grip === 'ne') {
        y = Math.min(s.y + s.height - MIN_SIDE, Math.max(0, s.y + dy))
        height = s.y + s.height - y
      } else {
        height = Math.min(1 - s.y, Math.max(MIN_SIDE, s.height + dy))
      }
    }
    setCrop({ x, y, width, height })
  }
  const grab = (grip: Grip) => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { grip, id: e.pointerId, x: e.clientX, y: e.clientY, start: crop }
  }
  const release = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null
  }
  const pct = (v: number) => `${v * 100}%`
  const aspect = bitmap ? bitmap.width / bitmap.height : 4 / 3

  return (
    <DialogContent title="Edit picture" className="w-[min(46rem,calc(100%-2rem))]">
      <div className="grid gap-5">
        <div className="grid justify-items-center rounded-control bg-surface-sunken p-3">
          <div
            ref={area}
            className="relative touch-none select-none"
            style={{ aspectRatio: `${aspect}`, width: `min(100%, ${aspect * 340}px)` }}
            onPointerMove={onMove}
            onPointerUp={release}
            onPointerCancel={release}
          >
            <canvas ref={canvas} aria-label="Picture" className="block size-full" />
            {/* Outside the crop is dimmed, only over the picture. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div
                className="absolute shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]"
                style={{
                  left: pct(crop.x),
                  top: pct(crop.y),
                  width: pct(crop.width),
                  height: pct(crop.height),
                }}
              />
            </div>
            {/* The crop's frame, with four corner grips. */}
            <div
              role="group"
              aria-label="Crop"
              className="absolute cursor-move ring-2 ring-white"
              style={{
                left: pct(crop.x),
                top: pct(crop.y),
                width: pct(crop.width),
                height: pct(crop.height),
              }}
              onPointerDown={grab('move')}
            >
              {(['nw', 'ne', 'sw', 'se'] as const).map((grip) => (
                <span
                  key={grip}
                  aria-hidden="true"
                  onPointerDown={grab(grip)}
                  className="absolute size-7 rounded-full bg-white shadow-raised ring-2 ring-ink/30"
                  style={{
                    left: grip.endsWith('w') ? -14 : undefined,
                    right: grip.endsWith('e') ? -14 : undefined,
                    top: grip.startsWith('n') ? -14 : undefined,
                    bottom: grip.startsWith('s') ? -14 : undefined,
                    cursor: grip === 'nw' || grip === 'se' ? 'nwse-resize' : 'nesw-resize',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="md" icon={<RotateCcw size={16} />} onClick={() => setCrop(FULL_CROP)}>
            Show all of it
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Title"
            value={title}
            placeholder="No title"
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            label="Caption"
            value={caption}
            placeholder="No caption"
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>
        {title || caption ? (
          <Slider
            label="Text size"
            value={fontSize}
            min={8}
            max={40}
            onChange={setFontSize}
            format={(v) => `${v} pt`}
          />
        ) : null}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!bitmap}
          onClick={() => {
            if (!bitmap) return
            editor.updateObject(
              editPicture(
                image,
                { width: bitmap.width, height: bitmap.height },
                { crop, title: title.trim(), caption: caption.trim(), fontSize },
              ),
              'Edit picture',
            )
            onDone()
          }}
        >
          Done
        </Button>
      </div>
    </DialogContent>
  )
}
