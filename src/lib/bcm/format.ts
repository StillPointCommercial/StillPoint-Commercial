// Display formatters for the Business Case Model.

export function fmtM(n: number, digits = 1): string {
  return `€${(n / 1e6).toFixed(digits)}M`
}

export function fmtEur(n: number, precise = false): string {
  const abs = Math.abs(n)
  if (!precise) {
    if (abs >= 1e6) return `€${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`
    if (abs >= 1e3) return `€${Math.round(n / 1e3)}k`
  }
  return `€${Math.round(n).toLocaleString('nl-NL')}`
}

export function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`
}

export function fmtNum(n: number, digits = 0): string {
  return n.toLocaleString('nl-NL', { maximumFractionDigits: digits })
}

/** Signed delta in millions, using a true minus sign. e.g. +€2.3M / −€0.8M */
export function fmtSignedM(n: number, digits = 1): string {
  const sign = n >= 0 ? '+' : '−'
  return `${sign}€${(Math.abs(n) / 1e6).toFixed(digits)}M`
}
