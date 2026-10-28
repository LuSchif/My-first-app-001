import { describe, expect, it } from 'vitest'
import { editPicture, imageBands, pictureOutline, squareCrop } from './image.ts'
import type { ImageObject } from './types.ts'

const picture: ImageObject = {
  id: 'p',
  type: 'image',
  layerId: 'l',
  assetId: 'a',
  opacity: 1,
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  rotation: 0,
}
const pixels = { width: 400, height: 200 }

describe('editing pictures', () => {
  it('crops to a part of the picture at the same scale, around the same middle', () => {
    const cropped = editPicture(picture, pixels, {
      crop: { x: 0.25, y: 0, width: 0.5, height: 1 },
      title: '',
      caption: '',
      fontSize: 14,
    })
    expect(cropped.width).toBeCloseTo(100)
    expect(cropped.height).toBeCloseTo(100)
    expect(cropped.x + cropped.width / 2).toBeCloseTo(200)
    expect(cropped.crop).toEqual({ x: 0.25, y: 0, width: 0.5, height: 1 })
    // Showing all of it again removes the crop and restores the size.
    const back = editPicture(cropped, pixels, {
      crop: { x: 0, y: 0, width: 1, height: 1 },
      title: '',
      caption: '',
      fontSize: 14,
    })
    expect(back.crop).toBeUndefined()
    expect(back.width).toBeCloseTo(200)
  })

  it('makes room for a title and a caption, keeping the picture in place', () => {
    const titled = editPicture(picture, pixels, {
      crop: { x: 0, y: 0, width: 1, height: 1 },
      title: 'Leaf',
      caption: 'Seen in May',
      fontSize: 14,
    })
    const bands = imageBands(titled)
    expect(bands.top).toBeGreaterThan(0)
    expect(bands.bottom).toBeGreaterThan(0)
    expect(titled.height).toBeCloseTo(100 + bands.top + bands.bottom)
    // The picture itself starts where it did.
    expect(titled.y + bands.top).toBeCloseTo(100)
  })

  it('keeps a switched off title or caption, without room for it', () => {
    const quiet = editPicture(picture, pixels, {
      crop: { x: 0, y: 0, width: 1, height: 1 },
      title: 'Leaf',
      caption: 'Seen in May',
      fontSize: 14,
      titleOn: false,
      captionOn: true,
    })
    expect(quiet.title).toBe('Leaf')
    expect(quiet.titleHidden).toBe(true)
    expect(imageBands(quiet).top).toBe(0)
    expect(imageBands(quiet).bottom).toBeGreaterThan(0)
  })

  it('cuts to shapes and rounds corners', () => {
    expect(pictureOutline(undefined, 100, 50)).toBeNull()
    expect(pictureOutline(undefined, 100, 50, 10)).toContain('A10 10')
    for (const shape of ['circle', 'diamond', 'square', 'heart'] as const) {
      expect(pictureOutline(shape, 100, 100)).toMatch(/^M[^NaN]*Z$/)
    }
    // A shape needs a square crop: the largest square in pixels around the same middle.
    const sq = squareCrop({ x: 0, y: 0, width: 1, height: 1 }, { width: 400, height: 200 })
    expect(sq.width * 400).toBeCloseTo(sq.height * 200)
    expect(sq.x + sq.width / 2).toBeCloseTo(0.5)
  })
})
