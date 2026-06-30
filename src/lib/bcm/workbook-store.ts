// Client-side persistence for workbook (live Google Sheet) scenarios.
// Org-scoped like bcm_scenarios: a client's team shares its scenarios; the owner's
// personal workspace uses org_id null. Each scenario is linked to its own Sheet copy.
import { createClient } from '@/lib/supabase/client'
import type { WorkbookInputs } from './workbook'

export interface WorkbookScenarioRow {
  id: string
  name: string
  source_id: string | null
  copy_id: string | null
  copy_url: string | null
  mapping_id: string
  inputs: WorkbookInputs
  blocks: unknown | null
  updated_at: string
}

const COLS = 'id,name,source_id,copy_id,copy_url,mapping_id,inputs,blocks,updated_at'

export async function listWorkbookScenarios(orgId: string | null, userId: string): Promise<WorkbookScenarioRow[]> {
  const supabase = createClient()
  let q = supabase.from('bcm_workbook_scenarios').select(COLS).order('created_at', { ascending: true })
  q = orgId ? q.eq('org_id', orgId) : q.is('org_id', null).eq('owner_id', userId)
  const { data } = await q
  return (data ?? []) as WorkbookScenarioRow[]
}

export interface NewWorkbookScenario {
  name: string
  source_id: string | null
  copy_id: string | null
  copy_url: string | null
  mapping_id: string
  inputs: WorkbookInputs
  blocks: unknown
}

export async function createWorkbookScenario(
  userId: string,
  orgId: string | null,
  row: NewWorkbookScenario,
): Promise<WorkbookScenarioRow | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('bcm_workbook_scenarios')
    .insert({ owner_id: userId, org_id: orgId, created_by: userId, ...row })
    .select(COLS)
    .single()
  return (data as WorkbookScenarioRow) ?? null
}

export async function updateWorkbookScenario(
  id: string,
  patch: Partial<{ name: string; copy_id: string; copy_url: string; inputs: WorkbookInputs; blocks: unknown }>,
): Promise<void> {
  const supabase = createClient()
  await supabase
    .from('bcm_workbook_scenarios')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
}

export async function deleteWorkbookScenario(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('bcm_workbook_scenarios').delete().eq('id', id)
}
