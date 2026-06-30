'use client'

// Shared recharts theme + small wrappers for the Business Case Model.
// Every value passed in must originate from compute()/dataset — these helpers
// only shape rows and style, never invent numbers.
import { type ReactNode } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { fmtM, fmtEur, fmtNum } from '@/lib/bcm/format'

export const C = {
  accent: '#2a7d72',
  accentDark: '#155e54',
  accentMid: '#6aa39a',
  accentLight: '#9cc4bd',
  slate: '#1e293b',
  warm: '#b08968',
  neutral: '#cbd5e1',
  grid: '#eef1f4',
  ink3: '#94a3b8',
  pos: '#2a7d72',
  neg: '#c2554d',
} as const

/**
 * Distinct categorical palette for the 7 product-mix categories, in the order
 * lic, beheer, omsorg, bereik, hardware, puls, grund — teal, blue, amber,
 * violet, terracotta, green, slate. Extends past 7 if a chart needs more.
 */
export const CAT = [
  '#2a7d72', // teal     — lic
  '#3f6fb0', // blue     — beheer
  '#e0a52e', // amber    — omsorg
  '#8b5cf6', // violet   — bereik
  '#cf5d4e', // terracotta — hardware
  '#4f9d69', // green    — puls
  '#64748b', // slate    — grund
  '#0e9aa7',
  '#b4699e',
  '#9a8c4a',
  '#c47b3c',
  '#7c6cd6',
] as const

/** Cycling palette used by mix doughnut / stacked product areas. Aliased to CAT. */
export const PALETTE = CAT

/**
 * Semantic colour scheme shared across the Business Case Model charts so meaning
 * reads consistently everywhere: costs are red, profit/EBIT is green, and new
 * business vs expansion are two clearly-distinct greens.
 */
export const SEMANTIC = {
  cost: ['#b03a2e', '#d4694f', '#e08a73', '#efb4a4'], // cost ramp: COGS -> overhead (deep -> light red)
  profit: '#2f9e44',  // EBIT / profit (green)
  newBiz: '#2f9e44',  // new business / new logos (green)
  expand: '#74c69d',  // cross-sell / expansion (distinct lighter green)
  pos: '#2f9e44',     // positive value
  neg: '#c0392b',     // negative value / loss
} as const

const axisTick = { fill: C.ink3, fontSize: 11 } as const

function tickM(v: number): string {
  return fmtM(v, v >= 1e7 || v <= -1e7 ? 0 : 1)
}

const tooltipStyle = {
  contentStyle: {
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 12,
    boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
  },
  labelStyle: { color: C.slate, fontWeight: 600 },
} as const

const legendStyle = { fontSize: 11, paddingTop: 4 } as const

type RechartsValue = number | string | ReadonlyArray<number | string> | undefined

/** Adapt a numeric formatter to recharts' Tooltip `formatter` signature. */
export function tipFmt(fn: (n: number) => string): (value: RechartsValue) => string {
  return (value) => {
    const raw = Array.isArray(value) ? value[0] : value
    const n = Number(raw)
    return Number.isFinite(n) ? fn(n) : ''
  }
}

export function ChartShell({ height = 260, children }: { height?: number; children: ReactNode }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
    </div>
  )
}

export type Datum = Record<string, number | string>

export interface SeriesDef {
  key: string
  name: string
  color: string
  dashed?: boolean
  /** Render the line at ~55% opacity (used for dashed plan paths). */
  faint?: boolean
}

/** Multi-line chart. `valueFmt` controls Y axis + tooltip number formatting. */
export function LinesChart({
  data,
  xKey,
  series,
  valueFmt = 'eur-m',
  height = 280,
}: {
  data: Datum[]
  xKey: string
  series: SeriesDef[]
  valueFmt?: 'eur-m' | 'num'
  height?: number
}) {
  const yFmt = valueFmt === 'num' ? (v: number) => fmtNum(v) : tickM
  const tFmt = valueFmt === 'num' ? (v: number) => fmtNum(Math.round(v)) : (v: number) => fmtEur(v)
  return (
    <ChartShell height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={{ stroke: C.grid }} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52} tickFormatter={yFmt} />
        <Tooltip {...tooltipStyle} formatter={tipFmt(tFmt)} />
        <Legend wrapperStyle={legendStyle} iconType="plainline" />
        {series.map((s) => {
          const isTotal = s.key === 'total' || s.name === 'Total'
          return (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={isTotal ? 2.5 : 2}
              strokeOpacity={s.faint ? 0.55 : 1}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
          )
        })}
      </LineChart>
    </ChartShell>
  )
}

/** Stacked-area chart (mix / motion). */
export function StackedAreaChart({
  data,
  xKey,
  series,
  valueFmt = 'eur-m',
  height = 280,
}: {
  data: Datum[]
  xKey: string
  series: SeriesDef[]
  valueFmt?: 'eur-m' | 'num'
  height?: number
}) {
  const yFmt = valueFmt === 'num' ? (v: number) => fmtNum(v) : tickM
  const tFmt = valueFmt === 'num' ? (v: number) => fmtNum(Math.round(v)) : (v: number) => fmtEur(v)
  return (
    <ChartShell height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={{ stroke: C.grid }} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52} tickFormatter={yFmt} />
        <Tooltip {...tooltipStyle} formatter={tipFmt(tFmt)} />
        <Legend wrapperStyle={legendStyle} />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stackId="1"
            stroke={s.color}
            fill={s.color}
            fillOpacity={0.8}
            strokeWidth={1.5}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ChartShell>
  )
}

/** Stacked bars (logo intake reference). */
export function StackedBarsChart({
  data,
  xKey,
  bars,
  line,
  valueFmt = 'num',
  height = 280,
}: {
  data: Datum[]
  xKey: string
  bars: SeriesDef[]
  line?: SeriesDef
  valueFmt?: 'eur-m' | 'num'
  height?: number
}) {
  const yFmt = valueFmt === 'num' ? (v: number) => fmtNum(v) : tickM
  const tFmt = valueFmt === 'num' ? (v: number) => fmtNum(Math.round(v)) : (v: number) => fmtEur(v)
  return (
    <ChartShell height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid stroke={C.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={{ stroke: C.grid }} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} width={52} tickFormatter={yFmt} />
        <Tooltip {...tooltipStyle} formatter={tipFmt(tFmt)} />
        <Legend wrapperStyle={legendStyle} />
        {bars.map((b) => (
          <Bar
            key={b.key}
            dataKey={b.key}
            name={b.name}
            stackId="logos"
            fill={b.color}
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />
        ))}
        {line && (
          <Line
            type="monotone"
            dataKey={line.key}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        )}
      </ComposedChart>
    </ChartShell>
  )
}

export interface PieDatum {
  name: string
  value: number
}

/** Live doughnut for the product-mix shares. */
export function DoughnutChart({ data, height = 280 }: { data: PieDatum[]; height?: number }) {
  return (
    <ChartShell height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={1}
          stroke="#ffffff"
          strokeWidth={1}
          isAnimationActive={false}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} formatter={tipFmt((n) => `${n}%`)} />
        <Legend wrapperStyle={legendStyle} />
      </PieChart>
    </ChartShell>
  )
}
