import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAnalysisStore } from '../store/analysisStore'
import { exportReport, downloadBlob } from '../services/api'
import Header from '../components/dashboard/Header'
import SummaryCards from '../components/dashboard/SummaryCards'
import ChartNav from '../components/dashboard/ChartNav'
import DetailPanel from '../components/dashboard/DetailPanel'
import Modal from '../components/dashboard/Modal'
import OutlierStoryCard from '../components/dashboard/OutlierStoryCard'
import Correlation3D from '../components/charts3d/Correlation3D'
import Scatter3D from '../components/charts3d/Scatter3D'
import Histogram3D from '../components/charts3d/Histogram3D'
import Timeseries3D from '../components/charts3d/Timeseries3D'
import Pie3D from '../components/charts3d/Pie3D'
import CustomChart3D from '../components/charts3d/CustomChart3D'
import InsightList from '../components/dashboard/InsightList'
import IndustryMetricsPanel from '../components/dashboard/IndustryMetricsPanel'
import { IssueList, QualityAnnotatedTable } from '../components/dashboard/DataQualityPanel'
import QualityComparePanel from '../components/dashboard/QualityComparePanel'
import QualityScoreBadge, { QualityBreakdownBars } from '../components/dashboard/QualityScoreBadge'
import NLChartInput from '../components/dashboard/NLChartInput'

