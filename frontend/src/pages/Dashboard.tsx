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
import InsightList from '../components/dashboard/InsightList'
import IndustryMetricsPanel from '../components/dashboard/IndustryMetricsPanel'

export default function Dashboard() {
  const result = useAnalysisStore((s) => s.result)
  const activeChart = useAnalysisStore((s) => s.activeChart)
  const reset = useAnalysisStore((s) => s.reset)
  const selectedOutlierStory = useAnalysisStore((s) => s.selectedOutlierStory)
  const setSelectedOutlierStory = useAnalysisStore((s) => s.setSelectedOutlierStory)
  const navigate = useNavigate()
  const [exporting, setExporting] = useState(false)

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
        <SummaryCards />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-2">
          <ChartNav charts={availableCharts} />
          <div className="mt-4">
            <InsightList />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-7">
          <div className="glass-panel relative h-[680px] p-4">
            <span className="hud-corner tl" />
            <span className="hud-corner tr" />
            <span className="hud-corner bl" />
            <span className="hud-corner br" />
            <div className="absolute top-3 left-4 text-xs font-mono text-cockpit-muted z-10">
              <span className="text-cockpit-cyan">⟡</span> MAIN VIEWPORT ·{' '}
              {availableCharts.find((c) => c.id === activeChart)?.label || 'IDLE'}
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
