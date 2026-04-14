import { db } from './dexie'
import type { YearPlan, ConversionAssumptions } from '@/lib/types'

// Industry defaults for consultancy/advisory businesses
export const DEFAULT_CONVERSIONS_COLD: ConversionAssumptions = {
  lead_to_qualified: 25,
  qualified_to_discovery: 35,
  discovery_to_proposal: 55,
  proposal_to_won: 30,
}

export const DEFAULT_CONVERSIONS_WARM: ConversionAssumptions = {
  lead_to_qualified: 50,
  qualified_to_discovery: 60,
  discovery_to_proposal: 70,
  proposal_to_won: 50,
}

export const DEFAULT_CONVERSIONS_EXISTING: ConversionAssumptions = {
  lead_to_qualified: 80,
  qualified_to_discovery: 80,
  discovery_to_proposal: 85,
  proposal_to_won: 70,
}

export function createDefaultYearPlan(userId: string, year: number): Omit<YearPlan, 'id' | 'created_at' | 'updated_at'> {
  return {
    user_id: userId,
    year,
    revenue_target: 0,
    avg_deal_size: 25000,
    target_new_clients: 0,
    target_upsells: 0,
    pct_revenue_existing: 60,
    pct_revenue_new: 40,
    conversions_cold: { ...DEFAULT_CONVERSIONS_COLD },
    conversions_warm: { ...DEFAULT_CONVERSIONS_WARM },
    conversions_existing: { ...DEFAULT_CONVERSIONS_EXISTING },
    quarterly_weights: [25, 25, 25, 25],
    notes: null,
  }
}

export async function getYearPlan(year: number): Promise<YearPlan | undefined> {
  return db.year_plans.where('year').equals(year).first()
}

export async function saveYearPlan(data: Omit<YearPlan, 'id' | 'created_at' | 'updated_at'>): Promise<YearPlan> {
  // Check if plan for this year already exists
  const existing = await db.year_plans.where('year').equals(data.year).first()
  const now = new Date().toISOString()

  if (existing) {
    await db.year_plans.update(existing.id, { ...data, updated_at: now })
    return { ...existing, ...data, updated_at: now }
  }

  const plan: YearPlan = {
    ...data,
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
  }
  await db.year_plans.add(plan)
  return plan
}

// ============================================
// Backward calculator
// ============================================

export interface BackwardCalc {
  // Revenue breakdown
  revenueFromExisting: number
  revenueFromNew: number
  // Deals needed
  dealsFromExisting: number
  dealsFromNew: number
  totalDeals: number
  // Funnel requirements (new business)
  proposalsNeeded: number
  discoveriesNeeded: number
  qualifiedLeadsNeeded: number
  totalLeadsNeeded: number
  // Quarterly targets
  quarters: QuarterTarget[]
  // Weekly activity
  weeklyLeads: number
  weeklyQualified: number
  weeklyMeetings: number
  weeklyProposals: number
}

export interface QuarterTarget {
  quarter: number
  revenue: number
  deals: number
  proposals: number
  discoveries: number
  leads: number
}

export function calculateBackward(plan: YearPlan): BackwardCalc {
  const revenueFromExisting = plan.revenue_target * (plan.pct_revenue_existing / 100)
  const revenueFromNew = plan.revenue_target * (plan.pct_revenue_new / 100)

  const avgDeal = plan.avg_deal_size || 25000

  const dealsFromExisting = Math.ceil(revenueFromExisting / avgDeal)
  const dealsFromNew = Math.ceil(revenueFromNew / avgDeal)
  const totalDeals = dealsFromExisting + dealsFromNew

  // Use blended warm/cold rates for new business funnel
  // Weight: assume 50% warm (referral/networking), 50% cold for new
  const blendedNew = {
    proposal_to_won: (plan.conversions_warm.proposal_to_won + plan.conversions_cold.proposal_to_won) / 2,
    discovery_to_proposal: (plan.conversions_warm.discovery_to_proposal + plan.conversions_cold.discovery_to_proposal) / 2,
    qualified_to_discovery: (plan.conversions_warm.qualified_to_discovery + plan.conversions_cold.qualified_to_discovery) / 2,
    lead_to_qualified: (plan.conversions_warm.lead_to_qualified + plan.conversions_cold.lead_to_qualified) / 2,
  }

  const proposalsNeeded = Math.ceil(dealsFromNew / (blendedNew.proposal_to_won / 100))
  const discoveriesNeeded = Math.ceil(proposalsNeeded / (blendedNew.discovery_to_proposal / 100))
  const qualifiedLeadsNeeded = Math.ceil(discoveriesNeeded / (blendedNew.qualified_to_discovery / 100))
  const totalLeadsNeeded = Math.ceil(qualifiedLeadsNeeded / (blendedNew.lead_to_qualified / 100))

  // Quarterly breakdown
  const quarters: QuarterTarget[] = plan.quarterly_weights.map((weight, i) => {
    const pct = weight / 100
    return {
      quarter: i + 1,
      revenue: Math.round(plan.revenue_target * pct),
      deals: Math.ceil(totalDeals * pct),
      proposals: Math.ceil(proposalsNeeded * pct),
      discoveries: Math.ceil(discoveriesNeeded * pct),
      leads: Math.ceil(totalLeadsNeeded * pct),
    }
  })

  // Weekly (50 working weeks)
  const workingWeeks = 50
  const weeklyLeads = totalLeadsNeeded / workingWeeks
  const weeklyQualified = qualifiedLeadsNeeded / workingWeeks
  const weeklyMeetings = discoveriesNeeded / workingWeeks
  const weeklyProposals = proposalsNeeded / workingWeeks

  return {
    revenueFromExisting,
    revenueFromNew,
    dealsFromExisting,
    dealsFromNew,
    totalDeals,
    proposalsNeeded,
    discoveriesNeeded,
    qualifiedLeadsNeeded,
    totalLeadsNeeded,
    quarters,
    weeklyLeads,
    weeklyQualified,
    weeklyMeetings,
    weeklyProposals,
  }
}
