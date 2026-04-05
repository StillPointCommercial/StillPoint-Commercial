interface ParsedContact {
  first_name: string
  last_name: string | null
  company: string | null
  role: string | null
  phone: string | null
  email: string | null
  linkedin_url: string | null
}

export function parseVCard(text: string): ParsedContact[] {
  const contacts: ParsedContact[] = []
  const cards = text.split('BEGIN:VCARD').slice(1)

  for (const card of cards) {
    const lines = card.split(/\r?\n/)
    const contact: ParsedContact = {
      first_name: '',
      last_name: null,
      company: null,
      role: null,
      phone: null,
      email: null,
      linkedin_url: null,
    }

    for (const line of lines) {
      const colonIndex = line.indexOf(':')
      if (colonIndex === -1) continue

      const field = line.slice(0, colonIndex).split(';')[0].toUpperCase()
      const value = line.slice(colonIndex + 1).trim()

      if (!value) continue

      switch (field) {
        case 'N': {
          const parts = value.split(';')
          contact.last_name = parts[0] || null
          contact.first_name = parts[1] || ''
          break
        }
        case 'FN':
          if (!contact.first_name) {
            const parts = value.split(' ')
            contact.first_name = parts[0]
            contact.last_name = parts.slice(1).join(' ') || null
          }
          break
        case 'ORG':
          contact.company = value.replace(/;/g, ' ').trim() || null
          break
        case 'TITLE':
          contact.role = value || null
          break
        case 'TEL':
          if (!contact.phone) contact.phone = value
          break
        case 'EMAIL':
          if (!contact.email) contact.email = value
          break
        case 'URL':
          if (value.includes('linkedin')) contact.linkedin_url = value
          break
      }
    }

    if (contact.first_name) {
      contacts.push(contact)
    }
  }

  return contacts
}
