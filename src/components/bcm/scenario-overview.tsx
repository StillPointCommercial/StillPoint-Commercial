'use client'

import { useMemo } from 'react'
import { Panel, Kpi, KpiStrip, tbl, cx, pos } from '@/components/suite/ui'
import { fmtEur, fmtM, fmtSignedM } from '@/lib/bcm/format'
import { compute } from '@/lib/bcm/model'
import { ADAPTA } from '@/lib/bcm/seed'
import { GROWTH_KEYS, presetByKey } from '@/lib/bcm/presets'
import type { Computed, Params } from '@/lib/bcm/types'
import { LinesChart, type SeriesDef } from './charts'

interface Scn {
  key: string
  label: string
  params: Params
  c: Computed
}

const LABELS: Record<string, string> = { laag: 'Laag', mid: 'Midden', hoog: 'Hoog' }

export function ScenarioOverview() {
  const scns: Scn[] = useMemo(
    () =>
      GROWTH_KEYS.map((k) => {
        const preset = presetByKey(k)!
        return { key: k, label: LABELS[k] ?? k, params: preset.params, c: compute(ADAPTA, preset.params) }
      }),
    [],
  )

  const chartRows = ADAPTA.planHerijkt.laag.map((_, i) => {
    const row: Record<string, number | string> = { year: String(2026 + i) }
    for (const s of scns) row[`m_${s.key}`] = s.c.totalRevenue[i]
    row.p_laag = ADAPTA.planHerijkt.laag[i]
    row.p_mid = ADAPTA.planHerijkt.mid[i]
    row.p_hoog = ADAPTA.planHerijkt.hoog[i]
    return row
  })

  const chartSeries: SeriesDef[] = [
    { key: 'm_laag', name: 'Laag', color: '#3f6fb0' },
    { key: 'm_mid', name: 'Midden', color: '#e0a52e' },
    { key: 'm_hoog', name: 'Hoog', color: '#2a7d72' },
    { key: 'p_laag', name: 'Plan laag', color: '#3f6fb0', dashed: true, faint: true },
    { key: 'p_mid', name: 'Plan midden', color: '#e0a52e', dashed: true, faint: true },
    { key: 'p_hoog', name: 'Plan hoog', color: '#2a7d72', dashed: true, faint: true },
  ]

  return (
    <div className="space-y-6">
      <KpiStrip>
        {scns.map((s) => (
          <Kpi key={s.key} label={`${s.label} · 2030 total`} value={fmtM(s.c.totalRevenue[4])} accent={s.key === 'mid'} />
        ))}
      </KpiStrip>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Assumptions per scenario">
          <table className={tbl.table}>
            <thead>
              <tr>
                <th className={tbl.th}>Metric</th>
                {scns.map((s) => (
                  <th key={s.key} className={tbl.thR}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="Google logos" cells={scns.map((s) => fmtNumR(s.c.cumLogosG[4]))} />
              <Row label="Microsoft logos" cells={scns.map((s) => fmtNumR(s.c.cumLogosMS[4]))} />
              <Row label="Total accounts" cells={scns.map((s) => fmtNumR(s.c.totalNewLogos2030))} />
              <Row label="MAX ARR Google" cells={scns.map((s) => fmtEur(s.params.gMax))} />
              <Row label="MAX ARR Microsoft" cells={scns.map((s) => fmtEur(s.params.msMax))} />
            </tbody>
          </table>
        </Panel>

        <Panel title="2030 split by motion">
          <table className={tbl.table}>
            <thead>
              <tr>
                <th className={tbl.th}>Motion</th>
                {scns.map((s) => (
                  <th key={s.key} className={tbl.thR}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Row label="New business" cells={scns.map((s) => fmtM(s.c.newLogoRev[4]))} />
              <Row label="Upsell" cells={scns.map((s) => fmtM(s.c.crossUp[4]))} />
              <Row label="Innovation" cells={scns.map((s) => fmtM(s.c.innov[4]))} />
              <Row label="Total new" cells={scns.map((s) => fmtM(s.c.newTotal[4]))} bold />
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Total revenue per year vs plan (herijkt)">
        <div className="overflow-x-auto">
          <table className={tbl.table}>
            <thead>
              <tr>
                <th className={tbl.th}>Scenario</th>
                <th className={tbl.th}></th>
                {ADAPTA.planHerijkt.laag.map((_, i) => (
                  <th key={i} className={tbl.thR}>{2026 + i}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scns.map((s) => (
                <ScenarioYearBlock key={s.key} label={s.label} c={s.c} />
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Scenarios vs plan paths" subtitle="model totals (solid) against herijkt plan (dashed)">
        <LinesChart data={chartRows} xKey="year" series={chartSeries} height={300} />
      </Panel>
    </div>
  )
}

function ScenarioYearBlock({ label, c }: { label: string; c: Computed }) {
  return (
    <>
      <tr className={tbl.trHighlight}>
        <td className={cx(tbl.td, 'font-semibold')} rowSpan={3}>{label}</td>
        <td className={tbl.tdMuted}>Model</td>
        {c.totalRevenue.map((v, i) => (
          <td key={i} className={cx(tbl.tdR, 'font-medium')}>{fmtM(v)}</td>
        ))}
      </tr>
      <tr className={tbl.tr}>
        <td className={tbl.tdMuted}>Plan (herijkt)</td>
        {c.planPath.map((v, i) => (
          <td key={i} className={tbl.tdR}>{fmtM(v)}</td>
        ))}
      </tr>
      <tr className={tbl.tr}>
        <td className={tbl.tdMuted}>Difference</td>
        {c.totalRevenue.map((v, i) => {
          const d = v - c.planPath[i]
          return (
            <td key={i} className={cx(tbl.tdR, 'font-semibold', pos(d))}>{fmtSignedM(d)}</td>
          )
        })}
      </tr>
    </>
  )
}

function Row({ label, cells, bold }: { label: string; cells: string[]; bold?: boolean }) {
  return (
    <tr className={tbl.tr}>
      <td className={cx(tbl.td, bold && 'font-semibold')}>{label}</td>
      {cells.map((v, i) => (
        <td key={i} className={cx(tbl.tdR, bold && 'font-semibold')}>{v}</td>
      ))}
    </tr>
  )
}

function fmtNumR(n: number): string {
  return Math.round(n).toLocaleString('nl-NL')
}
