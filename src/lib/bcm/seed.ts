// Business Case Model: canonical Adapta dataset (ships so the tool works before any import).
import type { Dataset } from './types'

export const ADAPTA: Dataset = {
  name: 'Adapta',
  baseline: 9446230,
  productLines: {
    google_lic: [150000, 450000, 750000, 1200000, 1650000],
    ms_lic:     [0, 200000, 500000, 800000, 1100000],
    beheer:     [80000, 300000, 650000, 1050000, 1450000],
    bereik:     [40000, 140000, 280000, 440000, 620000],
    omsorg:     [60000, 280000, 600000, 950000, 1300000],
    ow:         [0, 240000, 360000, 720000, 1200000],
    hw_new:     [50000, 200000, 400000, 650000, 950000],
    hw_repl:    [0, 0, 900000, 0, 950000],
    proj:       [60000, 150000, 250000, 350000, 450000],
    puls_hello: [0, 70000, 220000, 420000, 700000],
    puls_dwv:   [0, 150000, 500000, 1000000, 1700000],
    grund:      [0, 180000, 300000, 420000, 540000],
  },
  motion: {
    new_business: [340000, 1300000, 2550000, 4050000, 5600000],
    cross_up:     [100000, 420000, 1780000, 1390000, 2870000],
    innov:        [0, 640000, 1380000, 2560000, 4140000],
  },
  logoPatternG: [1, 2, 2, 3, 3],
  logoPatternMS: [0, 1, 2, 2, 2],
  pulsLogos: [0, 1, 2, 3, 4],
  planHerijkt: {
    laag: [9500000, 12500000, 15500000, 19000000, 22500000],
    mid:  [10000000, 14000000, 18500000, 22500000, 26500000],
    hoog: [10500000, 15000000, 19500000, 25000000, 30500000],
  },
  margins: { lic: 0.10, beheer: 0.18, omsorg: 0.42, bereik: 0.80, hardware: 0.19, puls: 0.18, grund: 0.30 },
}
