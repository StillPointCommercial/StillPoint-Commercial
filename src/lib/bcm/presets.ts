// Business Case Model: the four starter scenarios.
import type { Preset } from './types'

const growthBase = {
  instap: 15, groei: 15, plafond: 75,
  mix_lic: 18, mix_beheer: 20, mix_omsorg: 22, mix_bereik: 12, mix_hardware: 10, mix_puls: 8, mix_grund: 10,
  c_sl: 45, c_ld: 55, c_dd: 55, c_dv: 60, c_vc: 50,
  samKern: 220, bestaande: 16, baseline: 9446230,
  baselineChurn: 0, gtmFte: 2, gtmCostPerFte: 130000, deliveryFte: 1, deliveryCostPerFte: 110000, marketingSpend: 60000, leadCapacity: 80,
}

export const PRESETS: Preset[] = [
  {
    key: 'plan', label: 'Matthias Prognose 1', chip: 'Prognose 1',
    params: {
      tier: 'laag', gLogos: 11, msLogos: 7, gMax: 320000, msMax: 320000,
      instap: 100, groei: 0, plafond: 100,
      mix_lic: 25, mix_beheer: 22, mix_omsorg: 18, mix_bereik: 8, mix_hardware: 12, mix_puls: 8, mix_grund: 7,
      c_sl: 40, c_ld: 55, c_dd: 55, c_dv: 60, c_vc: 50,
      samKern: 220, bestaande: 16, baseline: 9446230,
      baselineChurn: 0, gtmFte: 2, gtmCostPerFte: 130000, deliveryFte: 1, deliveryCostPerFte: 110000, marketingSpend: 60000, leadCapacity: 80,
    },
  },
  {
    key: 'laag', label: 'Waarde groei laag', chip: 'Laag',
    params: { tier: 'laag', gLogos: 9, msLogos: 5, gMax: 1000000, msMax: 1600000, ...growthBase },
  },
  {
    key: 'mid', label: 'Waarde groei midden', chip: 'Midden',
    params: { tier: 'mid', gLogos: 11, msLogos: 11, gMax: 1000000, msMax: 1600000, ...growthBase },
  },
  {
    key: 'hoog', label: 'Waarde groei hoog', chip: 'Hoog',
    params: { tier: 'hoog', gLogos: 11, msLogos: 15, gMax: 1000000, msMax: 1900000, ...growthBase },
  },
]

export const DEFAULT_PRESET_KEY = 'mid'

export function presetByKey(key: string): Preset | undefined {
  return PRESETS.find((p) => p.key === key)
}

/** The three growth presets used by the Scenario overview screen. */
export const GROWTH_KEYS = ['laag', 'mid', 'hoog'] as const
