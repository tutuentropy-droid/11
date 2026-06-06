import { useAnalysisStore } from '../../store/analysisStore'
import type { CompareInsight } from '../../types'

function severityStyle(s: CompareInsight['severity']) {
  return {
    high: 'border-l-cockpit-danger bg-cockpit-danger/5 hover:bg-cockpit-danger/10',
    medium: 'border-l-cockpit-warning bg-cockpit-warning/5 hover:bg-cockpit-warning/10',
    low: 'border-l-cockpit-cyan bg-cockpit-cyan/5 hover:bg-cockpit-cyan/10',
  }[s]
}

function severityIcon(s: CompareInsight['severity']) {
  return { high: '🚨', medium: '⚠️', low: 'ℹ️' }[s]
}

function categoryLabel(cat: string) {
  return {
    numeric: '📊 数值',
    categorical: '🏷 分类',
    timeseries: '📈 时序',
    correlation: '🔗 相关',
    general: '📋 总览',
  }[cat] || cat
}

export default function CompareInsightList() {
  const insights = useAnalysisStore((s) => s.compareResult?.summary.insights || [])
  const setActiveCompareChart = useAnalysisStore((s) => s.setActiveCompareChart)

  const display = insights.slice(0, 10)

  const handleClick = (ins: CompareInsight) => {
    if (ins.category === 'timeseries') setActiveCompareChart('compare_timeseries')
    else if (ins.category === 'correlation') setActiveCompareChart('compare_correlation')
    else if (ins.category === 'numeric') setActiveCompareChart('compare_numeric')
    else if (ins.category === 'categorical') setActiveCompareChart('compare_categorical')
  }

  return (
    <div className="glass-panel relative p-4 max-h-[420px] overflow-y-auto scrollbar-thin">
      <span className="hud-corner tl" />
      <span className="hud-corner br" />
      <div className="text-xs font-mono text-cockpit-cyan uppercase tracking-wider mb-3 flex items-center gap-2">
        <span>◆</span> 对比洞察
      </div>
      <div className="hud-line mb-4" />
      <div className="space-y-2">
        {display.length === 0 ? (
          <div className="text-sm text-cockpit-muted py-4 text-center">暂无对比洞察</div>
        ) : (
          display.map((ins, idx) => (
            <button
              key={idx}
              onClick={() => handleClick(ins)}
              className={`w-full text-left border-l-4 rounded-r-lg px-3 py-2.5 transition-all text-sm ${severityStyle(
                ins.severity,
              )}`}
            >
              <div className="flex items-start gap-2">
                <span>{severityIcon(ins.severity)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-cockpit-text leading-snug">{ins.text}</div>
                  <div className="text-[10px] text-cockpit-muted mt-1 font-mono">
                    {categoryLabel(ins.category)}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
