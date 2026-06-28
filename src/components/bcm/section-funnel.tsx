'use client'

import { Panel, Slider, tbl, cx } from '@/components/suite/ui'
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
  return (
    <section className="space-y-4">
      <SectionHeading n={3} title="Funnel & required activity" />
      <SectionGrid
        sliders={
          <div>
            <Slider label="Lead → suspect" value={params.c_sl} min={0} max={100} step={1} onChange={(v) => set('c_sl', v)} format={(n) => `${n}%`} />
            <Slider label="Suspect → discovery/meeting" value={params.c_ld} min={0} max={100} step={1} onChange={(v) => set('c_ld', v)} format={(n) => `${n}%`} />
            <Slider label="Discovery → demo" value={params.c_dd} min={0} max={100} step={1} onChange={(v) => set('c_dd', v)} format={(n) => `${n}%`} />
            <Slider label="Demo → proposal" value={params.c_dv} min={0} max={100} step={1} onChange={(v) => set('c_dv', v)} format={(n) => `${n}%`} />
            <Slider label="Proposal → contract" value={params.c_vc} min={0} max={100} step={1} onChange={(v) => set('c_vc', v)} format={(n) => `${n}%`} />
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
                  <tr key={row.stage} className={ri === 0 ? tbl.trHighlight : tbl.tr}>
                    <td className={cx(tbl.td, ri === 0 && 'font-semibold')}>{row.stage}</td>
                    {row.perYear.map((v, i) => (
                      <td key={i} className={tbl.tdR}>{fmtNum(Math.round(v))}</td>
                    ))}
                    <td className={cx(tbl.tdR, 'font-medium')}>{fmtNum(Math.round(row.perMonth))}</td>
                  </tr>
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
        </Panel>
      </SectionGrid>
    </section>
  )
}
