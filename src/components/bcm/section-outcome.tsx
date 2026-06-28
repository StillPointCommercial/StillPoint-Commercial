'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { Panel, Segmented, Slider, tbl, cx, pos } from '@/components/suite/ui'
import { fmtEur, fmtM, fmtPct, fmtSignedM } from '@/lib/bcm/format'
import type { Params, Computed, Dataset, Tier } from '@/lib/bcm/types'
import { C, CAT, StackedAreaChart, tipFmt } from './charts'
import { SectionGrid, SectionHeading, SliderGroupNote, yearRows } from './helpers'

const axisTick = { fill: C.ink3, fontSize: 11 } as const
const tooltipStyle = {
  contentStyle: { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 },
  labelStyle: { color: C.slate, fontWeight: 600 },
} as const

export function SectionOutcome({
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
  const [selTier, setSelTier] = useState<Tier>(params.tier)

  const totalRows = yearRows(c.years, {
    base: c.base,
    total: c.totalRevenue,
    forecast: c.forecastTotal,
    planLaag: dataset.planHerijkt.laag,
    planMid: dataset.planHerijkt.mid,
    planHoog: dataset.planHerijkt.hoog,
  })

  const motionRows = yearRows(c.years, {
    nb: c.newLogoRev,
    cu: c.crossUp,
    iv: c.innov,
  })

  const planSel = dataset.planHerijkt[selTier]

  return (
    <section className="space-y-4">
      <SectionHeading n={4} title="Outcome vs plan" />
      <SectionGrid
        sliders={
          <div>
            <Slider label="Core market accounts" value={params.samKern} min={0} max={500} step={1} onChange={(v) => set('samKern', v)} format={(n) => String(n)} />
            <Slider label="Existing accounts" value={params.bestaande} min={0} max={60} step={1} onChange={(v) => set('bestaande', v)} format={(n) => String(n)} />
            <Slider label="Baseline revenue" value={params.baseline} min={0} max={20000000} step={100000} onChange={(v) => set('baseline', v)} format={(n) => fmtEur(n)} />
            <SliderGroupNote>Baseline is the recurring book of business the new motion builds on top of.</SliderGroupNote>
          </div>
        }
      >
        <Panel title="Total revenue vs the plan paths">
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <ComposedChart data={totalRows} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="year" tick={axisTick} tickLine={false} axisLine={{ stroke: C.grid }} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => fmtM(v, v >= 1e7 ? 0 : 1)} />
                <Tooltip {...tooltipStyle} formatter={tipFmt((v) => fmtEur(v))} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <Area type="monotone" dataKey="base" name="Baseline" stroke={C.neutral} fill={C.neutral} fillOpacity={0.35} strokeWidth={1} isAnimationActive={false} />
                <Line type="monotone" dataKey="total" name="Total revenue" stroke={C.accent} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="forecast" name="Forecast" stroke={C.ink3} strokeWidth={1.5} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="planLaag" name="Plan laag" stroke="#cbd5e1" strokeWidth={1.25} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="planMid" name="Plan midden" stroke="#9aa6b2" strokeWidth={1.25} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="planHoog" name="Plan hoog" stroke="#6b7787" strokeWidth={1.25} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="End result vs plan"
          right={
            <Segmented<Tier>
              value={selTier}
              onChange={setSelTier}
              options={[
                { value: 'laag', label: 'Laag' },
                { value: 'mid', label: 'Midden' },
                { value: 'hoog', label: 'Hoog' },
              ]}
            />
          }
        >
          <table className={tbl.table}>
            <thead>
              <tr>
                <th className={tbl.th}>Year</th>
                <th className={tbl.thR}>Base</th>
                <th className={tbl.thR}>New</th>
                <th className={tbl.thR}>Total</th>
                <th className={tbl.thR}>Δ vs plan</th>
              </tr>
            </thead>
            <tbody>
              {c.years.map((y, i) => {
                const delta = c.totalRevenue[i] - planSel[i]
                return (
                  <tr key={y} className={tbl.tr}>
                    <td className={tbl.td}>{y}</td>
                    <td className={tbl.tdR}>{fmtM(c.base[i])}</td>
                    <td className={tbl.tdR}>{fmtM(c.newTotal[i])}</td>
                    <td className={cx(tbl.tdR, 'font-medium')}>{fmtM(c.totalRevenue[i])}</td>
                    <td className={cx(tbl.tdR, 'font-semibold', pos(delta))}>{fmtSignedM(delta)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Panel>

        <Panel title="New revenue by motion">
          <StackedAreaChart
            data={motionRows}
            xKey="year"
            series={[
              { key: 'nb', name: 'New business', color: CAT[0] },
              { key: 'cu', name: 'Cross-sell', color: CAT[2] },
              { key: 'iv', name: 'Innovation', color: CAT[3] },
            ]}
          />
        </Panel>

        <Panel title="Whitespace — accounts still open">
          <table className={tbl.table}>
            <thead>
              <tr>
                <th className={tbl.th}>Year</th>
                <th className={tbl.thR}>Cumulative won</th>
                <th className={tbl.thR}>Whitespace left</th>
                <th className={tbl.thR}>% still open</th>
              </tr>
            </thead>
            <tbody>
              {c.years.map((y, i) => (
                <tr key={y} className={tbl.tr}>
                  <td className={tbl.td}>{y}</td>
                  <td className={tbl.tdR}>{fmtNumR(c.cumWonByYear[i])}</td>
                  <td className={tbl.tdR}>{fmtNumR(c.whitespace[i])}</td>
                  <td className={tbl.tdR}>{fmtPct(c.whitespace[i] / Math.max(1, params.samKern))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </SectionGrid>
    </section>
  )
}

function fmtNumR(n: number): string {
  return Math.round(n).toLocaleString('nl-NL')
}
