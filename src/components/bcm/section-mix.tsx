'use client'

import { Panel, Slider, tbl } from '@/components/suite/ui'
import { fmtM, fmtPct } from '@/lib/bcm/format'
import type { Params, Computed, Dataset, ProductKey } from '@/lib/bcm/types'
import { C, DoughnutChart, StackedAreaChart, type SeriesDef } from './charts'
import { SectionGrid, SectionHeading, SliderGroupNote, yearRows } from './helpers'

const PRODUCT_SERIES: { key: ProductKey; name: string }[] = [
  { key: 'google_lic', name: 'Google licenties' },
  { key: 'ms_lic', name: 'Microsoft licenties' },
  { key: 'beheer', name: 'Beheer' },
  { key: 'bereik', name: 'Bereikbaarheid' },
  { key: 'omsorg', name: 'Omsorg' },
  { key: 'ow', name: 'Onafh. werkplek' },
  { key: 'hw_new', name: 'Hardware nieuw' },
  { key: 'hw_repl', name: 'Hardware vervanging' },
  { key: 'proj', name: 'Projecten' },
  { key: 'puls_hello', name: 'Puls Hello' },
  { key: 'puls_dwv', name: 'Puls DWV' },
  { key: 'grund', name: 'Grund' },
]

const AREA_PALETTE = [
  C.accent, C.accentDark, C.slate, C.accentMid, C.accentLight, C.warm,
  C.neutral, '#7c8aa0', '#86b3aa', '#c7a98c', '#aab7c4', '#5b8f86',
]

export function SectionMix({
  params,
  set,
  c,
  dataset,
}: {
  params: Params
  set: <K extends keyof Params>(k: K, v: Params[K]) => void
  c: Computed
  dataset: Dataset
}) {
  const pie = c.mixShares.map((m) => ({ name: m.label, value: m.share }))

  const productRows = yearRows(
    c.years,
    PRODUCT_SERIES.reduce<Record<string, number[]>>((acc, p) => {
      acc[p.key] = dataset.productLines[p.key]
      return acc
    }, {}),
  )
  const areaSeries: SeriesDef[] = PRODUCT_SERIES.map((p, i) => ({
    key: p.key,
    name: p.name,
    color: AREA_PALETTE[i % AREA_PALETTE.length],
  }))

  return (
    <section className="space-y-4">
      <SectionHeading n={2} title="Product mix & margin" />
      <SectionGrid
        sliders={
          <div>
            <Slider label="Licenties" value={params.mix_lic} min={0} max={100} step={1} onChange={(v) => set('mix_lic', v)} format={(n) => `${n}%`} />
            <Slider label="Beheer & support" value={params.mix_beheer} min={0} max={100} step={1} onChange={(v) => set('mix_beheer', v)} format={(n) => `${n}%`} />
            <Slider label="Omsorg / IAM" value={params.mix_omsorg} min={0} max={100} step={1} onChange={(v) => set('mix_omsorg', v)} format={(n) => `${n}%`} />
            <Slider label="Bereikbaarheid" value={params.mix_bereik} min={0} max={100} step={1} onChange={(v) => set('mix_bereik', v)} format={(n) => `${n}%`} />
            <Slider label="Hardware" value={params.mix_hardware} min={0} max={100} step={1} onChange={(v) => set('mix_hardware', v)} format={(n) => `${n}%`} />
            <Slider label="Puls" value={params.mix_puls} min={0} max={100} step={1} onChange={(v) => set('mix_puls', v)} format={(n) => `${n}%`} />
            <Slider label="Grund" value={params.mix_grund} min={0} max={100} step={1} onChange={(v) => set('mix_grund', v)} format={(n) => `${n}%`} />
            <SliderGroupNote>Shares normalise to 100%.</SliderGroupNote>
          </div>
        }
      >
        <Panel title="Revenue mix" subtitle="weighted to derive blended margin">
          <DoughnutChart data={pie} />
        </Panel>

        <Panel title="Direct margin per year">
          <table className={tbl.table}>
            <thead>
              <tr>
                <th className={tbl.th}>Year</th>
                <th className={tbl.thR}>New revenue</th>
                <th className={tbl.thR}>Direct margin</th>
                <th className={tbl.thR}>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {c.years.map((y, i) => (
                <tr key={y} className={tbl.tr}>
                  <td className={tbl.td}>{y}</td>
                  <td className={tbl.tdR}>{fmtM(c.newLogoRev[i])}</td>
                  <td className={tbl.tdR}>{fmtM(c.marginEuro[i])}</td>
                  <td className={tbl.tdR}>{fmtPct(c.blendedMargin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Product mix in the current forecast" subtitle="reference">
          <StackedAreaChart data={productRows} xKey="year" series={areaSeries} />
        </Panel>
      </SectionGrid>
    </section>
  )
}
