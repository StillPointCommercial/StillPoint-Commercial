export function Greeting() {
  const hour = new Date().getHours()
  let greeting = 'Good evening'
  if (hour < 12) greeting = 'Good morning'
  else if (hour < 18) greeting = 'Good afternoon'

  const dateStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="mb-6">
      <h1 className="font-dm-serif text-2xl md:text-3xl text-charcoal">{greeting}</h1>
      <p className="text-text-light text-sm mt-1">{dateStr}</p>
    </div>
  )
}