export default function Dashboard() {
  const result = useAnalysisStore((s) => s.result)
  const activeChart = useAnalysisStore((s) => s.activeChart)
  const showNLCustomChart = useAnalysisStore((s) => s.showNLCustomChart)
  const reset = useAnalysisStore((s) => s.reset)
  const selectedOutlierStory = useAnalysisStore((s) => s.selectedOutlierStory)
  const setSelectedOutlierStory = useAnalysisStore((s) => s.setSelectedOutlierStory)
  const lastCleanResult = useAnalysisStore((s) => s.lastCleanResult)
  const qualityBeforeSnapshot = useAnalysisStore((s) => s.qualityBeforeSnapshot)
  const nlChartResponse = useAnalysisStore((s) => s.nlChartResponse)
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)
  const [showQualityPanel, setShowQualityPanel] = useState(false)

  if (!result) {
    navigate('/')
    return null
  }

  const hasCorrelation = !!result.correlations && result.correlations.columns.length > 1
  const hasNumeric = result.columns.some((c) => c.type === 'numeric')
  const hasOutliers = result.columns.some((c) => c.outliers.length > 0)
  const hasTimeseries = !!result.timeseries
  const hasCategorical = result.categorical_freq.length > 0
  const hasIndustry = !!result.industry && result.industry.template_id !== 'general'
  const hasQualityReport = !!result.quality_report
  const qualityReport = result.quality_report
  const qualityAfter = lastCleanResult?.quality_after || result.quality_report?.quality
  const qualityBefore = lastCleanResult?.quality_before || qualityBeforeSnapshot

  const availableCharts = useMemo(() => {
    const list: Array<{ id: string; label: string; icon: string }> = []
    if (hasCorrelation) list.push({ id: 'correlation', label: '相关性矩阵', icon: '🔗' })
    if (hasNumeric && hasOutliers) list.push({ id: 'scatter', label: '3D 散点图', icon: '✨' })
    if (hasNumeric) list.push({ id: 'histogram', label: '分布直方图', icon: '📊' })
    if (hasTimeseries) list.push({ id: 'timeseries', label: '时间序列', icon: '📈' })
    if (hasCategorical) list.push({ id: 'pie', label: '分类占比', icon: '🥧' })
    return list
  }, [hasCorrelation, hasNumeric, hasOutliers, hasTimeseries, hasCategorical])

  const renderChart = () => {
    if (showNLCustomChart) {
      return <CustomChart3D />
    }
    switch (activeChart) {
      case 'correlation':
        return hasCorrelation ? <Correlation3D /> : <EmptyChart text="无可分析的数值列" />
      case 'scatter':
        return <Scatter3D />
      case 'histogram':
        return <Histogram3D />
      case 'timeseries':
        return hasTimeseries ? <Timeseries3D /> : <EmptyChart text="未检测到时间序列" />
      case 'pie':
        return hasCategorical ? <Pie3D /> : <EmptyChart text="无分类字段" />
      default:
        return <EmptyChart text="选择一个图表开始探索" />
    }
  }

  const handleBack = () => {
    reset()
    navigate('/')
  }

  const handleExport = async () => {
    if (!result.task_id) return
    setExporting(true)
    try {
      const blob = await exportReport(result.task_id, { activeChart })
      downloadBlob(blob, `insight_report_${result.task_id}.html`)
    } catch (e) {
      alert('导出失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen w-full grid-bg p-4 md:p-6">
      <Header
        filename={result.dataset.name}
        headline={result.summary.headline}
        onBack={handleBack}
        onExport={handleExport}
        exporting={exporting}
        industry={result.industry}
      />

      {hasIndustry && (
        <div className="mt-4">
          <IndustryMetricsPanel />
        </div>
      )}

      <div className="mt-4 mb-4">
        <SummaryCards onQualityClick={hasQualityReport ? () => setShowQualityPanel(true) : undefined} />
      </div>

      {hasQualityReport && result.quality_report && (
        <div className="mb-4 grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-3">
            <div className="glass-panel relative p-4">
              <span className="hud-corner tl" />
              <span className="hud-corner br" />
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-mono text-cockpit-cyan uppercase tracking-wider">
                  ◎ 数据质量
                </div>
                <button
                  onClick={() => setShowQualityPanel(true)}
                  className="text-xs px-2 py-1 rounded border border-cockpit-cyan/30 text-cockpit-cyan hover:bg-cockpit-cyan/10 transition-colors"
                >
                  展开 →
                </button>
              </div>
              <div className="flex items-start gap-4">
                <QualityScoreBadge quality={result.quality_report.quality} size="sm" />
                <div className="flex-1">
                  <QualityBreakdownBars quality={result.quality_report.quality} />
                </div>
              </div>
            </div>
          </div>

          {qualityBefore && qualityAfter && lastCleanResult && (
            <div className="col-span-12 lg:col-span-9">
              <QualityComparePanel before={qualityBefore} after={qualityAfter} />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-2">
          <ChartNav charts={availableCharts} />
          <div className="mt-4">
            <InsightList />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <div className="mb-3">
            <NLChartInput />
          </div>
          <div className="glass-panel relative h-[680px] p-4">
            <span className="hud-corner tl" />
            <span className="hud-corner tr" />
            <span className="hud-corner bl" />
            <span className="hud-corner br" />
            <div className="absolute top-3 left-4 text-xs font-mono text-cockpit-muted z-10">
              <span className="text-cockpit-cyan">⟡</span> MAIN VIEWPORT ·{' '}
              {showNLCustomChart
                ? nlChartResponse?.chart_data?.title || '✨ 自然语言出图'
                : availableCharts.find((c) => c.id === activeChart)?.label || 'IDLE'}
            </div>
            <div className="w-full h-full">{renderChart()}</div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-3">
          <DetailPanel />
        </div>
      </div>

      <Modal
        open={!!selectedOutlierStory}
        onClose={() => setSelectedOutlierStory(null)}
        title="异常点故事卡片"
      >
        {selectedOutlierStory && <OutlierStoryCard data={selectedOutlierStory} />}
      </Modal>

      <Modal
        open={showQualityPanel}
        onClose={() => setShowQualityPanel(false)}
        title="🔬 数据质量扫描中心"
        wide
      >
        {hasQualityReport && qualityReport && result && (
          <div className="space-y-5">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-4">
                <div className="glass-panel p-4 h-full">
                  <div className="flex flex-col items-center justify-center h-full">
                    <QualityScoreBadge quality={qualityReport.quality} label="综合质量评分" />
                    <div className="w-full mt-5">
                      <QualityBreakdownBars quality={qualityReport.quality} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-span-12 md:col-span-8 space-y-3">
                {qualityBefore && qualityAfter && lastCleanResult ? (
                  <QualityComparePanel before={qualityBefore} after={qualityAfter} />
                ) : (
                  <>
                    <div className="glass-panel p-4">
                      <div className="text-xs font-mono text-cockpit-cyan uppercase tracking-wider mb-3">
                        📊 扫描概览
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold font-mono text-cockpit-cyan">
                            {qualityReport.total_rows}
                          </div>
                          <div className="text-xs text-cockpit-muted">扫描行数</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold font-mono text-cockpit-warning">
                            {qualityReport.total_issues}
                          </div>
                          <div className="text-xs text-cockpit-muted">问题类别</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold font-mono text-cockpit-danger">
                            {qualityReport.total_affected_rows}
                          </div>
                          <div className="text-xs text-cockpit-muted">影响行数</div>
                        </div>
                      </div>
                    </div>
                    <div className="glass-panel p-4 border border-cockpit-cyan/20">
                      <div className="flex items-start gap-2">
                        <span className="text-xl">💡</span>
                        <div className="flex-1 text-sm text-cockpit-text">
                          <div className="font-medium mb-1">数据清洗建议</div>
                          <div className="text-cockpit-muted text-xs leading-relaxed">
                            下方表格中带三维发光边框的单元格存在数据质量问题。点击每条问题旁的
                            <span className="px-1 text-cockpit-cyan">查看详情</span>
                            可了解具体问题，点击
                            <span className="px-1 text-cockpit-primary">一键修正</span>
                            可自动处理并实时刷新分析结果。
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="glass-panel relative p-4">
              <span className="hud-corner tl" />
              <span className="hud-corner tr" />
              <span className="hud-corner bl" />
              <span className="hud-corner br" />
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">📋</span>
                <span className="font-mono text-sm text-cockpit-cyan uppercase tracking-wider">
                  三维标注数据预览
                </span>
              </div>
              <QualityAnnotatedTable result={result} />
            </div>

            <div className="glass-panel relative p-4">
              <span className="hud-corner tl" />
              <span className="hud-corner tr" />
              <span className="hud-corner bl" />
              <span className="hud-corner br" />
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">⚠️</span>
                <span className="font-mono text-sm text-cockpit-cyan uppercase tracking-wider">
                  问题清单与快速修复
                </span>
              </div>
              <IssueList report={qualityReport} result={result} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center text-cockpit-muted">
      <div className="text-center">
        <div className="text-6xl mb-4 opacity-30">🛰️</div>
        <div>{text}</div>
      </div>
    </div>
  )
}
