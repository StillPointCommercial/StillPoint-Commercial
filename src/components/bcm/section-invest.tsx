'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { Panel, Slider, tbl, cx, pos } from '@/components/suite/ui'
import { fmtEur, fmtM } from '@/lib/bcm/format'
import type { Params, Computed } from '@/lib/bcm/types'
import { C, tipFmt } from './charts'
import { SectionGrid, SectionHeading, SliderGroupNote, yearRows } from './helpers'

const axisTick = { fill: C.ink3, fontSize: 11 } as const
const tooltipStyle = {
  contentStyle: { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 },
  labelStyle: { color: C.slate, fontWeight: 600 },
} as const

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: boolean
}) {
  return (
    <div className="rounded-lg border border-suite-border bg-suite-bg px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-suite-ink-3">{label}</div>
      <div
        className={cx(
          'mt-1 text-xl font-semibold tabular-nums',
          accent ? 'text-suite-accent' : 'text-suite-ink',
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-suite-ink-3">{sub}</div>}
    </div>
  )
}

export function SectionInvest({
  params,
  set,
  c,
}: {
  params: Params
  set: <K extends keyof Params>(k: K, v: Params[K]) => void
  c: Computed
}) {
  const cashRows = yearRows(c.years, { cash: c.cumulativeCash })

  return (
    <section className="space-y-4">
      <SectionHeading n={2} title="Investment & payback" />
      <SectionGrid
        sliders={
          <div>
            <Slider label="GTM FTEs" value={params.gtmFte} min={0} max={10} step={1} onChange={(v) => set('gtmFte', v)} format={(n) => String(n)} />
            <Slider label="Cost / GTM FTE" value={params.gtmCostPerFte} min={0} max={250000} step={5000} onChange={(v) => set('gtmCostPerFte', v)} format={(n) => fmtEur(n)} />
            <Slider label="Delivery FTEs" value={params.deliveryFte} min={0} max={10} step={1} onChange={(v) => set('deliveryFte', v)} format={(n) => String(n)} />
            <Slider label="Cost / delivery FTE" value={params.deliveryCostPerFte} min={0} max={250000} step={5000} onChange={(v) => set('deliveryCostPerFte', v)} format={(n) => fmtEur(n)} />
            <Slider label="Marketing / lead-gen spend per yr" value={params.marketingSpend} min={0} max={500000} step={10000} onChange={(v) => set('marketingSpend', v)} format={(n) => fmtEur(n)} />
            <SliderGroupNote>
              Loaded annual cost of the go-to-market and delivery team the new motion requires.
            </SliderGroupNote>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Payback"
            value={c.paybackYear ? `${c.paybackYear}` : '—'}
            sub={c.paybackMonths ? `~${c.paybackMonths} mo from 2026` : 'beyond 2030'}
          />
          <Stat label="ROI" value={`${c.roi.toFixed(1)}×`} sub="contribution ÷ GTM cost" />
          <Stat label="Net by 2030" value={fmtM(c.netByEnd)} sub="cumulative cash" accent />
          <Stat label="GTM cost total" value={fmtM(c.totalGtmCost)} sub="2026–2030" />
        </div>

        <Panel title="Cumulative cash (the J-curve)" subtitle="net cash position after go-to-market cost">
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <ComposedChart data={cashRows} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="year" tick={axisTick} tickLine={false} axisLine={{ stroke: C.grid }} />
                <YAxis tick={axisTick} tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => fmtM(v, Math.abs(v) >= 1e7 ? 0 : 1)} />
                <Tooltip {...tooltipStyle} formatter={tipFmt((v) => fmtEur(v))} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="cash" name="Cumulative cash" stroke={C.accent} strokeWidth={2.5} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Contribution, cost & net cash">
          <table className={tbl.table}>
            <thead>
              <tr>
                <th className={tbl.th}>Year</th>
                <th className={tbl.thR}>Gross contribution</th>
                <th className={tbl.thR}>GTM cost</th>
                <th className={tbl.thR}>Net</th>
                <th className={tbl.thR}>Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {c.years.map((y, i) => (
                <tr key={y} className={tbl.tr}>
                  <td className={tbl.td}>{y}</td>
                  <td className={tbl.tdR}>{fmtM(c.grossContribution[i])}</td>
                  <td className={tbl.tdR}>{fmtM(c.gtmCost[i])}</td>
                  <td className={cx(tbl.tdR, 'font-medium', pos(c.netContribution[i]))}>{fmtM(c.netContribution[i])}</td>
                  <td className={cx(tbl.tdR, 'font-semibold', pos(c.cumulativeCash[i]))}>{fmtM(c.cumulativeCash[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </SectionGrid>
    </section>
  )
}
