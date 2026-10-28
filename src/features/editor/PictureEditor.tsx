import { Circle, Diamond, Heart, RotateCcw, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Editor } from '../../engine/editor/Editor.ts'
import {
  DEFAULT_CAPTION_SIZE,
  editPicture,
  FULL_CROP,
  imageBands,
  imageCrop,
  pictureOutline,
  squareCrop,
  takesRoundCorners,
  type Crop,
} from '../../engine/model/image.ts'
import type { ImageObject, PictureShape } from '../../engine/model/types.ts'
import { loadImage } from '../../engine/render/images.ts'
import { Button, Dialog, DialogContent, Slider, Switch, TextField } from '../../design/index.ts'
import { ObjectPreview } from './ObjectPreview.tsx'

/** The smallest crop, as a share of the picture's side. */
const MIN_SIDE = 0.05

type Grip = 'move' | 'nw' | 'ne' | 'sw' | 'se'

/**
 * Edits a picture after it was added: which part of it shows (dragging the corners or the
 * whole frame), a shape or round edges, and a title above and a caption below it, each switched
 * on or off. Everything shows live in the preview and is saved together, as one undo step.
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

const SHAPES: { shape: PictureShape; label: string; icon: React.ReactNode }[] = [
  { shape: 'circle', label: 'Circle', icon: <Circle size={18} /> },
  { shape: 'diamond', label: 'Diamond', icon: <Diamond size={18} /> },
  { shape: 'square', label: 'Square', icon: <Square size={18} /> },
  { shape: 'heart', label: 'Heart', icon: <Heart size={18} /> },
]

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
  const [titleOn, setTitleOn] = useState(!image.titleHidden)
  const [captionOn, setCaptionOn] = useState(!image.captionHidden)
  const [fontSize, setFontSize] = useState(Math.round(image.fontSize ?? DEFAULT_CAPTION_SIZE))
  const [radius, setRadius] = useState(Math.round(image.cornerRadius ?? 0))
  const [shapeOn, setShapeOn] = useState(Boolean(image.shape))
  const [shape, setShape] = useState<PictureShape>(image.shape ?? 'circle')
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

  const pixels = bitmap ? { width: bitmap.width, height: bitmap.height } : null
  // A shape needs a square crop.
  const square = (c: Crop) => (shapeOn && pixels ? squareCrop(c, pixels) : c)

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
      setCrop({ x, y, width, height })
      return
    }
    const west = d.grip === 'nw' || d.grip === 'sw'
    const north = d.grip === 'nw' || d.grip === 'ne'
    if (west) {
      x = Math.min(s.x + s.width - MIN_SIDE, Math.max(0, s.x + dx))
      width = s.x + s.width - x
    } else {
      width = Math.min(1 - s.x, Math.max(MIN_SIDE, s.width + dx))
    }
    if (north) {
      y = Math.min(s.y + s.height - MIN_SIDE, Math.max(0, s.y + dy))
      height = s.y + s.height - y
    } else {
      height = Math.min(1 - s.y, Math.max(MIN_SIDE, s.height + dy))
    }
    if (shapeOn && pixels) {
      // Square: the shorter side wins, and the corner opposite the grip stays put.
      const side = Math.min(width * pixels.width, height * pixels.height)
      const w = side / pixels.width
      const h = side / pixels.height
      if (west) x += width - w
      if (north) y += height - h
      width = w
      height = h
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

  const rounded = takesRoundCorners(shapeOn ? shape : undefined)
  // The picture as it will be on the page, for the live preview.
  const result = pixels
    ? editPicture(image, pixels, {
        crop,
        title: title.trim(),
        caption: caption.trim(),
        fontSize,
        titleOn,
        captionOn,
        cornerRadius: rounded ? radius : 0,
        shape: shapeOn ? shape : null,
      })
    : null
  const shown = result ? result.height - imageBands(result).top - imageBands(result).bottom : 1
  // The cut-out over the crop, in shares of the crop's frame (100 × 100).
  const outline = result
    ? pictureOutline(
        shapeOn ? shape : undefined,
        100,
        100,
        rounded ? (radius / result.width) * 100 : 0,
        rounded ? (radius / shown) * 100 : 0,
      )
    : null
  const maxRadius = result ? Math.max(1, Math.floor(Math.min(result.width, shown) / 2)) : 50

  return (
    <DialogContent title="Edit picture" className="w-[min(46rem,calc(100%-2rem))]">
      <div className="grid gap-5">
        <div className="grid justify-items-center rounded-control bg-surface-sunken p-3">
          <div
            ref={area}
            className="relative touch-none select-none"
            style={{ aspectRatio: `${aspect}`, width: `min(100%, ${aspect * 300}px)` }}
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
            {/* The crop's frame, with four corner grips, and the shape it is cut to. */}
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
              {outline ? (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 size-full overflow-visible"
                >
                  {/* A dark line under the dashes, so they show on light pictures too. */}
                  <path
                    d={outline}
                    fill="none"
                    stroke="rgb(0 0 0 / 0.45)"
                    strokeWidth={4}
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={outline}
                    fill="none"
                    stroke="white"
                    strokeWidth={2}
                    strokeDasharray="6 5"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
              ) : null}
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
          <Button
            size="md"
            icon={<RotateCcw size={16} />}
            onClick={() => setCrop(square(FULL_CROP))}
          >
            Show all of it
          </Button>
        </div>

        <section className="grid gap-3 rounded-card bg-surface p-4 ring-1 ring-line">
          <Switch
            label="Shape"
            hint="Cut the picture to a circle, diamond, square or heart"
            checked={shapeOn}
            onChange={(on) => {
              setShapeOn(on)
              if (on && pixels) setCrop((c) => squareCrop(c, pixels))
            }}
          />
          {shapeOn ? (
            <div role="radiogroup" aria-label="Shape" className="grid grid-cols-4 gap-2">
              {SHAPES.map((s) => (
                <button
                  key={s.shape}
                  type="button"
                  role="radio"
                  aria-checked={shape === s.shape}
                  onClick={() => setShape(s.shape)}
                  className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-control text-xs font-semibold ring-1 ring-line aria-checked:bg-ink aria-checked:text-ink-inverse aria-checked:ring-ink"
                >
                  {s.icon}
                  {s.label}
                </button>
              ))}
            </div>
          ) : null}
          {rounded ? (
            <Slider
              label="Round edges"
              value={Math.min(radius, maxRadius)}
              min={0}
              max={maxRadius}
              onChange={setRadius}
              format={(v) => (v === 0 ? 'Off' : `${v} pt`)}
            />
          ) : null}
        </section>

        <section className="grid gap-3 rounded-card bg-surface p-4 ring-1 ring-line">
          <Switch label="Title" checked={titleOn} onChange={setTitleOn} />
          {titleOn ? (
            <TextField
              label="Title"
              hideLabel
              value={title}
              placeholder="Title above the picture"
              onChange={(e) => setTitle(e.target.value)}
            />
          ) : null}
          <Switch label="Caption" checked={captionOn} onChange={setCaptionOn} />
          {captionOn ? (
            <TextField
              label="Caption"
              hideLabel
              value={caption}
              placeholder="Caption below the picture"
              onChange={(e) => setCaption(e.target.value)}
            />
          ) : null}
          {(titleOn && title.trim()) || (captionOn && caption.trim()) ? (
            <Slider
              label="Text size"
              value={fontSize}
              min={8}
              max={40}
              onChange={setFontSize}
              format={(v) => `${v} pt`}
            />
          ) : null}
        </section>

        {result ? (
          <section className="grid gap-2">
            <p className="text-sm font-semibold">Preview</p>
            <ObjectPreview object={result} height={220} />
          </section>
        ) : null}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={!result}
          onClick={() => {
            if (!result) return
            editor.updateObject(result, 'Edit picture')
            onDone()
          }}
        >
          Done
        </Button>
      </div>
    </DialogContent>
  )
}
