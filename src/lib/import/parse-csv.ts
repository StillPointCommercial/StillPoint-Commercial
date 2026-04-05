interface ParsedContact {
  first_name: string
  last_name: string | null
  company: string | null
  role: string | null
  phone: string | null
  email: string | null
  linkedin_url: string | null
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') {
      inQuotes = !inQuotes
    } else if (line[i] === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += line[i]
    }
  }
  result.push(current.trim())
  return result
}

const COLUMN_MAPS: Record<string, keyof ParsedContact> = {
  'first name': 'first_name',
  'first': 'first_name',
  'given name': 'first_name',
  'last name': 'last_name',
  'last': 'last_name',
  'surname': 'last_name',
  'family name': 'last_name',
  'company': 'company',
  'organization': 'company',
  'org': 'company',
  'title': 'role',
  'role': 'role',
  'job title': 'role',
  'phone': 'phone',
  'phone number': 'phone',
  'mobile': 'phone',
  'telephone': 'phone',
  'email': 'email',
  'email address': 'email',
  'e-mail': 'email',
  'linkedin': 'linkedin_url',
  'linkedin url': 'linkedin_url',
}

export function parseCsv(text: string): { contacts: ParsedContact[]; unmappedColumns: string[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return { contacts: [], unmappedColumns: [] }

  const headers = parseCsvLine(lines[0])
  const unmappedColumns: string[] = []

  // Auto-map columns
  const mapping: (keyof ParsedContact | null)[] = headers.map(h => {
    const normalized = h.toLowerCase().trim()
    const mapped = COLUMN_MAPS[normalized] || null
    if (!mapped) unmappedColumns.push(h)
    return mapped
  })

  // Handle "Name" column (combined first + last)
  const nameIndex = headers.findIndex(h => h.toLowerCase().trim() === 'name')
  const hasNameColumn = nameIndex >= 0

  const contacts: ParsedContact[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const contact: ParsedContact = {
      first_name: '',
      last_name: null,
      company: null,
      role: null,
      phone: null,
      email: null,
      linkedin_url: null,
    }

    for (let j = 0; j < values.length; j++) {
      const field = mapping[j]
      if (field && values[j]) {
        (contact as any)[field] = values[j]
      }
    }

    // Handle combined name
    if (hasNameColumn && !contact.first_name && values[nameIndex]) {
      const parts = values[nameIndex].split(' ')
      contact.first_name = parts[0]
      contact.last_name = parts.slice(1).join(' ') || null
    }

    if (contact.first_name) {
      contacts.push(contact)
    }
  }

  return { contacts, unmappedColumns }
}
