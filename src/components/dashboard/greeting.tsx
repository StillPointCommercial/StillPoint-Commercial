'use client'

import { useState, useEffect } from 'react'

export function Greeting() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Render a stable placeholder on the server / first client render to avoid
  // hydration mismatch (React error #418). Once mounted, show the real values.
  const hour = mounted ? new Date().getHours() : 12
  let greeting = 'Good evening'
  if (hour < 12) greeting = 'Good morning'
  else if (hour < 18) greeting = 'Good afternoon'

  const dateStr = mounted
    ? new Date().toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '\u00A0' // non-breaking space placeholder

  return (
    <div className="mb-6">
      <h1 className="font-dm-serif text-2xl md:text-3xl text-charcoal">{greeting}</h1>
      <p className="text-text-light text-sm mt-1">{dateStr}</p>
    </div>
  )
}
