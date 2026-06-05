interface HeaderProps {
  filename: string
  headline: string
  onBack: () => void
  onExport: () => void
  exporting: boolean
}

export default function Header({ filename, headline, onBack, onExport, exporting }: HeaderProps) {
  return (
    <div className="glass-panel relative px-6 py-4 flex items-center justify-between">
      <span className="hud-corner tl" />
      <span className="hud-corner tr" />
      <span className="hud-corner bl" />
      <span className="hud-corner br" />

      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-md text-sm text-cockpit-muted hover:text-cockpit-text hover:bg-cockpit-primary/10 border border-cockpit-border transition-colors"
        >
          ← 重新上传
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-cockpit-cyan rounded-full animate-pulse" />
            <span className="text-xs font-mono text-cockpit-cyan uppercase tracking-wider">
              Live Analysis
            </span>
          </div>
          <div className="text-xl font-bold text-gradient mt-0.5">{headline}</div>
          <div className="text-xs text-cockpit-muted mt-0.5 font-mono">📄 {filename}</div>
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
