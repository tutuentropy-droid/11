import { useAnalysisStore } from '../../store/analysisStore'
import type { ColumnInfo } from '../../types'

function typeColor(t: ColumnInfo['type']) {
  return {
    numeric: 'text-cockpit-cyan',
    categorical: 'text-cockpit-purple',
    datetime: 'text-cockpit-primary',
    boolean: 'text-green-400',
    text: 'text-cockpit-warning',
  }[t]
}

function typeLabel(t: ColumnInfo['type']) {
  return { numeric: '数值', categorical: '分类', datetime: '时间', boolean: '布尔', text: '文本' }[t]
}

function fmt(v?: number) {
  if (v === undefined || v === null) return '-'
  if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return String(v)
}

export default function DetailPanel() {
  const result = useAnalysisStore((s) => s.result)
  const selectedPoint = useAnalysisStore((s) => s.selectedPoint)
  const selectedInsight = useAnalysisStore((s) => s.selectedInsight)
  const columns = result?.columns || []

  return (
    <div className="glass-panel relative p-4 h-[680px] flex flex-col">
      <span className="hud-corner tl" />
      <span className="hud-corner br" />
      <div className="text-xs font-mono text-cockpit-cyan uppercase tracking-wider mb-3 flex items-center gap-2">
        <span>◆</span> 详情面板
      </div>
      <div className="hud-line mb-4" />

      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3 pr-1">
        {selectedInsight ? (
          <div className="p-4 rounded-lg bg-gradient-to-br from-cockpit-purple/10 to-cockpit-primary/5 border border-cockpit-purple/20">
            <div className="text-xs font-mono text-cockpit-purple mb-2">💡 洞察详情</div>
            <div className="text-sm text-cockpit-text mb-3">{selectedInsight.text}</div>
            {selectedInsight.details && (
              <div className="space-y-1.5 text-xs">
                {Object.entries(selectedInsight.details).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-cockpit-muted">{k}</span>
                    <span className="text-cockpit-cyan font-mono">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 text-xs text-cockpit-muted">
              严重度:{' '}
              <span
                className={
                  selectedInsight.severity === 'high'
                    ? 'text-cockpit-danger'
                    : selectedInsight.severity === 'medium'
                      ? 'text-cockpit-warning'
                      : 'text-cockpit-cyan'
                }
              >
                {selectedInsight.severity === 'high' ? '高' : selectedInsight.severity === 'medium' ? '中' : '低'}
              </span>
            </div>
          </div>
        ) : null}

        {selectedPoint ? (
          <div className="p-4 rounded-lg bg-cockpit-primary/5 border border-cockpit-primary/20">
            <div className="text-xs font-mono text-cockpit-primary mb-2">🎯 数据点详情</div>
            <div className="space-y-1.5 text-xs">
              {Object.entries(selectedPoint).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <span className="text-cockpit-muted truncate">{k}</span>
                  <span className="text-cockpit-cyan font-mono truncate">
                    {v === null || v === undefined ? '-' : String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div>
          <div className="text-xs font-mono text-cockpit-muted uppercase mb-3 flex items-center gap-2">
            <span>▸</span> 数据列概览
          </div>
          <div className="space-y-2">
            {columns.map((col) => (
              <div
                key={col.name}
                className="p-3 rounded-lg bg-cockpit-panel/50 border border-cockpit-border hover:border-cockpit-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-sm font-medium text-cockpit-text truncate">{col.name}</div>
                  <span className={`text-xs font-mono ${typeColor(col.type)}`}>{typeLabel(col.type)}</span>
                </div>
                <div className="text-xs text-cockpit-muted mb-2 font-mono">
                  缺失 {(col.missing_rate * 100).toFixed(1)}% · 唯一 {col.unique_count}
                  {col.outliers.length > 0 && (
                    <span className="text-cockpit-danger ml-2">⚠ {col.outliers.length} 异常</span>
                  )}
                </div>
                {col.stats && (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-cockpit-muted">均值</span>
                      <span className="text-cockpit-cyan font-mono">{fmt(col.stats.mean)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cockpit-muted">中位</span>
                      <span className="text-cockpit-cyan font-mono">{fmt(col.stats.median)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cockpit-muted">最小</span>
                      <span className="text-cockpit-cyan font-mono">{fmt(col.stats.min)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cockpit-muted">最大</span>
                      <span className="text-cockpit-cyan font-mono">{fmt(col.stats.max)}</span>
                    </div>
                  </div>
                )}
                {col.categories && col.categories.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {col.categories.slice(0, 3).map((cat) => (
                      <div key={cat.name} className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-cockpit-panel rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-cockpit-purple to-cockpit-primary"
                            style={{ width: `${cat.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-cockpit-muted w-10 text-right">{cat.percentage}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
