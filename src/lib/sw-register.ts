export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      // Whether a worker already controls this page. Only an UPDATE (a new worker replacing the
      // one that booted this page) should reload; the first-ever control handoff on a fresh
      // registration must not.
      const hadController = !!navigator.serviceWorker.controller
      let reloading = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloading) return
        reloading = true
        // A new deploy activated. Reload so the page runs the new bundle instead of the stale
        // one it booted with (the root cause of "I refreshed but still see the old behaviour").
        // Safe: the workbook studio persists its session to localStorage and restores it on
        // load, so no unsaved work is lost. The flag lets that page's beforeunload guard skip
        // its "unsaved changes" prompt for this programmatic reload.
        ;(window as unknown as { __stillpointReloading?: boolean }).__stillpointReloading = true
        window.location.reload()
      })

      const registration = await navigator.serviceWorker.register('/sw.js')

      // Check for a newer worker now and whenever the tab regains focus, so long-lived tabs
      // pick up fresh deploys promptly instead of running stale code indefinitely.
      void registration.update()
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update()
      })
    } catch (error) {
      console.error('SW registration failed:', error)
    }
  })
}
