import { readFeatures, type Features } from '../../engine/editor/features.ts'

const KEY = 'broomit.features'

export function loadFeatures(): Features {
  try {
    return readFeatures(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return readFeatures(null)
  }
}

export function saveFeatures(features: Features): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(features))
  } catch {
    // Private browsing or full storage: the switches go back to their defaults next time.
  }
}
