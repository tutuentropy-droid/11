import { useMemo, useState } from 'react'
import type { DataQualityIssue, DataQualityReport, AnalysisResult } from '../../types'
import { useAnalysisStore } from '../../store/analysisStore'
import { cleanIssue, cleanAllIssues } from '../../services/api'
import Modal from './Modal'

const ISSUE_TYPE_META: Record<string, { label: string; icon: string; cellClass: string; colorClass: string }> = {
  duplicate: { label: '重复行', icon: '📋', cellClass: 'cell-duplicate', colorClass: 'text-amber-400 border-amber-400/50 bg-amber-400/10' },
  missing: { label: '缺失值', icon: '⬚', cellClass: 'cell-missing', colorClass: 'text-red-400 border-red-400/50 bg-red-400/10' },
  format_date: { label: '日期格式异常', icon: '📅', cellClass: 'cell-format', colorClass: 'text-purple-400 border-purple-400/50 bg-purple-400/10' },
  format_numeric: { label: '数值格式异常', icon: '🔢', cellClass: 'cell-format', colorClass: 'text-purple-400 border-purple-400/50 bg-purple-400/10' },
  case_inconsistency: { label: '大小写不一致', icon: '🔤', cellClass: 'cell-case', colorClass: 'text-cyan-400 border-cyan-400/50 bg-cyan-400/10' },
  extreme_value: { label: '极端异常值', icon: '⚠️', cellClass: 'cell-extreme', colorClass: 'text-pink-400 border-pink-400/50 bg-pink-400/10' },
}

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
  }
  const label: Record<string, string> = { high: '高', medium: '中', low: '低' }
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-mono rounded border ${map[severity] || map.low}`}>
      {label[severity] || severity}
    </span>
  )
}

function IssueDetailModal({
  open,
  onClose,
  issue,
  issueIndex,
}: {
  open: boolean
  onClose: () => void
  issue: DataQualityIssue | null
  issueIndex: number
}) {
  const taskId = useAnalysisStore((s) => s.result?.task_id)
  const cleaning = useAnalysisStore((s) => s.cleaning)
  const applyCleanResult = useAnalysisStore((s) => s.applyCleanResult)
  const setCleaning = useAnalysisStore((s) => s.setCleaning)
  const setCleaningError = useAnalysisStore((s) => s.setCleaningError)
  const setQualityBeforeSnapshot = useAnalysisStore((s) => s.setQualityBeforeSnapshot)
  const qualityReport = useAnalysisStore((s) => s.result?.quality_report)

  if (!issue) return null

  const meta = ISSUE_TYPE_META[issue.issue_type] || ISSUE_TYPE_META.missing

  const handleFix = async () => {
    if (!taskId) return
    if (qualityReport?.quality) setQualityBeforeSnapshot(qualityReport.quality)
    setCleaning(true)
    setCleaningError(null)
    try {
      const result = await cleanIssue(taskId, issueIndex)
      applyCleanResult(result)
      onClose()
    } catch (e: any) {
      setCleaningError(e?.response?.data?.detail || e?.message || '修正失败')
    } finally {
      setCleaning(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`${meta.icon} ${meta.label}详情`}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <SeverityBadge severity={issue.severity} />
          <span className={`px-2 py-1 text-xs rounded border ${meta.colorClass}`}>
            {meta.label}
          </span>
          {issue.fixed && (
            <span className="px-2 py-1 text-xs rounded bg-green-500/20 text-green-400 border border-green-500/30">
              ✓ 已修正
            </span>
          )}
        </div>

        <div className="text-cockpit-text font-medium">{issue.message}</div>

        <div className="glass-panel p-3 text-sm">
          <div className="text-xs font-mono text-cockpit-muted mb-2 uppercase tracking-wider">受影响数据</div>
          <div className="space-y-1 text-cockpit-text">
            <div>列: <span className="font-mono text-cockpit-cyan">{issue.column}</span></div>
            <div>影响行数: <span className="font-mono text-cockpit-warning">{issue.count}</span></div>
            <div>
              行索引: <span className="font-mono text-cockpit-muted text-xs">
                {issue.row_indices.slice(0, 10).join(', ')}{issue.row_indices.length > 10 ? ` ... (+${issue.row_indices.length - 10} more)` : ''}
              </span>
            </div>
          </div>
        </div>

        {issue.details && Object.keys(issue.details).length > 0 && (
          <div className="glass-panel p-3 text-sm">
            <div className="text-xs font-mono text-cockpit-muted mb-2 uppercase tracking-wider">详细信息</div>
            <pre className="text-xs text-cockpit-text font-mono overflow-auto max-h-40 scrollbar-thin whitespace-pre-wrap">
              {JSON.stringify(issue.details, null, 2)}
            </pre>
          </div>
        )}

        {issue.suggestion && (
          <div className="glass-panel p-3 text-sm border border-cockpit-cyan/20">
            <div className="text-xs font-mono text-cockpit-cyan mb-2 uppercase tracking-wider flex items-center gap-1">
              <span>⚡</span> 建议修正方案
            </div>
            <div className="text-cockpit-text">{issue.suggestion.description}</div>
            <div className="text-xs text-cockpit-muted mt-1">{issue.suggestion.impact}</div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg glass-panel text-cockpit-muted hover:text-cockpit-text"
          >
            关闭
          </button>
          {!issue.fixed && issue.suggestion && (
            <button
              onClick={handleFix}
              disabled={cleaning}
              className="px-4 py-2 text-sm rounded-lg bg-gradient-to-r from-cockpit-primary to-cockpit-purple text-white font-medium disabled:opacity-50 hover:scale-105 transition-transform"
            >
              {cleaning ? '处理中...' : '⚡ 一键修正'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export function IssueList({ report, result }: { report: DataQualityReport; result: AnalysisResult }) {
  const taskId = result.task_id
  const [selectedIssue, setSelectedIssue] = useState<{ issue: DataQualityIssue; index: number } | null>(null)
  const cleaning = useAnalysisStore((s) => s.cleaning)
  const applyCleanResult = useAnalysisStore((s) => s.applyCleanResult)
  const setCleaning = useAnalysisStore((s) => s.setCleaning)
  const setCleaningError = useAnalysisStore((s) => s.setCleaningError)
  const setQualityBeforeSnapshot = useAnalysisStore((s) => s.setQualityBeforeSnapshot)
  const cleaningError = useAnalysisStore((s) => s.cleaningError)

  const unfixedCount = report.issues.filter((i) => !i.fixed).length

  const handleFixAll = async () => {
    if (!taskId || unfixedCount === 0) return
    if (report.quality) setQualityBeforeSnapshot(report.quality)
    setCleaning(true)
    setCleaningError(null)
    try {
      const result = await cleanAllIssues(taskId)
      applyCleanResult(result)
    } catch (e: any) {
      setCleaningError(e?.response?.data?.detail || e?.message || '批量修正失败')
    } finally {
      setCleaning(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-mono text-cockpit-muted uppercase tracking-wider">
          ⚠ 检测到 {report.total_issues} 类问题 · 影响 {report.total_affected_rows} 行
        </div>
        <button
          onClick={handleFixAll}
          disabled={cleaning || unfixedCount === 0}
          className="px-3 py-1.5 text-xs rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 text-white font-medium disabled:opacity-40 hover:scale-105 transition-transform"
        >
          {cleaning ? '处理中...' : `🚀 一键修正全部 (${unfixedCount})`}
        </button>
      </div>

      {cleaningError && (
        <div className="text-xs p-2 rounded bg-red-500/10 border border-red-500/30 text-red-400">
          {cleaningError}
        </div>
      )}

      <div className="space-y-2 max-h-[400px] overflow-auto scrollbar-thin pr-1">
        {report.issues.map((issue, idx) => {
          const meta = ISSUE_TYPE_META[issue.issue_type] || ISSUE_TYPE_META.missing
          return (
            <div
              key={idx}
              className={`glass-panel p-3 relative transition-all ${issue.fixed ? 'opacity-60' : 'hover:scale-[1.01]'}`}
            >
              {issue.fixed && (
                <div className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                  ✓ 已修正
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-lg">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={issue.severity} />
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.colorClass}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="text-sm text-cockpit-text mb-2">{issue.message}</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedIssue({ issue, index: idx })}
                      className="px-2.5 py-1 text-xs rounded border border-cockpit-cyan/40 text-cockpit-cyan hover:bg-cockpit-cyan/10 transition-colors"
                    >
                      🔍 查看详情
                    </button>
                    {!issue.fixed && issue.suggestion && (
                      <button
                        onClick={async () => {
                          if (!taskId) return
                          if (report.quality) setQualityBeforeSnapshot(report.quality)
                          setCleaning(true)
                          setCleaningError(null)
                          try {
                            const res = await cleanIssue(taskId, idx)
                            applyCleanResult(res)
                          } catch (e: any) {
                            setCleaningError(e?.response?.data?.detail || e?.message || '修正失败')
                          } finally {
                            setCleaning(false)
                          }
                        }}
                        disabled={cleaning}
                        className="px-2.5 py-1 text-xs rounded bg-gradient-to-r from-cockpit-primary to-cockpit-purple text-white disabled:opacity-50 hover:scale-105 transition-transform"
                      >
                        ⚡ 一键修正
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <IssueDetailModal
        open={!!selectedIssue}
        onClose={() => setSelectedIssue(null)}
        issue={selectedIssue?.issue || null}
        issueIndex={selectedIssue?.index || 0}
      />
    </div>
  )
}

export function QualityAnnotatedTable({ result }: { result: AnalysisResult }) {
  const sampledData = result.sampled_data || []
  const qualityReport = result.quality_report
  const columns = result.columns.map((c) => c.name)

  const cellAnnotations = useMemo(() => {
    const map: Record<string, string> = {}
    if (!qualityReport) return map
    for (const issue of qualityReport.issues) {
      const meta = ISSUE_TYPE_META[issue.issue_type]
      if (!meta) continue
      if (issue.issue_type === 'duplicate') {
        for (const ridx of issue.row_indices) {
          for (const col of columns) {
            map[`${ridx}-${col}`] = meta.cellClass
          }
        }
      } else {
        for (const ridx of issue.row_indices) {
          map[`${ridx}-${issue.column}`] = meta.cellClass
        }
      }
    }
    return map
  }, [qualityReport, columns])

  const legendItems = useMemo(() => {
    if (!qualityReport) return []
    const types = new Set(qualityReport.issues.map((i) => i.issue_type))
    return Array.from(types).map((t) => ({ type: t, meta: ISSUE_TYPE_META[t] || ISSUE_TYPE_META.missing }))
  }, [qualityReport])

  if (!sampledData.length) {
    return <div className="text-cockpit-muted text-sm text-center py-8">无预览数据</div>
  }

  const previewRows = sampledData.slice(0, 30)

  return (
    <div className="space-y-3">
      {legendItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-cockpit-muted font-mono uppercase tracking-wider">图例:</span>
          {legendItems.map(({ type, meta }) => (
            <div key={type} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded"
                style={{
                  background: meta.colorClass.includes('red') ? 'rgba(248,113,113,0.3)' :
                    meta.colorClass.includes('amber') ? 'rgba(251,191,36,0.3)' :
                    meta.colorClass.includes('purple') ? 'rgba(192,132,252,0.3)' :
                    meta.colorClass.includes('cyan') ? 'rgba(34,211,238,0.3)' :
                    meta.colorClass.includes('pink') ? 'rgba(244,114,182,0.3)' : 'rgba(156,163,175,0.3)',
                  border: `1px solid ${
                    meta.colorClass.includes('red') ? 'rgba(248,113,113,0.8)' :
                    meta.colorClass.includes('amber') ? 'rgba(251,191,36,0.8)' :
                    meta.colorClass.includes('purple') ? 'rgba(192,132,252,0.8)' :
                    meta.colorClass.includes('cyan') ? 'rgba(34,211,238,0.8)' :
                    meta.colorClass.includes('pink') ? 'rgba(244,114,182,0.8)' : 'rgba(156,163,175,0.8)'
                  }`,
                }}
              />
              <span className="text-cockpit-muted">{meta.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="overflow-auto max-h-[340px] scrollbar-thin rounded-lg border border-white/5">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-cockpit-panel/90 backdrop-blur">
              <th className="px-2 py-2 text-left font-mono text-cockpit-muted border-b border-white/10 w-12">#</th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-2 py-2 text-left font-mono text-cockpit-text border-b border-white/10 whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, ridx) => (
              <tr key={ridx} className="hover:bg-cockpit-primary/5">
                <td className="px-2 py-1.5 font-mono text-cockpit-muted border-b border-white/5 w-12">
                  {ridx}
                </td>
                {columns.map((col) => {
                  const anno = cellAnnotations[`${ridx}-${col}`]
                  const raw = row[col]
                  const display = raw === null || raw === undefined ? '∅' : String(raw)
                  return (
                    <td
                      key={col}
                      className={`px-2 py-1.5 border-b border-white/5 whitespace-nowrap relative ${
                        anno ? 'cell-3d-highlight ' + anno : 'text-cockpit-text'
                      }`}
                    >
                      <span className={display === '∅' ? 'text-cockpit-muted italic' : ''}>
                        {display.length > 30 ? display.slice(0, 30) + '…' : display}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-cockpit-muted">
        {sampledData.length > 30 ? `显示前 30 / ${sampledData.length} 行 · ` : ''}
        带三维标注的单元格表示存在数据质量问题，悬停查看详情
      </div>
    </div>
  )
}
