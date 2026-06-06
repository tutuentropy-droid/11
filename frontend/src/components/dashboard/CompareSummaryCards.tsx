import { useAnalysisStore } from '../../store/analysisStore'

function formatNumber(n?: number) {
  if (n === undefined || n === null) return '-'
  return n.toLocaleString()
}

function MetricCompareCard({
  name,
  valueA,
  valueB,
  changePct,
  type,
}: {
  name: string
  valueA?: number
  valueB?: number
  changePct?: number
  type?: string
}) {
  const isUp = (changePct ?? 0) >= 0
  const isSignificant = Math.abs(changePct ?? 0) >= 10

  return (
    <div className="glass-panel relative px-4 py-3 overflow-hidden">
      <span className="hud-corner tl" />
      <span className="hud-corner br" />
      <div className="text-xs text-cockpit-muted uppercase tracking-wide mb-2 truncate">{name}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] text-cockpit-cyan/70 font-mono">A</div>
          <div className="text-lg font-bold font-mono text-cockpit-cyan truncate">
            {formatNumber(valueA)}
          </div>
        </div>
        <div className="text-cockpit-muted text-lg">→</div>
        <div className="min-w-0 text-right">
          <div className="text-[10px] text-cockpit-purple/70 font-mono">B</div>
          <div className="text-lg font-bold font-mono text-cockpit-purple truncate">
            {formatNumber(valueB)}
          </div>
        </div>
      </div>
      {changePct !== undefined && changePct !== null && (
        <div
          className={`mt-2 text-xs font-mono font-semibold inline-flex items-center gap-1 px-2 py-0.5 rounded ${
            isSignificant
              ? isUp
                ? 'bg-green-500/15 text-green-400 animate-pulse'
                : 'bg-red-500/15 text-red-400 animate-pulse'
              : isUp
              ? 'bg-green-500/10 text-green-400/70'
              : 'bg-red-500/10 text-red-400/70'
          }`}
        >
          {isUp ? '↑' : '↓'} {isUp ? '+' : ''}
          {changePct.toFixed(1)}%
        </div>
      )}
    </div>
  )
}

export default function CompareSummaryCards() {
  const compareResult = useAnalysisStore((s) => s.compareResult)
  if (!compareResult) return null

  const dsA = compareResult.dataset_a.dataset
  const dsB = compareResult.dataset_b.dataset
  const keyMetrics = compareResult.summary.key_metrics || []

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="glass-panel relative px-4 py-3 overflow-hidden">
          <span className="hud-corner tl" />
          <span className="hud-corner br" />
          <div className="text-xs text-cockpit-muted uppercase tracking-wide mb-2">数据集 A</div>
          <div className="text-xl font-bold font-mono text-cockpit-cyan truncate">
            {compareResult.label_a}
          </div>
          <div className="text-xs text-cockpit-muted mt-1 font-mono">
            {formatNumber(dsA.rows)} 行 × {dsA.cols} 列
          </div>
        </div>
        <div className="glass-panel relative px-4 py-3 overflow-hidden">
          <span className="hud-corner tl" />
          <span className="hud-corner br" />
          <div className="text-xs text-cockpit-muted uppercase tracking-wide mb-2">数据集 B</div>
          <div className="text-xl font-bold font-mono text-cockpit-purple truncate">
            {compareResult.label_b}
          </div>
          <div className="text-xs text-cockpit-muted mt-1 font-mono">
            {formatNumber(dsB.rows)} 行 × {dsB.cols} 列
          </div>
        </div>
        <div className="glass-panel relative px-4 py-3 overflow-hidden">
          <span className="hud-corner tl" />
          <span className="hud-corner br" />
          <div className="text-xs text-cockpit-muted uppercase tracking-wide mb-2">公共列</div>
          <div className="text-xl font-bold font-mono text-gradient">
            {compareResult.common_columns.length}
          </div>
          <div className="text-xs text-cockpit-muted mt-1 font-mono">
            数值 {compareResult.common_numeric_columns.length} · 分类{' '}
            {compareResult.common_categorical_columns.length}
          </div>
        </div>
        <div className="glass-panel relative px-4 py-3 overflow-hidden">
          <span className="hud-corner tl" />
          <span className="hud-corner br" />
          <div className="text-xs text-cockpit-muted uppercase tracking-wide mb-2">对齐策略</div>
          <div className="text-xl font-bold font-mono text-cockpit-warning">
            {compareResult.align_strategy === 'time'
              ? '⏱ 时间对齐'
              : compareResult.align_strategy === 'categorical'
              ? '🏷 分类对齐'
              : '📋 字段对齐'}
          </div>
          <div className="text-xs text-cockpit-muted mt-1 font-mono truncate">
            {compareResult.align_field || compareResult.common_columns[0] || '自动'}
          </div>
        </div>
      </div>

      {keyMetrics.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {keyMetrics.slice(0, 5).map((m, i) => (
            <MetricCompareCard
              key={i}
              name={m.name as string}
              valueA={m.value_a as number | undefined}
              valueB={m.value_b as number | undefined}
              changePct={m.change_pct as number | undefined}
              type={m.type as string}
            />
          ))}
        </div>
      )}
    </div>
  )
}
