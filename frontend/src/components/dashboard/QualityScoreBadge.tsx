import { useMemo } from 'react'
import type { QualityCategory } from '../../types'

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'from-green-400 to-emerald-500'
    case 'B': return 'from-cyan-400 to-blue-500'
    case 'C': return 'from-yellow-400 to-amber-500'
    case 'D': return 'from-orange-400 to-red-500'
    case 'F': return 'from-red-500 to-rose-600'
    default: return 'from-gray-400 to-gray-500'
  }
}

function getGradeRingColor(grade: string): string {
  switch (grade) {
    case 'A': return '#34d399'
    case 'B': return '#06b6d4'
    case 'C': return '#facc15'
    case 'D': return '#fb923c'
    case 'F': return '#f43f5e'
    default: return '#6b7280'
  }
}

const DIMENSION_LABELS: Record<string, string> = {
  completeness: '完整性',
  uniqueness: '唯一性',
  validity: '有效性',
  consistency: '一致性',
  accuracy: '准确性',
}

export default function QualityScoreBadge({
  quality,
  label = '当前质量',
  size = 'lg',
}: {
  quality?: QualityCategory
  label?: string
  size?: 'sm' | 'lg'
}) {
  if (!quality) return null

  const ringColor = getGradeRingColor(quality.grade)
  const sizeClass = size === 'lg' ? 'w-32 h-32' : 'w-20 h-20'
  const gradeSize = size === 'lg' ? 'text-4xl' : 'text-2xl'
  const scoreSize = size === 'lg' ? 'text-xl' : 'text-sm'

  const conicGradient = useMemo(() => {
    const pct = Math.max(0, Math.min(100, quality.score_percentage))
    return `conic-gradient(${ringColor} 0deg, ${ringColor} ${pct * 3.6}deg, rgba(255,255,255,0.08) ${pct * 3.6}deg, rgba(255,255,255,0.08) 360deg)`
  }, [quality.score_percentage, ringColor])

  return (
    <div className="flex flex-col items-center">
      <div className="quality-badge-3d">
        <div className={`quality-badge-inner ${sizeClass} relative`}>
          <div
            className={`${sizeClass} rounded-full`}
            style={{ background: conicGradient }}
          />
          <div
            className={`absolute inset-2 rounded-full bg-cockpit-bg/90 backdrop-blur flex flex-col items-center justify-center border border-white/5`}
            style={{ boxShadow: `inset 0 0 30px ${ringColor}30, 0 10px 30px rgba(0,0,0,0.5)` }}
          >
            <div className={`${gradeSize} font-bold text-gradient bg-gradient-to-br ${getGradeColor(quality.grade)} bg-clip-text text-transparent`}>
              {quality.grade}
            </div>
            <div className={`${scoreSize} font-mono text-cockpit-text mt-0.5`}>
              {quality.score_percentage.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
      <div className="text-xs font-mono text-cockpit-muted mt-2 uppercase tracking-wider">
        {label}
      </div>
    </div>
  )
}

export function QualityBreakdownBars({ quality }: { quality: QualityCategory }) {
  return (
    <div className="space-y-2">
      {Object.entries(quality.breakdown).map(([key, value]) => {
        const pct = Math.round(value * 100)
        const color = pct >= 85 ? 'bg-green-400' : pct >= 65 ? 'bg-cyan-400' : pct >= 45 ? 'bg-yellow-400' : 'bg-red-400'
        return (
          <div key={key}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-cockpit-muted">{DIMENSION_LABELS[key] || key}</span>
              <span className="font-mono text-cockpit-text">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-cockpit-panel/50 overflow-hidden">
              <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
