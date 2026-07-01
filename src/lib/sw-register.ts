export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')

      // Proactively check for a newer worker on every load so fresh deploys are
      // picked up without a hard refresh. (No auto-reload: it would discard unsaved edits.)
      void registration.update()

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
            // New version available, could show a toast here
            console.log('StillPoint CIS: New version available')
          }
        })
      })
    } catch (error) {
      console.error('SW registration failed:', error)
    }
  })
}
