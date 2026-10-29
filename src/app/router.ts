import { useSyncExternalStore } from 'react'

/**
 * Hash-based routes (#/notebook/<id>). They work on any static host, including GitHub Pages,
 * and inside a future native wrapper, without server rewrites.
 */
export type Route =
  | { name: 'library' }
  | { name: 'shop' }
  | { name: 'notebook'; id: string }
  | { name: 'folder'; id: string }

export function parseRoute(hash: string): Route {
  if (hash === '#/shop') return { name: 'shop' }
  const match = /^#\/(notebook|folder)\/([\w-]+)$/.exec(hash)
  if (match?.[1] && match[2]) return { name: match[1] as 'notebook' | 'folder', id: match[2] }
  return { name: 'library' }
}

export function routeToHash(route: Route): string {
  if (route.name === 'library') return '#/'
  if (route.name === 'shop') return '#/shop'
  return `#/${route.name}/${route.id}`
}

export function navigate(route: Route): void {
  window.location.hash = routeToHash(route)
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseRoute(hash)
}
