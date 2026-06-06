import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'
import { useAnalysisStore } from '../../store/analysisStore'

const PIE_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#14b8a6']

export default function Pie3D() {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const result = useAnalysisStore((s) => s.result)
  const setSelectedInsight = useAnalysisStore((s) => s.setSelectedInsight)

  const categories = result?.categorical_freq || []
  const [activeCol, setActiveCol] = useState(categories[0]?.column || '')
  const [autoRotate, setAutoRotate] = useState(true)

  useEffect(() => {
    if (!activeCol && categories.length > 0) {
      setActiveCol(categories[0].column)
    }
  }, [categories, activeCol])

  useEffect(() => {
    if (!ref.current) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    }
    const chart = chartRef.current

    const cat = categories.find((c) => c.column === activeCol)
    if (!cat || cat.values.length === 0) {
      chart.setOption({
        backgroundColor: 'transparent',
        title: {
          text: '无分类数据',
          left: 'center',
          top: 'center',
          textStyle: { color: '#94a3b8', fontSize: 14 },
        },
      })
      return
    }

    const pieData = cat.values.map((v, i) => ({
      name: v.name,
      value: v.count,
      percentage: v.percentage,
      itemStyle: {
        color: PIE_COLORS[i % PIE_COLORS.length],
      },
    }))

    function getParametricEquation(startRatio: number, endRatio: number, isSelected: boolean, isHovered: boolean, k: number, h: number) {
      const midRatio = (startRatio + endRatio) / 2
      const startRadian = startRatio * Math.PI * 2
      const endRadian = endRatio * Math.PI * 2
      const midRadian = midRatio * Math.PI * 2
      if (startRatio === 0 && endRatio === 1) {
        isSelected = false
      }
      k = typeof k !== 'undefined' ? k : 1 / 3
      const offsetX = isSelected ? Math.cos(midRadian) * 0.1 : 0
      const offsetY = isSelected ? Math.sin(midRadian) * 0.1 : 0
      const hoverRate = isHovered ? 1.05 : 1
      return {
        u: { min: -Math.PI, max: Math.PI * 3, step: Math.PI / 32 },
        v: { min: 0, max: Math.PI * 2, step: Math.PI / 20 },
        x: function (u: number, v: number) {
          if (u < startRadian) return offsetX + Math.cos(startRadian) * (1 + Math.cos(v) * k) * hoverRate
          if (u > endRadian) return offsetX + Math.cos(endRadian) * (1 + Math.cos(v) * k) * hoverRate
          return offsetX + Math.cos(u) * (1 + Math.cos(v) * k) * hoverRate
        },
        y: function (u: number, v: number) {
          if (u < startRadian) return offsetY + Math.sin(startRadian) * (1 + Math.cos(v) * k) * hoverRate
          if (u > endRadian) return offsetY + Math.sin(endRadian) * (1 + Math.cos(v) * k) * hoverRate
          return offsetY + Math.sin(u) * (1 + Math.cos(v) * k) * hoverRate
        },
        z: function (u: number, v: number) {
          if (u < -Math.PI * 0.5) return Math.sin(u)
          if (u > Math.PI * 2.5) return Math.sin(u) * h
          return Math.sin(v) > 0 ? 1 * h : -1
        },
      }
    }

    const total = pieData.reduce((a, b) => a + b.value, 0)
    let startRatio = 0
    const series: any[] = pieData.map((d, idx) => {
      const endRatio = startRatio + d.value / total
      const h = 0.4 + (idx / pieData.length) * 0.5
      const seriesItem = {
        name: d.name,
        type: 'surface',
        parametric: true,
        wireframe: { show: false },
        pieData: d,
        pieStatus: { selected: false, hovered: false, k: 0.15 },
        itemStyle: {
          color: d.itemStyle.color,
          opacity: 0.9,
        },
        parametricEquation: getParametricEquation(startRatio, endRatio, false, false, 0.15, h),
      }
      startRatio = endRatio
      return seriesItem
    })

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(59,130,246,0.3)',
        textStyle: { color: '#e2e8f0' },
        formatter: (p: any) => {
          const d = p.series?.[0]?.pieData
          if (!d) return ''
          return `
            <div style="font-family:monospace;font-size:12px">
              <div style="color:${d.itemStyle.color};margin-bottom:4px">${d.name}</div>
              <div>数量: <b style="color:#06b6d4">${d.value.toLocaleString()}</b></div>
              <div>占比: <b style="color:#a78bfa">${d.percentage}%</b></div>
            </div>
          `
        },
      },
      legend: {
        show: true,
        type: 'scroll',
        orient: 'vertical',
        right: 10,
        top: 40,
        bottom: 40,
        textStyle: { color: '#94a3b8', fontSize: 11 },
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 8,
        data: pieData.map((d) => ({
          name: d.name,
          itemStyle: { color: d.itemStyle.color },
        })),
        formatter: (name: string) => {
          const item = pieData.find((p) => p.name === name)
          if (!item) return name
          const displayName = name.length > 10 ? name.slice(0, 10) + '…' : name
          return `${displayName}  ${item.percentage}%`
        },
      },
      xAxis3D: { min: -1, max: 1, axisLabel: { show: false }, axisLine: { show: false }, splitLine: { show: false } },
      yAxis3D: { min: -1, max: 1, axisLabel: { show: false }, axisLine: { show: false }, splitLine: { show: false } },
      zAxis3D: { min: -1, max: 1, axisLabel: { show: false }, axisLine: { show: false }, splitLine: { show: false } },
      grid3D: {
        show: false,
        boxHeight: 20,
        viewControl: {
          autoRotate: autoRotate,
          autoRotateSpeed: 8,
          distance: 160,
          alpha: 35,
          beta: 30,
        },
        light: {
          main: { intensity: 1.4, shadow: true },
          ambient: { intensity: 0.5 },
        },
        postEffect: {
          enable: true,
          bloom: { enable: true, bloomIntensity: 0.3 },
        },
      },
      series,
    })

    chart.on('click', (params: any) => {
      const d = params.series?.[0]?.pieData
      if (d) {
        setSelectedInsight({
          severity: 'low',
          text: `'${activeCol}' 中 '${d.name}' 占比 ${d.percentage}%（${d.value} 条）`,
          viz: 'pie',
          details: { column: activeCol, category: d.name, count: d.value, percentage: d.percentage },
        })
      }
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [activeCol, categories, setSelectedInsight, autoRotate])

  if (categories.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-cockpit-muted">
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-30">🥧</div>
          <div>无分类字段可展示</div>
        </div>
      </div>
    )
  }

  const activeCat = categories.find((c) => c.column === activeCol)

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-2 pb-2 z-10">
        {categories.map((c) => (
          <button
            key={c.column}
            onClick={() => setActiveCol(c.column)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
              activeCol === c.column
                ? 'bg-gradient-to-r from-cockpit-primary/30 to-cockpit-purple/30 text-white border border-cockpit-primary/40'
                : 'bg-cockpit-panel/50 text-cockpit-muted border border-cockpit-border hover:text-cockpit-text'
            }`}
          >
            {c.column}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all border ${
            autoRotate
              ? 'bg-cockpit-primary/20 text-cockpit-cyan border-cockpit-primary/40'
              : 'bg-cockpit-panel/50 text-cockpit-muted border-cockpit-border hover:text-cockpit-text'
          }`}
          title={autoRotate ? '点击停止自动旋转' : '点击开启自动旋转'}
        >
          {autoRotate ? '⏸ 停止旋转' : '▶ 自动旋转'}
        </button>
      </div>
      {activeCat && activeCat.values.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {activeCat.values.slice(0, 8).map((v, i) => (
            <div key={v.name} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
              />
              <span className="text-cockpit-muted truncate max-w-[120px]" title={v.name}>{v.name}</span>
              <span className="text-cockpit-cyan font-mono">{v.percentage}%</span>
              <span className="text-cockpit-muted/60">({v.count.toLocaleString()})</span>
            </div>
          ))}
        </div>
      )}
      <div ref={ref} className="flex-1" />
    </div>
  )
}
