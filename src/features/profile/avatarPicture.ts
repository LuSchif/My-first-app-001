/** Side of the stored profile picture, in pixels. */
const SIDE = 320

/** A picture cut to a square around its middle and made small, as a JPEG data URL. */
export async function avatarPicture(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIDE
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, SIDE, SIDE)
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIDE,
    SIDE,
  )
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.85)
}
