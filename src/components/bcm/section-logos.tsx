'use client'

import { Panel, Slider } from '@/components/suite/ui'
import { fmtEur } from '@/lib/bcm/format'
import type { Params, Computed, Dataset } from '@/lib/bcm/types'
import { C, CAT, LinesChart, StackedBarsChart } from './charts'
import { SectionGrid, SectionHeading, SliderGroupNote, indexRows, yearRows } from './helpers'

export function SectionLogos({
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
  const valueRows = indexRows(5, 'jr', {
    g: c.valuePerLogoG,
    ms: c.valuePerLogoMS,
  })

  const revRows = yearRows(c.years, {
    total: c.newLogoRev,
    g: c.newLogoRevG,
    ms: c.newLogoRevMS,
    forecast: c.forecastNewBusiness,
  })

  const refRows = c.years.map((y, i) => ({
    year: String(y),
    g: dataset.logoPatternG[i] ?? 0,
    ms: dataset.logoPatternMS[i] ?? 0,
    puls: dataset.pulsLogos[i] ?? 0,
  }))

  return (
    <section className="space-y-4">
      <SectionHeading n={3} title="Logo intake & value build" />
      <SectionGrid
        sliders={
          <div>
            <Slider label="Google logos (to 2030)" value={params.gLogos} min={0} max={30} step={1} onChange={(v) => set('gLogos', v)} format={(n) => String(n)} />
            <Slider label="Microsoft logos (to 2030)" value={params.msLogos} min={0} max={30} step={1} onChange={(v) => set('msLogos', v)} format={(n) => String(n)} />
            <Slider label="MAX ARR / Google logo" value={params.gMax} min={0} max={2500000} step={50000} onChange={(v) => set('gMax', v)} format={(n) => fmtEur(n)} />
            <Slider label="MAX ARR / Microsoft logo" value={params.msMax} min={0} max={2500000} step={50000} onChange={(v) => set('msMax', v)} format={(n) => fmtEur(n)} />
            <Slider label="Entry (year 1, % of MAX)" value={params.instap} min={0} max={100} step={1} onChange={(v) => set('instap', v)} format={(n) => `${n}%`} />
            <Slider label="Growth / year (points)" value={params.groei} min={0} max={40} step={1} onChange={(v) => set('groei', v)} format={(n) => `${n}`} />
            <Slider label="Plateau (% of MAX)" value={params.plafond} min={0} max={100} step={1} onChange={(v) => set('plafond', v)} format={(n) => `${n}%`} />
            <SliderGroupNote>
              ARR ramps from entry to plateau over five relationship years.
            </SliderGroupNote>
          </div>
        }
      >
        <Panel title="Value per logo over its lifetime" subtitle="ARR by relationship year">
          <LinesChart
            data={valueRows}
            xKey="jr"
            series={[
              { key: 'g', name: 'Google', color: '#3f6fb0' },
              { key: 'ms', name: 'Microsoft', color: '#e0a52e' },
            ]}
          />
        </Panel>

        <Panel title="New-logo revenue per year">
          <LinesChart
            data={revRows}
            xKey="year"
            series={[
              { key: 'total', name: 'Total', color: C.accent },
              { key: 'g', name: 'Google', color: '#3f6fb0' },
              { key: 'ms', name: 'Microsoft', color: '#e0a52e' },
              { key: 'forecast', name: 'Forecast', color: C.ink3, dashed: true },
            ]}
          />
        </Panel>

        <Panel title="New logos per year (forecast reference)" subtitle="reference">
          <StackedBarsChart
            data={refRows}
            xKey="year"
            bars={[
              { key: 'g', name: 'Google logos', color: CAT[0] },
              { key: 'ms', name: 'Microsoft logos', color: CAT[1] },
              { key: 'puls', name: 'Puls logos', color: CAT[5] },
            ]}
            valueFmt="num"
          />
        </Panel>
      </SectionGrid>
    </section>
  )
}
