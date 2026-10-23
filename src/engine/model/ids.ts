import type { Id } from './types.ts'

export function newId(): Id {
  return crypto.randomUUID()
}
