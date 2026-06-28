'use client'

import { Panel, Slider, tbl } from '@/components/suite/ui'
import { fmtM, fmtPct } from '@/lib/bcm/format'
import type { Params, Computed, Dataset } from '@/lib/bcm/types'
import { CAT, DoughnutChart, StackedAreaChart, type Datum, type SeriesDef } from './charts'
import { SectionGrid, SectionHeading, SliderGroupNote } from './helpers'

export function SectionMix({
  params,
  set,
  c,
  dataset: _dataset,
}: {
  params: Params
  set: <K extends keyof Params>(k: K, v: Params[K]) => void
  c: Computed
  dataset: Dataset
}) {
  const pie = c.mixShares.map((m) => ({ name: m.label, value: m.share }))

  // Live, slider-driven product-mix projection: split each year's new-logo
  // revenue across the 7 mix categories by their normalised share. Same
  // CAT[i] colour mapping as the doughnut above, so the two read together.
  const shareTotal = c.mixShares.reduce((s, m) => s + m.share, 0) || 1
  const projRows: Datum[] = c.years.map((y, yi) => {
    const row: Datum = { year: String(y) }
    c.mixShares.forEach((m) => {
      row[m.key] = c.newLogoRev[yi] * (m.share / shareTotal)
    })
    return row
  })
  const projSeries: SeriesDef[] = c.mixShares.map((m, i) => ({
    key: m.key,
    name: m.label,
    color: CAT[i % CAT.length],
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

        <Panel title="Product mix projection" subtitle="new-logo revenue split by mix share">
          <StackedAreaChart data={projRows} xKey="year" series={projSeries} />
        </Panel>
      </SectionGrid>
    </section>
  )
}
