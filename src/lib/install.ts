/** Whether Broomit runs as an installed app (opened from the Home Screen). */
export function isInstalled(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches
}

/**
 * Registers the service worker that keeps the app available offline. Only the production build
 * has one; in development every file comes straight from the dev server.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err: unknown) => console.warn(err))
  })
}
