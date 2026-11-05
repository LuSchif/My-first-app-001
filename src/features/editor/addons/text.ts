/** An angle in words: 45° clockwise, 30° counter-clockwise. */
export function angleText(a: number): string {
  if (a === 0) return 'Not turned'
  return a > 0 ? `${a}° clockwise` : `${-a}° counter-clockwise`
}
