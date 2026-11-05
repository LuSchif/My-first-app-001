/**
 * What happened to the pen samples of the last stroke, for the frame rate meter: how many
 * arrived, how many became points of the line and why the others did not, and the raw samples
 * themselves (x, y in screen pixels, time stamp in ms, the time stamp of the event that carried
 * them), so they can be copied and looked at. Kept for one stroke only.
 */
export interface InkDiagnostics {
  received: number
  kept: number
  late: number
  repeats: number
  tooClose: number
  raw: number[]
}

export const inkDiagnostics: { last: InkDiagnostics | null } = { last: null }
