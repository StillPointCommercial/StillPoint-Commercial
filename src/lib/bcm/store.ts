// Client-side persistence for BCM datasets & scenarios.
// Data is ORG-scoped: a client's whole team shares one dataset + scenarios.
// The platform owner (org_id null) gets a personal workspace.
import { createClient } from '@/lib/supabase/client'
import { ADAPTA } from './seed'
import { PRESETS } from './presets'
import type { Dataset, Params } from './types'

export interface DatasetRow {
  id: string
  name: string
  data: Dataset
  source_filename: string | null
  org_id: string | null
}

export interface ScenarioRow {
  id: string
  name: string
  params: Params
  is_baseline: boolean
  dataset_id: string
  updated_at: string
}

const DS_COLS = 'id,name,data,source_filename,org_id'
const SC_COLS = 'id,name,params,is_baseline,dataset_id,updated_at'

/** Ensure the org (or the owner's personal workspace) has the Adapta dataset + four presets. */
export async function ensureSeed(
  userId: string,
  orgId: string | null,
): Promise<{ dataset: DatasetRow; scenarios: ScenarioRow[] }> {
  const supabase = createClient()

  let query = supabase.from('bcm_datasets').select(DS_COLS).order('created_at', { ascending: true }).limit(1)
  query = orgId ? query.eq('org_id', orgId) : query.is('org_id', null).eq('owner_id', userId)
  let { data: ds } = await query.maybeSingle()

  if (!ds) {
    const ins = await supabase
      .from('bcm_datasets')
      .insert({ owner_id: userId, org_id: orgId, created_by: userId, name: ADAPTA.name, data: ADAPTA })
      .select(DS_COLS)
      .single()
    ds = ins.data
    if (ds) {
      const rows = PRESETS.map((p, i) => ({
        owner_id: userId,
        org_id: orgId,
        created_by: userId,
        dataset_id: ds!.id,
        name: p.label,
        params: p.params,
        is_baseline: i === 0,
      }))
      await supabase.from('bcm_scenarios').insert(rows)
    }
  }

  const { data: scen } = await supabase
    .from('bcm_scenarios')
    .select(SC_COLS)
    .eq('dataset_id', ds!.id)
    .order('created_at', { ascending: true })

  return { dataset: ds as DatasetRow, scenarios: (scen ?? []) as ScenarioRow[] }
}

export async function listScenarios(datasetId: string): Promise<ScenarioRow[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('bcm_scenarios')
    .select(SC_COLS)
    .eq('dataset_id', datasetId)
    .order('created_at', { ascending: true })
  return (data ?? []) as ScenarioRow[]
}

async function datasetOrg(datasetId: string): Promise<string | null> {
  const supabase = createClient()
  const { data } = await supabase.from('bcm_datasets').select('org_id').eq('id', datasetId).maybeSingle()
  return (data?.org_id as string | null) ?? null
}

export async function createScenario(
  userId: string,
  datasetId: string,
  name: string,
  params: Params,
): Promise<ScenarioRow | null> {
  const supabase = createClient()
  const org_id = await datasetOrg(datasetId)
  const { data } = await supabase
    .from('bcm_scenarios')
    .insert({ owner_id: userId, org_id, created_by: userId, dataset_id: datasetId, name, params })
    .select(SC_COLS)
    .single()
  return (data as ScenarioRow) ?? null
}

export async function updateScenario(id: string, patch: { name?: string; params?: Params }): Promise<void> {
  const supabase = createClient()
  await supabase.from('bcm_scenarios').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function deleteScenario(id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('bcm_scenarios').delete().eq('id', id)
}

export async function setBaseline(datasetId: string, id: string): Promise<void> {
  const supabase = createClient()
  await supabase.from('bcm_scenarios').update({ is_baseline: false }).eq('dataset_id', datasetId)
  await supabase.from('bcm_scenarios').update({ is_baseline: true }).eq('id', id)
}

export async function createDataset(
  userId: string,
  orgId: string | null,
  name: string,
  data: Dataset,
  sourceFilename: string | null,
): Promise<DatasetRow | null> {
  const supabase = createClient()
  const { data: row } = await supabase
    .from('bcm_datasets')
    .insert({ owner_id: userId, org_id: orgId, created_by: userId, name, data, source_filename: sourceFilename })
    .select(DS_COLS)
    .single()
  return (row as DatasetRow) ?? null
}
