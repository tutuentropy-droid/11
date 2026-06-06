import { useAnalysisStore } from '../../store/analysisStore'
import type { OutlierStoryCard as OutlierStoryCardType } from '../../types'

function fmtNum(v: number) {
  if (v === undefined || v === null) return '-'
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function OutlierStoryCard({ data }: { data: OutlierStoryCardType }) {
  const isHigh = data.direction === '偏高'

  return (
    <div className="space-y-4">
      <div
        className={`p-4 rounded-lg border ${
          isHigh
            ? 'bg-gradient-to-br from-cockpit-danger/15 to-cockpit-warning/5 border-cockpit-danger/30'
            : 'bg-gradient-to-br from-cockpit-primary/15 to-cockpit-cyan/5 border-cockpit-primary/30'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{isHigh ? '📈' : '📉'}</span>
          <span
            className={`text-xs font-mono uppercase tracking-wider ${
              isHigh ? 'text-cockpit-danger' : 'text-cockpit-primary'
            }`}
          >
            异常{data.direction} · {data.column}
          </span>
        </div>
        <div className="text-sm text-cockpit-text leading-relaxed">{data.story}</div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-cockpit-panel/60 border border-cockpit-border">
          <div className="text-xs text-cockpit-muted mb-1">实际值</div>
          <div className={`text-lg font-mono font-bold ${isHigh ? 'text-cockpit-danger' : 'text-cockpit-primary'}`}>
            {fmtNum(data.actual_value)}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-cockpit-panel/60 border border-cockpit-border">
          <div className="text-xs text-cockpit-muted mb-1">预期范围</div>
          <div className="text-sm font-mono text-cockpit-cyan">
            {fmtNum(data.expected_min)} ~ {fmtNum(data.expected_max)}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-cockpit-panel/60 border border-cockpit-border">
          <div className="text-xs text-cockpit-muted mb-1">偏离幅度</div>
          <div className={`text-lg font-mono font-bold ${isHigh ? 'text-cockpit-danger' : 'text-cockpit-primary'}`}>
            {isHigh ? '+' : '-'}
            {data.deviation_percent.toFixed(1)}%
          </div>
        </div>
      </div>

      {data.context_fields && Object.keys(data.context_fields).length > 0 && (
        <div className="p-4 rounded-lg bg-cockpit-panel/40 border border-cockpit-border">
          <div className="text-xs font-mono text-cockpit-muted uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>▸</span> 关联字段
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {Object.entries(data.context_fields).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-xs text-cockpit-muted truncate">{k}</span>
                <span className="text-xs text-cockpit-cyan font-mono truncate">
                  {v === null || v === undefined ? '-' : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-cockpit-muted">
        记录索引: <span className="font-mono text-cockpit-muted">#{data.row_index}</span>
      </div>
    </div>
  )
}
