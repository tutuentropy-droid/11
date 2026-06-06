import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysisStore } from '../store/analysisStore'
import CompareSummaryCards from '../components/dashboard/CompareSummaryCards'
import CompareInsightList from '../components/dashboard/CompareInsightList'
import CompareTimeseries3D from '../components/charts3d/CompareTimeseries3D'
import CompareCorrelation3D from '../components/charts3d/CompareCorrelation3D'
import CompareNumeric3D from '../components/charts3d/CompareNumeric3D'
import CompareCategorical from '../components/charts3d/CompareCategorical'

export default function CompareDashboard() {
  const compareResult = useAnalysisStore((s) => s.compareResult)
  const activeCompareChart = useAnalysisStore((s) => s.activeCompareChart)
  const setActiveCompareChart = useAnalysisStore((s) => s.setActiveCompareChart)
  const compareViewMode = useAnalysisStore((s) => s.compareViewMode)
  const setCompareViewMode = useAnalysisStore((s) => s.setCompareViewMode)
  const reset = useAnalysisStore((s) => s.reset)
  const navigate = useNavigate()

  if (!compareResult) {
    navigate('/')
    return null
  }

  const hasTimeseries = !!compareResult.timeseries_diff
  const hasCorrelation =
    !!compareResult.dataset_a.correlations &&
    !!compareResult.dataset_b.correlations &&
    compareResult.common_numeric_columns.length >= 2
  const hasNumeric = compareResult.common_numeric_columns.length > 0
  const hasCategorical = compareResult.categorical_diffs.length > 0

  const availableCharts = useMemo(() => {
    const list: Array<{ id: string; label: string; icon: string }> = []
    if (hasTimeseries) list.push({ id: 'compare_timeseries', label: '时序对比', icon: '📈' })
    if (hasNumeric) list.push({ id: 'compare_numeric', label: '数值对比', icon: '📊' })
    if (hasCorrelation) list.push({ id: 'compare_correlation', label: '相关对比', icon: '🔗' })
    if (hasCategorical) list.push({ id: 'compare_categorical', label: '分类对比', icon: '🥧' })
    return list
  }, [hasTimeseries, hasNumeric, hasCorrelation, hasCategorical])

  const renderChart = () => {
    switch (activeCompareChart) {
      case 'compare_timeseries':
        return hasTimeseries ? <CompareTimeseries3D /> : <EmptyChart text="无可对齐的时间序列" />
      case 'compare_numeric':
        return hasNumeric ? <CompareNumeric3D /> : <EmptyChart text="无可对比的数值列" />
      case 'compare_correlation':
        return hasCorrelation ? <CompareCorrelation3D /> : <EmptyChart text="无可对比的相关性" />
      case 'compare_categorical':
        return hasCategorical ? <CompareCategorical /> : <EmptyChart text="无可对比的分类列" />
      default:
        return <EmptyChart text="选择一个对比图表开始探索" />
    }
  }

  const handleBack = () => {
    reset()
    navigate('/')
  }

  return (
    <div className="min-h-screen w-full grid-bg p-4 md:p-6">
      <div className="glass-panel relative px-6 py-4 flex items-center justify-between mb-4">
        <span className="hud-corner tl" />
        <span className="hud-corner tr" />
        <span className="hud-corner bl" />
        <span className="hud-corner br" />

        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="px-3 py-1.5 rounded-md text-sm text-cockpit-muted hover:text-cockpit-text hover:bg-cockpit-primary/10 border border-cockpit-border transition-colors"
          >
            ← 重新上传
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-cockpit-purple rounded-full animate-pulse" />
              <span className="text-xs font-mono text-cockpit-purple uppercase tracking-wider">
                Compare Analysis
              </span>
            </div>
            <div className="text-xl font-bold text-gradient mt-0.5">
              {compareResult.summary.headline}
            </div>
            <div className="text-xs text-cockpit-muted mt-0.5 font-mono">
              ⚖ {compareResult.label_a} <span className="text-cockpit-primary">VS</span>{' '}
              {compareResult.label_b}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border border-cockpit-border text-xs font-mono text-cockpit-muted">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            COMPARE MODE
          </div>
          <div className="flex rounded-md border border-cockpit-border overflow-hidden">
            <button
              onClick={() => setCompareViewMode('overlay')}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                compareViewMode === 'overlay'
                  ? 'bg-cockpit-primary/20 text-cockpit-cyan'
                  : 'text-cockpit-muted hover:text-cockpit-text'
              }`}
            >
              叠加
            </button>
            <button
              onClick={() => setCompareViewMode('sidebyside')}
              className={`px-3 py-1.5 text-xs font-mono transition-colors ${
                compareViewMode === 'sidebyside'
                  ? 'bg-cockpit-purple/20 text-cockpit-purple'
                  : 'text-cockpit-muted hover:text-cockpit-text'
              }`}
            >
              并排
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <CompareSummaryCards />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-2">
          <div className="glass-panel relative p-4">
            <span className="hud-corner tl" />
            <span className="hud-corner br" />
            <div className="text-xs font-mono text-cockpit-cyan uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>◆</span> 对比视图
            </div>
            <div className="hud-line mb-4" />
            <div className="space-y-1">
              {availableCharts.length === 0 ? (
                <div className="text-sm text-cockpit-muted py-4 text-center">无可用视图</div>
              ) : (
                availableCharts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCompareChart(c.id as any)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all flex items-center gap-2 ${
                      activeCompareChart === c.id
                        ? 'bg-cockpit-primary/20 text-cockpit-cyan border border-cockpit-cyan/30'
                        : 'text-cockpit-muted hover:text-cockpit-text hover:bg-cockpit-primary/5'
                    }`}
                  >
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="mt-4">
            <CompareInsightList />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <div className="glass-panel relative h-[680px] p-4">
            <span className="hud-corner tl" />
            <span className="hud-corner tr" />
            <span className="hud-corner bl" />
            <span className="hud-corner br" />
            <div className="absolute top-3 left-4 text-xs font-mono text-cockpit-muted z-10">
              <span className="text-cockpit-purple">⚖</span> COMPARE VIEWPORT ·{' '}
              {availableCharts.find((c) => c.id === activeCompareChart)?.label || 'IDLE'} ·{' '}
              {compareViewMode === 'overlay' ? '叠加模式' : '并排模式'}
            </div>
            <div className="absolute top-3 right-4 text-xs font-mono z-10 flex gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-cockpit-cyan" />
                {compareResult.label_a}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-cockpit-purple" />
                {compareResult.label_b}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-cockpit-warning animate-pulse" />
                显著变化
              </span>
            </div>
            <div className="w-full h-full pt-8">{renderChart()}</div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-3">
          <div className="glass-panel relative h-[680px] p-4 overflow-y-auto scrollbar-thin">
            <span className="hud-corner tl" />
            <span className="hud-corner tr" />
            <span className="hud-corner bl" />
            <span className="hud-corner br" />
            <div className="text-xs font-mono text-cockpit-cyan uppercase tracking-wider mb-3 flex items-center gap-2">
              <span>◆</span> 差异详情
            </div>
            <div className="hud-line mb-4" />

            <div className="space-y-4">
              <div>
                <div className="text-xs font-mono text-cockpit-warning mb-2">📊 数值指标变化</div>
                {(compareResult.numeric_diffs || [])
                  .filter((d) => d.mean_change_pct !== undefined && Math.abs(d.mean_change_pct) >= 5)
                  .slice(0, 6)
                  .map((d, i) => {
                    const up = (d.mean_change_pct ?? 0) >= 0
                    return (
                      <div
                        key={i}
                        className="mb-2 p-2 rounded bg-cockpit-panel/30 border-l-2 border-cockpit-primary/30"
                      >
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-cockpit-text font-medium">{d.column}</span>
                          <span
                            className={`text-xs font-mono font-bold ${
                              up ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {up ? '+' : ''}
                            {d.mean_change_pct?.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between text-xs text-cockpit-muted mt-1 font-mono">
                          <span className="text-cockpit-cyan">A: {d.mean_a?.toFixed(1)}</span>
                          <span>→</span>
                          <span className="text-cockpit-purple">B: {d.mean_b?.toFixed(1)}</span>
                        </div>
                      </div>
                    )
                  })}
                {(compareResult.numeric_diffs || []).filter(
                  (d) => d.mean_change_pct !== undefined && Math.abs(d.mean_change_pct) >= 5,
                ).length === 0 && (
                  <div className="text-xs text-cockpit-muted py-2">无显著数值变化</div>
                )}
              </div>

              {compareResult.timeseries_diff && (
                <div>
                  <div className="text-xs font-mono text-cockpit-warning mb-2">📈 时间序列变化</div>
                  <div className="p-2 rounded bg-cockpit-panel/30 border-l-2 border-cockpit-warning/50">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-cockpit-text">
                        {compareResult.timeseries_diff.value_column} 总量
                      </span>
                      <span
                        className={`text-xs font-mono font-bold ${
                          (compareResult.timeseries_diff.total_change_pct ?? 0) >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      >
                        {(compareResult.timeseries_diff.total_change_pct ?? 0) >= 0 ? '+' : ''}
                        {compareResult.timeseries_diff.total_change_pct?.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-cockpit-muted font-mono">
                      <span className="text-cockpit-cyan">
                        A: {compareResult.timeseries_diff.total_a?.toLocaleString()}
                      </span>
                      <span>→</span>
                      <span className="text-cockpit-purple">
                        B: {compareResult.timeseries_diff.total_b?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-cockpit-muted mt-2 font-mono">
                    对齐字段: {compareResult.timeseries_diff.time_column}
                  </div>
                </div>
              )}

              {(compareResult.categorical_diffs || []).slice(0, 2).map((cd, ci) => (
                <div key={ci}>
                  <div className="text-xs font-mono text-cockpit-warning mb-2">
                    🏷 {cd.column} 分类变化
                  </div>
                  <div className="space-y-1">
                    {cd.items
                      .filter((i) => Math.abs(i.pct_change) >= 3)
                      .slice(0, 4)
                      .map((item, ii) => {
                        const up = item.pct_change >= 0
                        return (
                          <div
                            key={ii}
                            className="flex justify-between items-center p-2 rounded bg-cockpit-panel/30"
                          >
                            <span className="text-xs text-cockpit-text truncate max-w-[50%]">
                              {item.category}
                            </span>
                            <span
                              className={`text-xs font-mono font-bold ${
                                up ? 'text-green-400' : 'text-red-400'
                              }`}
                            >
                              {up ? '+' : ''}
                              {item.pct_change.toFixed(1)}pp
                            </span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center text-cockpit-muted pt-8">
      <div className="text-center">
        <div className="text-6xl mb-4 opacity-30">⚖</div>
        <div>{text}</div>
      </div>
    </div>
  )
}
