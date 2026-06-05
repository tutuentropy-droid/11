import { useAnalysisStore } from '../../store/analysisStore'
import type { ChartType } from '../../types'

interface ChartItem {
  id: string
  label: string
  icon: string
}

interface Props {
  charts: ChartItem[]
}

export default function ChartNav({ charts }: Props) {
  const activeChart = useAnalysisStore((s) => s.activeChart)
  const setActiveChart = useAnalysisStore((s) => s.setActiveChart)

  return (
    <div className="glass-panel relative p-4">
      <span className="hud-corner tl" />
      <span className="hud-corner br" />
      <div className="text-xs font-mono text-cockpit-cyan uppercase tracking-wider mb-3 flex items-center gap-2">
        <span>◆</span> 指挥舱导航
      </div>
      <div className="hud-line mb-4" />
      <div className="space-y-2">
        {charts.length === 0 ? (
          <div className="text-sm text-cockpit-muted py-4 text-center">暂无可视化图表</div>
        ) : (
          charts.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveChart(c.id as ChartType)}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-all ${
                activeChart === c.id
                  ? 'bg-gradient-to-r from-cockpit-primary/20 to-cockpit-purple/10 border border-cockpit-primary/40 shadow-md shadow-cockpit-primary/10'
                  : 'hover:bg-cockpit-primary/5 border border-transparent'
              }`}
            >
              <span className="text-xl">{c.icon}</span>
              <div className="flex-1">
                <div
                  className={`text-sm font-medium ${
                    activeChart === c.id ? 'text-cockpit-text' : 'text-cockpit-muted'
                  }`}
                >
                  {c.label}
                </div>
              </div>
              {activeChart === c.id && (
                <span className="w-1.5 h-1.5 rounded-full bg-cockpit-cyan animate-pulse" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
