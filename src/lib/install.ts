/** Whether Broomit runs as an installed app (opened from the Home Screen). */
export function isInstalled(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches
}

/** Set once a newer version of the app is installed and waits for a reload. */
let updateReady = false
const updateListeners = new Set<() => void>()

export function onUpdateReady(listener: () => void): () => void {
  updateListeners.add(listener)
  return () => updateListeners.delete(listener)
}

export function isUpdateReady(): boolean {
  return updateReady
}

/**
 * Registers the service worker that keeps the app available offline. Only the production build
 * has one; in development every file comes straight from the dev server.
 *
 * An installed app on iPad is rarely started fresh: it comes back from the background with the
 * version it had. So it looks for a new version whenever it comes back (and every half hour),
 * and once one is installed, says so; while the app is in the background it simply reloads.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  const hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The first install takes control of a page that is already current.
    if (!hadController) return
    if (document.visibilityState === 'hidden') {
      window.location.reload()
      return
    }
    updateReady = true
    updateListeners.forEach((fn) => fn())
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        const check = () => void registration.update().catch(() => {})
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check()
        })
        setInterval(check, 30 * 60 * 1000)
      })
      .catch((err: unknown) => console.warn(err))
  })
}
