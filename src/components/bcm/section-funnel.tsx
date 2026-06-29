'use client'

import { Fragment } from 'react'
import { Panel, Slider, tbl, cx, pos } from '@/components/suite/ui'
import { fmtNum, fmtPct } from '@/lib/bcm/format'
import type { Params, Computed } from '@/lib/bcm/types'
import { SectionGrid, SectionHeading, SliderGroupNote } from './helpers'

export function SectionFunnel({
  params,
  set,
  c,
}: {
  params: Params
  set: <K extends keyof Params>(k: K, v: Params[K]) => void
  c: Computed
}) {
  const peakGap = c.leadGapPerYear.length ? Math.max(...c.leadGapPerYear) : 0

  return (
    <section className="space-y-4">
      <SectionHeading n={5} title="Funnel & required activity" />
      <SectionGrid
        sliders={
          <div>
            <Slider label="Lead → suspect" value={params.c_sl} min={0} max={100} step={1} onChange={(v) => set('c_sl', v)} format={(n) => `${n}%`} />
            <Slider label="Suspect → discovery/meeting" value={params.c_ld} min={0} max={100} step={1} onChange={(v) => set('c_ld', v)} format={(n) => `${n}%`} />
            <Slider label="Discovery → demo" value={params.c_dd} min={0} max={100} step={1} onChange={(v) => set('c_dd', v)} format={(n) => `${n}%`} />
            <Slider label="Demo → proposal" value={params.c_dv} min={0} max={100} step={1} onChange={(v) => set('c_dv', v)} format={(n) => `${n}%`} />
            <Slider label="Proposal → contract" value={params.c_vc} min={0} max={100} step={1} onChange={(v) => set('c_vc', v)} format={(n) => `${n}%`} />
            <Slider label="Leads we can generate / yr" value={params.leadCapacity} min={0} max={500} step={10} onChange={(v) => set('leadCapacity', v)} format={(n) => String(n)} />
            <SliderGroupNote>
              The funnel is back-calculated from the contracts you need to reach the logo targets.
            </SliderGroupNote>
          </div>
        }
      >
        <Panel title="Required activity by stage" subtitle="volumes needed to hit logo intake">
          <div className="overflow-x-auto">
            <table className={tbl.table}>
              <thead>
                <tr>
                  <th className={tbl.th}>Stage</th>
                  {c.years.map((y) => (
                    <th key={y} className={tbl.thR}>{y}</th>
                  ))}
                  <th className={tbl.thR}>avg / mo</th>
                </tr>
              </thead>
              <tbody>
                {c.funnel.map((row, ri) => (
                  <Fragment key={row.stage}>
                    <tr className={ri === 0 ? tbl.trHighlight : tbl.tr}>
                      <td className={cx(tbl.td, ri === 0 && 'font-semibold')}>{row.stage}</td>
                      {row.perYear.map((v, i) => (
                        <td key={i} className={tbl.tdR}>{fmtNum(Math.round(v))}</td>
                      ))}
                      <td className={cx(tbl.tdR, 'font-medium')}>{fmtNum(Math.round(row.perMonth))}</td>
                    </tr>
                    {ri === 0 && (
                      <tr className={tbl.tr}>
                        <td className={cx(tbl.td, 'text-suite-ink-2')}>Capacity (we can generate)</td>
                        {c.leadCapacityPerYear.map((v, i) => (
                          <td key={i} className={cx(tbl.tdR, 'text-suite-ink-2')}>{fmtNum(Math.round(v))}</td>
                        ))}
                        <td className={cx(tbl.tdR, 'text-suite-ink-2')}>{fmtNum(Math.round((c.leadCapacityPerYear[0] ?? 0) / 12))}</td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 border-t border-suite-border pt-3 text-sm font-semibold text-suite-ink">
            Total leads needed 2026–2030 = {fmtNum(Math.round(c.totalLeads))}
            <span className="font-normal text-suite-ink-2">
              {' · '}{fmtPct(c.leadsPctCore)} of the core market
            </span>
          </p>
          <p className={cx('mt-2 text-sm font-semibold', pos(c.leadCoverage - 1))}>
            Lead-gen capacity covers {fmtPct(c.leadCoverage)} of leads needed
            {peakGap > 0 && (
              <span className="font-normal">
                {' · '}short by ~{fmtNum(Math.round(peakGap))} leads in the peak year.
              </span>
            )}
          </p>
        </Panel>
      </SectionGrid>
    </section>
  )
}
