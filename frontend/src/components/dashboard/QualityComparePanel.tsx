import QualityScoreBadge, { QualityBreakdownBars } from './QualityScoreBadge'
import type { QualityCategory } from '../../types'

export default function QualityComparePanel({
  before,
  after,
}: {
  before?: QualityCategory
  after?: QualityCategory
}) {
  if (!before || !after) return null

  const improvement = after.score_percentage - before.score_percentage
  const improved = improvement > 0.01

  return (
    <div className="glass-panel relative p-5">
      <span className="hud-corner tl" />
      <span className="hud-corner tr" />
      <span className="hud-corner bl" />
      <span className="hud-corner br" />

      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">📊</span>
        <span className="font-mono text-sm text-cockpit-cyan uppercase tracking-wider">
          数据质量对比
        </span>
        {improved && (
          <span className="ml-auto px-2 py-0.5 text-xs rounded-full bg-green-500/20 text-green-400 border border-green-500/30 font-mono">
            ▲ +{improvement.toFixed(2)}%
          </span>
        )}
      </div>

      <div className="flex items-center justify-around">
        <QualityScoreBadge quality={before} label="清洗前" size="sm" />
        <div className="flex flex-col items-center">
          <div className={`text-3xl ${improved ? 'text-green-400' : 'text-cockpit-muted'}`}>
            {improved ? '➜' : '≈'}
          </div>
          <div className={`text-xs font-mono mt-1 ${improved ? 'text-green-400' : 'text-cockpit-muted'}`}>
            {improved ? '提升' : '持平'}
          </div>
        </div>
        <QualityScoreBadge quality={after} label="清洗后" size="sm" />
      </div>

      <div className="hud-line w-full my-4" />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-mono text-cockpit-muted mb-2">清洗前</div>
          <QualityBreakdownBars quality={before} />
        </div>
        <div>
          <div className="text-xs font-mono text-cockpit-muted mb-2">清洗后</div>
          <QualityBreakdownBars quality={after} />
        </div>
      </div>
    </div>
  )
}
