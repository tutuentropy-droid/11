import type { IndustryAnalysis } from '../../types'

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

interface HeaderProps {
  filename: string
  headline: string
  onBack: () => void
  onExport: () => void
  exporting: boolean
  industry?: IndustryAnalysis
}

export default function Header({ filename, headline, onBack, onExport, exporting, industry }: HeaderProps) {
  return (
    <div className="glass-panel relative px-6 py-4 flex items-center justify-between flex-wrap gap-4">
      <span className="hud-corner tl" />
      <span className="hud-corner tr" />
      <span className="hud-corner bl" />
      <span className="hud-corner br" />

      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-md text-sm text-cockpit-muted hover:text-cockpit-text hover:bg-cockpit-primary/10 border border-cockpit-border transition-colors"
        >
          ← 重新上传
        </button>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 bg-cockpit-cyan rounded-full animate-pulse" />
            <span className="text-xs font-mono text-cockpit-cyan uppercase tracking-wider">
              Live Analysis
            </span>
            {industry && industry.template_id !== 'general' && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${COLOR_MAP[industry.template_color] || COLOR_MAP.blue}`}
              >
                <span>{industry.template_icon}</span>
                <span>{industry.template_name}</span>
              </span>
            )}
          </div>
          <div className="text-xl font-bold text-gradient mt-0.5">{headline}</div>
          <div className="text-xs text-cockpit-muted mt-0.5 font-mono flex items-center gap-2 flex-wrap">
            <span>📄 {filename}</span>
            {industry && industry.template_id !== 'general' && (
              <span className="text-cockpit-cyan">
                · AI 匹配置信度 {Math.min(100, Math.round(industry.match_score))}%
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md border border-cockpit-border text-xs font-mono text-cockpit-muted">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          SYSTEM ONLINE
        </div>
        <button
          onClick={onExport}
          disabled={exporting}
          className="px-4 py-2 rounded-md text-sm font-medium bg-gradient-to-r from-cockpit-primary to-cockpit-purple hover:from-cockpit-primary/90 hover:to-cockpit-purple/90 text-white shadow-lg shadow-cockpit-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting ? '生成中...' : '📤 导出报告'}
        </button>
      </div>
    </div>
  )
}
