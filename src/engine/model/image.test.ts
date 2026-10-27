import { describe, expect, it } from 'vitest'
import { editPicture, imageBands } from './image.ts'
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
})
