import { getGoogleAccessToken } from '@/lib/google/token'
import { createSpreadsheet, type SheetTab } from '@/lib/google/sheets'
import { compute } from '@/lib/bcm/model'
import type { Dataset, Params } from '@/lib/bcm/types'

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as {
      name?: string
      datasetData?: Dataset
      params?: Params
      growth?: Params[]
    }
    const name = body?.name ?? 'Business case'
    const datasetData = body?.datasetData
    const params = body?.params
    const growth = body?.growth ?? []

    if (!datasetData || !params) {
      return Response.json({ error: 'bad_request' }, { status: 400 })
    }

    const token = await getGoogleAccessToken()
    if (!token) return Response.json({ error: 'no_google_token' }, { status: 400 })

    const c = compute(datasetData, params)

    const assumptions: (string | number)[][] = [
      ['Assumption', 'Value'],
      ['Google logos (2030)', params.gLogos],
      ['Microsoft logos (2030)', params.msLogos],
      ['MAX ARR Google', params.gMax],
      ['MAX ARR Microsoft', params.msMax],
      ['Year-1 entry %', params.instap],
      ['Growth/yr (pts)', params.groei],
      ['Plateau %', params.plafond],
      ['Mix: Licenties %', params.mix_lic],
      ['Mix: Beheer & support %', params.mix_beheer],
      ['Mix: Omsorg / IAM %', params.mix_omsorg],
      ['Mix: Bereikbaarheid %', params.mix_bereik],
      ['Mix: Hardware %', params.mix_hardware],
      ['Mix: Puls %', params.mix_puls],
      ['Mix: Grund %', params.mix_grund],
      ['Conversion: lead → suspect %', params.c_sl],
      ['Conversion: suspect → meeting %', params.c_ld],
      ['Conversion: discovery → demo %', params.c_dd],
      ['Conversion: demo → proposal %', params.c_dv],
      ['Conversion: proposal → contract %', params.c_vc],
      ['Core market', params.samKern],
      ['Existing clients', params.bestaande],
      ['Base revenue', params.baseline],
    ]

    const resultsPerYear: (string | number)[][] = [
      ['Year', 'Base', 'New business', 'Cross-sell', 'Innovation', 'Total', 'Plan (herijkt)', 'Delta vs plan'],
    ]
    for (let i = 0; i < 5; i++) {
      resultsPerYear.push([
        2026 + i,
        c.base[i],
        c.newLogoRev[i],
        c.crossUp[i],
        c.innov[i],
        c.totalRevenue[i],
        c.planPath[i],
        c.totalRevenue[i] - c.planPath[i],
      ])
    }

    const funnel: (string | number)[][] = [
      ['Stage', 2026, 2027, 2028, 2029, 2030, 'Avg/mo'],
    ]
    for (const f of c.funnel) {
      funnel.push([f.stage, ...f.perYear.map((v) => Math.round(v)), Math.round(f.perMonth)])
    }

    const scenarioComparison: (string | number)[][] = [
      ['Scenario', 2026, 2027, 2028, 2029, 2030],
    ]
    for (const k of growth) {
      const cc = compute(datasetData, k)
      scenarioComparison.push([k.tier, ...cc.totalRevenue])
      scenarioComparison.push([`${k.tier} plan`, ...cc.planPath])
    }

    const tabs: SheetTab[] = [
      { title: 'Assumptions', rows: assumptions },
      { title: 'Results per year', rows: resultsPerYear },
      { title: 'Funnel', rows: funnel },
      { title: 'Scenario comparison', rows: scenarioComparison },
    ]

    const { url } = await createSpreadsheet(token, `${name}: Business Case`, tabs)
    return Response.json({ url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Export failed.'
    return Response.json({ error: message }, { status: 500 })
  }
}
