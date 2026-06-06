import { useAnalysisStore } from '../../store/analysisStore'

function formatNumber(n?: number) {
  if (n === undefined || n === null) return '-'
  return n.toLocaleString()
}

function StatCard({
  label,
  value,
  sub,
  color,
  icon,
  onClick,
}: {
  label: string
  value: string
  sub?: string
  color: string
  icon: string
  onClick?: () => void
}) {
  return (
    <div
      className={`glass-panel relative px-5 py-4 flex items-center gap-4 overflow-hidden ${onClick ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}`}
      onClick={onClick}
    >
      <span className="hud-corner tl" />
      <span className="hud-corner br" />
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${color}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-cockpit-muted uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-bold font-mono text-cockpit-text truncate">{value}</div>
        {sub && <div className="text-xs text-cockpit-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

export default function SummaryCards({ onQualityClick }: { onQualityClick?: () => void }) {
  const result = useAnalysisStore((s) => s.result)
  if (!result) return null
  const ds = result.dataset
  const outlierCount = result.columns.reduce((a, c) => a + c.outliers.length, 0)
  const highCorr = result.correlations?.top_pairs.filter((p) => Math.abs(p[2]) >= 0.7).length || 0

  const quality = result.quality_report?.quality
  const qualityIssues = result.quality_report?.issues || []
  const unfixedQualityCount = qualityIssues.filter((i) => !i.fixed).length

  const qualityLabel = quality
    ? `${quality.score_percentage.toFixed(1)}% · 等级 ${quality.grade}`
    : `${(100 - ds.total_missing_rate * 100).toFixed(1)}%`
  const qualitySub = quality
    ? unfixedQualityCount > 0
      ? `${unfixedQualityCount} 类待修复问题`
      : '所有问题已修正'
    : `缺失率 ${(ds.total_missing_rate * 100).toFixed(2)}%`
  const qualityColor = quality
    ? quality.grade === 'A'
      ? 'bg-green-500/15 text-green-400'
      : quality.grade === 'B'
        ? 'bg-cyan-500/15 text-cyan-400'
        : quality.grade === 'C'
          ? 'bg-yellow-500/15 text-yellow-400'
          : 'bg-red-500/15 text-red-400'
    : ds.total_missing_rate < 0.05
      ? 'bg-green-500/15 text-green-400'
      : ds.total_missing_rate < 0.2
        ? 'bg-yellow-500/15 text-yellow-400'
        : 'bg-red-500/15 text-red-400'
  const qualityIcon = quality
    ? quality.grade === 'A' ? '🏆' : quality.grade === 'B' ? '🥈' : quality.grade === 'C' ? '🥉' : '🚨'
    : ds.total_missing_rate < 0.05 ? '✅' : ds.total_missing_rate < 0.2 ? '⚠️' : '🚨'

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="数据规模"
        value={`${formatNumber(ds.rows)} × ${ds.cols}`}
        sub={`${formatNumber(ds.rows)} 行, ${ds.cols} 列`}
        color="bg-cockpit-primary/15 text-cockpit-primary"
        icon="📦"
      />
      <StatCard
        label="数据质量"
        value={qualityLabel}
        sub={qualitySub}
        color={qualityColor}
        icon={qualityIcon}
        onClick={onQualityClick}
      />
      <StatCard
        label="异常检测"
        value={formatNumber(outlierCount)}
        sub={outlierCount > 0 ? '红色闪烁点标记' : '数据表现平稳'}
        color={outlierCount > 0 ? 'bg-cockpit-danger/15 text-cockpit-danger' : 'bg-green-500/15 text-green-400'}
        icon={outlierCount > 0 ? '🚨' : '✨'}
      />
      <StatCard
        label="强相关关系"
        value={formatNumber(highCorr)}
        sub={highCorr > 0 ? `共 ${result.correlations?.top_pairs.length || 0} 对关系` : '未发现显著相关性'}
        color="bg-cockpit-purple/15 text-cockpit-purple"
        icon="🔗"
      />
    </div>
  )
}
