'use client'

import { useState, useCallback } from 'react'
import { Upload, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import type { RelationshipStatus } from '@/lib/types'
import { STATUS_LABELS } from '@/lib/types'
import { parseVCard } from '@/lib/import/parse-vcard'
import { parseCsv } from '@/lib/import/parse-csv'
import { createContact } from '@/lib/db/contacts'
import { findDuplicates, type DedupGroup } from '@/lib/ai/dedup-client'
import { createClient } from '@/lib/supabase/client'

interface ParsedContact {
  first_name: string
  last_name: string | null
  company: string | null
  role: string | null
  phone: string | null
  email: string | null
  linkedin_url: string | null
  selected: boolean
}

type Step = 'upload' | 'preview' | 'dedup' | 'importing' | 'done'

const statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))

export function ImportWizard() {
  const [step, setStep] = useState<Step>('upload')
  const [contacts, setContacts] = useState<ParsedContact[]>([])
  const [bulkStatus, setBulkStatus] = useState<RelationshipStatus>('dormant')
  const [unmapped, setUnmapped] = useState<string[]>([])
  const [dedupGroups, setDedupGroups] = useState<DedupGroup[]>([])
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, skipped: 0 })
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    const text = await file.text()

    if (file.name.endsWith('.vcf') || file.name.endsWith('.vcard')) {
      const parsed = parseVCard(text)
      setContacts(parsed.map(c => ({ ...c, selected: true })))
      setUnmapped([])
    } else if (file.name.endsWith('.csv')) {
      const { contacts: parsed, unmappedColumns } = parseCsv(text)
      setContacts(parsed.map(c => ({ ...c, selected: true })))
      setUnmapped(unmappedColumns)
    } else {
      setError('Please upload a .vcf or .csv file')
      return
    }

    setStep('preview')
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function toggleContact(index: number) {
    setContacts(prev => prev.map((c, i) => i === index ? { ...c, selected: !c.selected } : c))
  }

  async function handleCheckDuplicates() {
    const selected = contacts.filter(c => c.selected)
    const forDedup = selected.map((c, i) => ({
      id: String(i),
      first_name: c.first_name,
      last_name: c.last_name,
      company: c.company,
      email: c.email,
      phone: c.phone,
    }))

    try {
      const result = await findDuplicates(forDedup)
      setDedupGroups(result.groups)
      setStep('dedup')
    } catch {
      // Skip dedup on error, go straight to import
      await handleImport()
    }
  }

  async function handleImport() {
    const selected = contacts.filter(c => c.selected)
    setStep('importing')
    setImportProgress({ done: 0, total: selected.length, skipped: 0 })

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let done = 0
    let skipped = 0

    for (const contact of selected) {
      try {
        await createContact({
          user_id: user.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          company: contact.company,
          role: contact.role,
          phone: contact.phone,
          email: contact.email,
          linkedin_url: contact.linkedin_url,
          relationship_status: bulkStatus,
          icp_fit: 'not_assessed',
          tags: [],
          general_notes: null,
          last_contact_date: null,
          next_action: null,
          next_action_date: null,
        })
        done++
      } catch {
        skipped++
      }
      setImportProgress({ done: done + skipped, total: selected.length, skipped })
    }

    setStep('done')
  }

  // Upload step
  if (step === 'upload') {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed border-sand rounded-card p-12 text-center"
      >
        <Upload size={48} className="mx-auto text-stone mb-4" />
        <p className="text-charcoal font-medium mb-2">Drop your contacts file here</p>
        <p className="text-text-light text-sm mb-4">Supports .vcf (vCard) and .csv files</p>
        <label className="inline-block">
          <input
            type="file"
            accept=".vcf,.vcard,.csv"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <span className="inline-flex items-center px-4 py-2 rounded-input bg-terracotta text-warm-white text-sm font-medium cursor-pointer hover:bg-terracotta-muted transition-colors">
            Choose file
          </span>
        </label>
        {error && <p className="text-attention-red text-sm mt-4">{error}</p>}
      </div>
    )
  }

  // Preview step
  if (step === 'preview') {
    const selectedCount = contacts.filter(c => c.selected).length

    return (
      <div>
        {unmapped.length > 0 && (
          <div className="bg-caution-amber/10 border border-caution-amber/30 rounded-card p-3 mb-4 text-sm">
            <AlertTriangle size={14} className="inline mr-1 text-caution-amber" />
            Unmapped columns: {unmapped.join(', ')}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-text-light">{selectedCount} of {contacts.length} selected</p>
          <div className="flex items-center gap-3">
            <Select
              value={bulkStatus}
              options={statusOptions}
              onChange={e => setBulkStatus(e.target.value as RelationshipStatus)}
            />
          </div>
        </div>

        <div className="border border-border rounded-card overflow-hidden mb-4">
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-sand sticky top-0">
                <tr>
                  <th className="p-2 text-left w-8">
                    <input
                      type="checkbox"
                      checked={contacts.every(c => c.selected)}
                      onChange={() => {
                        const allSelected = contacts.every(c => c.selected)
                        setContacts(prev => prev.map(c => ({ ...c, selected: !allSelected })))
                      }}
                    />
                  </th>
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left hidden md:table-cell">Company</th>
                  <th className="p-2 text-left hidden md:table-cell">Email</th>
                  <th className="p-2 text-left hidden md:table-cell">Phone</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c, i) => (
                  <tr key={i} className="border-t border-border hover:bg-sand-light">
                    <td className="p-2">
                      <input type="checkbox" checked={c.selected} onChange={() => toggleContact(i)} />
                    </td>
                    <td className="p-2 text-charcoal">{c.first_name} {c.last_name}</td>
                    <td className="p-2 text-text-light hidden md:table-cell">{c.company || '-'}</td>
                    <td className="p-2 text-text-light hidden md:table-cell">{c.email || '-'}</td>
                    <td className="p-2 text-text-light hidden md:table-cell">{c.phone || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => { setStep('upload'); setContacts([]) }}>Back</Button>
          <Button onClick={handleCheckDuplicates} disabled={selectedCount === 0}>
            Check for duplicates & import ({selectedCount})
          </Button>
        </div>
      </div>
    )
  }

  // Dedup step
  if (step === 'dedup') {
    return (
      <div>
        {dedupGroups.length === 0 ? (
          <div className="text-center py-8 mb-4">
            <Check size={48} className="mx-auto text-success-green mb-2" />
            <p className="text-charcoal font-medium">No duplicates found</p>
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-sm text-text-light mb-3">{dedupGroups.length} potential duplicate group(s) found</p>
            {dedupGroups.map((group, i) => (
              <div key={i} className="border border-caution-amber/30 rounded-card p-3 mb-2 bg-caution-amber/5">
                <p className="text-xs font-medium text-caution-amber mb-2">
                  Possible duplicate ({group.confidence} confidence)
                </p>
                {group.contacts.map((c, j) => (
                  <p key={j} className="text-sm text-charcoal">
                    {c.first_name} {c.last_name} {c.company && `(${c.company})`} {c.email && `- ${c.email}`}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setStep('preview')}>Back</Button>
          <Button onClick={handleImport}>
            Import {contacts.filter(c => c.selected).length} contacts
          </Button>
        </div>
      </div>
    )
  }

  // Importing step
  if (step === 'importing') {
    const pct = importProgress.total > 0
      ? Math.round((importProgress.done / importProgress.total) * 100)
      : 0

    return (
      <div className="text-center py-8">
        <p className="text-charcoal font-medium mb-4">Importing contacts...</p>
        <div className="w-full bg-sand rounded-full h-2 mb-2">
          <div className="bg-terracotta h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-sm text-text-light">{importProgress.done} / {importProgress.total}</p>
      </div>
    )
  }

  // Done step
  return (
    <div className="text-center py-8">
      <Check size={48} className="mx-auto text-success-green mb-4" />
      <p className="text-charcoal font-medium text-lg mb-2">Import complete</p>
      <p className="text-text-light text-sm mb-4">
        {importProgress.done - importProgress.skipped} imported
        {importProgress.skipped > 0 && `, ${importProgress.skipped} skipped`}
      </p>
      <Button onClick={() => { setStep('upload'); setContacts([]); setImportProgress({ done: 0, total: 0, skipped: 0 }) }}>
        Import more
      </Button>
    </div>
  )
}
