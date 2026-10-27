import { Capacitor } from '@capacitor/core'

/** Whether Broomit runs as the App Store app rather than in a browser. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}

/** Whether Broomit runs as an installed app (opened from the Home Screen, or the App Store app). */
export function isInstalled(): boolean {
  if (isNativeApp()) return true
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

/** How long after starting a new version is loaded without asking. */
const STARTUP_MS = 10_000

/** Whether reloading now would interrupt nothing the user is doing. */
function calmMoment(): boolean {
  if (performance.now() < STARTUP_MS) return true
  const home = window.location.hash === '' || window.location.hash === '#/'
  return home && !document.querySelector('[role="dialog"]')
}

/**
 * Registers the service worker that keeps the app available offline. Only the production build
 * has one; in development every file comes straight from the dev server.
 *
 * An installed app on iPad is rarely started fresh: it comes back from the background with the
 * version it had. So it looks for a new version whenever it comes back (and every half hour),
 * and once one is installed, takes it at once when that interrupts nothing (in the background,
 * while starting, on the home screen); otherwise it says so and waits for a tap.
 */
export function registerServiceWorker(): void {
  // The App Store app carries its files itself and updates through the App Store.
  if (!import.meta.env.PROD || isNativeApp() || !('serviceWorker' in navigator)) return
  const hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // The first install takes control of a page that is already current.
    if (!hadController) return
    // Nothing is lost by reloading in the background, right after starting (the opening still
    // plays) or on the home screen with no dialog open: notebooks save as they are written.
    if (document.visibilityState === 'hidden' || calmMoment()) {
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
