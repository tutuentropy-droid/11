import { useAnalysisStore } from '../../store/analysisStore'
import type { Insight } from '../../types'

function severityStyle(s: Insight['severity']) {
  return {
    high: 'border-l-cockpit-danger bg-cockpit-danger/5 hover:bg-cockpit-danger/10',
    medium: 'border-l-cockpit-warning bg-cockpit-warning/5 hover:bg-cockpit-warning/10',
    low: 'border-l-cockpit-cyan bg-cockpit-cyan/5 hover:bg-cockpit-cyan/10',
  }[s]
}

function severityIcon(s: Insight['severity']) {
  return { high: '🚨', medium: '⚠️', low: 'ℹ️' }[s]
}

export default function InsightList() {
  const insights = useAnalysisStore((s) => s.result?.summary.insights || [])
  const selectedInsight = useAnalysisStore((s) => s.selectedInsight)
  const setSelectedInsight = useAnalysisStore((s) => s.setSelectedInsight)
  const setActiveChart = useAnalysisStore((s) => s.setActiveChart)

  const display = insights.slice(0, 6)

  return (
    <div className="glass-panel relative p-4 max-h-[420px] overflow-y-auto scrollbar-thin">
      <span className="hud-corner tl" />
      <span className="hud-corner br" />
      <div className="text-xs font-mono text-cockpit-cyan uppercase tracking-wider mb-3 flex items-center gap-2">
        <span>◆</span> 关键洞察
      </div>
      <div className="hud-line mb-4" />
      <div className="space-y-2">
        {display.length === 0 ? (
          <div className="text-sm text-cockpit-muted py-4 text-center">暂无洞察</div>
        ) : (
          display.map((ins, idx) => {
            const active = selectedInsight?.text === ins.text
            return (
              <button
                key={idx}
                onClick={() => {
                  setSelectedInsight(active ? null : ins)
                  if (ins.viz && ['correlation', 'scatter', 'histogram', 'timeseries', 'pie'].includes(ins.viz)) {
                    setActiveChart(ins.viz as any)
                  }
                }}
                className={`w-full text-left border-l-4 rounded-r-lg px-3 py-2.5 transition-all text-sm ${severityStyle(
                  ins.severity
                )} ${active ? 'ring-1 ring-cockpit-primary/40' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <span>{severityIcon(ins.severity)}</span>
                  <span className="text-cockpit-text leading-snug">{ins.text}</span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
