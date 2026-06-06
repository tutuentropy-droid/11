import { useMemo } from 'react'
import { useAnalysisStore } from '../../store/analysisStore'
import { IndustryAnalysis, KPIDefinition } from '../../types'

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-cockpit-primary/15 text-cockpit-primary border-cockpit-primary/30',
  cyan: 'bg-cockpit-cyan/15 text-cockpit-cyan border-cockpit-cyan/30',
  purple: 'bg-cockpit-purple/15 text-cockpit-purple border-cockpit-purple/30',
  green: 'bg-green-500/15 text-green-400 border-green-500/30',
  yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
  gold: 'bg-yellow-400/15 text-yellow-300 border-yellow-400/30',
  gray: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
}

const SPARKLINE_COLOR: Record<string, string> = {
  blue: '#3b82f6',
  cyan: '#06b6d4',
  purple: '#8b5cf6',
  green: '#4ade80',
  yellow: '#facc15',
  orange: '#fb923c',
  red: '#f87171',
  gold: '#fde047',
  gray: '#9ca3af',
}

function formatKPIValue(value: any, unit: string): string {
  if (value === null || value === undefined || value === '') return '-'
  if (Array.isArray(value)) {
    return value.slice(0, 3).map(String).join('、')
  }
  const num = Number(value)
  if (isNaN(num)) return String(value)
  if (unit === '%') {
    return `${num.toFixed(2)}%`
  }
  if (Math.abs(num) >= 100000000) {
    return `${unit}${(num / 100000000).toFixed(2)}亿`
  }
  if (Math.abs(num) >= 10000) {
    return `${unit}${(num / 10000).toFixed(2)}万`
  }
  return `${unit}${num.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null
  const width = 80
  const height = 24
  const valid = data.filter((v) => typeof v === 'number' && !isNaN(v))
  if (valid.length < 2) return null
  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const range = max - min || 1
  const step = width / (valid.length - 1)
  const points = valid.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} className="opacity-70">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function KPICard({ kpi, value, trend }: { kpi: KPIDefinition; value: any; trend?: number[] }) {
  const colorClass = COLOR_MAP[kpi.color] || COLOR_MAP.blue
  const lineColor = SPARKLINE_COLOR[kpi.color] || SPARKLINE_COLOR.blue

  return (
    <div className={`glass-panel relative px-4 py-3 overflow-hidden border ${colorClass}`}>
      <span className="hud-corner tl" />
      <span className="hud-corner br" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs text-cockpit-muted mb-1">
            <span>{kpi.icon}</span>
            <span className="truncate" title={kpi.name}>{kpi.name}</span>
          </div>
          <div
            className="text-lg font-bold font-mono truncate"
            style={{ color: lineColor }}
            title={formatKPIValue(value, kpi.unit)}
          >
            {formatKPIValue(value, kpi.unit)}
          </div>
        </div>
        {kpi.trend_supported && trend && trend.length > 1 && (
          <div className="shrink-0">
            <Sparkline data={trend} color={lineColor} />
          </div>
        )}
      </div>
      {kpi.description && (
        <div className="mt-1 text-[10px] text-cockpit-muted leading-tight line-clamp-2">
          {kpi.description}
        </div>
      )}
    </div>
  )
}

export default function IndustryMetricsPanel() {
  const result = useAnalysisStore((s) => s.result)
  const industry: IndustryAnalysis | undefined = result?.industry

  const kpiTrends = useMemo(() => {
    if (!industry?.kpi_trends || !industry.kpi_definitions) return {}
    const trends: Record<string, number[]> = {}
    industry.kpi_definitions.forEach((kpi) => {
      if (kpi.trend_supported) {
        const values: number[] = []
        industry.kpi_trends.forEach((point) => {
          const v = point.kpis[kpi.id]
          if (typeof v === 'number' && !isNaN(v)) values.push(v)
        })
        if (values.length >= 2) trends[kpi.id] = values
      }
    })
    return trends
  }, [industry])

  if (!industry || industry.template_id === 'general') return null

  const displayKPIs = industry.kpi_definitions.filter((kpi) => {
    const v = industry.kpi_values[kpi.id]
    return v !== null && v !== undefined && v !== ''
  }).slice(0, 8)

  return (
    <div className="glass-panel relative p-4">
      <span className="hud-corner tl" />
      <span className="hud-corner tr" />
      <span className="hud-corner bl" />
      <span className="hud-corner br" />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${COLOR_MAP[industry.template_color] || COLOR_MAP.blue}`}
          >
            {industry.template_icon}
          </div>
          <div>
            <div className="text-sm font-bold text-cockpit-text flex items-center gap-2">
              {industry.template_name} 指标看板
              <span className="text-[10px] font-normal text-cockpit-muted px-1.5 py-0.5 rounded bg-cockpit-primary/10 border border-cockpit-primary/20">
                AI 自动识别
              </span>
            </div>
            <div className="text-xs text-cockpit-muted mt-0.5">
              {industry.template_description}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-mono text-cockpit-muted">匹配置信度</div>
          <div
            className="text-sm font-bold font-mono"
            style={{ color: SPARKLINE_COLOR[industry.template_color] || SPARKLINE_COLOR.blue }}
          >
            {Math.min(100, Math.round(industry.match_score))}%
          </div>
        </div>
      </div>

      <div className="hud-line mb-3" />

      {displayKPIs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {displayKPIs.map((kpi) => (
            <KPICard
              key={kpi.id}
              kpi={kpi}
              value={industry.kpi_values[kpi.id]}
              trend={kpiTrends[kpi.id]}
            />
          ))}
        </div>
      ) : (
        <div className="text-sm text-cockpit-muted text-center py-6">
          暂无匹配的行业指标
        </div>
      )}
    </div>
  )
}
