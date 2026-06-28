// Plain (non-client) helpers safe to call from server or client components.

export function initialsOf(nameOrEmail: string): string {
  const s = nameOrEmail.trim()
  if (s.includes(' ')) {
    return s.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  }
  return s.slice(0, 2).toUpperCase()
}
