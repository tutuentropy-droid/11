import { useEffect, useRef, useMemo, useState } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'
import { useAnalysisStore } from '../../store/analysisStore'

export default function Histogram3D() {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const result = useAnalysisStore((s) => s.result)
  const animRef = useRef<number | null>(null)
  const [autoRotate, setAutoRotate] = useState(true)

  const histogramData = useMemo(() => {
    if (!result) return { data: [] as any[], xCol: '', bins: 0 }
    const numCol = result.columns.find((c) => c.type === 'numeric')
    if (!numCol || !result.sampled_data) return { data: [], xCol: '', bins: 0 }

    const values = result.sampled_data
      .map((r) => Number(r[numCol.name]))
      .filter((v) => !isNaN(v) && isFinite(v))

    if (values.length === 0) return { data: [], xCol: '', bins: 0 }

    const min = Math.min(...values)
    const max = Math.max(...values)
    const bins = Math.min(20, Math.ceil(Math.sqrt(values.length)) || 10)
    const step = (max - min) / bins || 1

    const counts = new Array(bins).fill(0)
    const outlierCounts = new Array(bins).fill(0)
    const outlierSet = new Set(numCol.outliers.map((i) => result.sampled_data![i]?.[numCol.name]))

    values.forEach((v) => {
      let bin = Math.floor((v - min) / step)
      if (bin >= bins) bin = bins - 1
      if (bin < 0) bin = 0
      counts[bin]++
      if (outlierSet.has(v)) outlierCounts[bin]++
    })

    const data: any[] = []
    for (let i = 0; i < bins; i++) {
      const binCenter = min + (i + 0.5) * step
      const isOutlierBin = outlierCounts[i] > 0
      data.push([i, 0, counts[i], binCenter, isOutlierBin])
    }
    return { data, xCol: numCol.name, bins }
  }, [result])

  useEffect(() => {
    if (!ref.current) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    }
    const chart = chartRef.current

    if (histogramData.data.length === 0) {
      chart.setOption({
        backgroundColor: 'transparent',
        title: {
          text: '无数值列可绘制分布',
          left: 'center',
          top: 'center',
          textStyle: { color: '#94a3b8', fontSize: 14 },
        },
      })
      return
    }

    let tick = 0
    const animate = () => {
      tick++
      const pulseOpacity = 0.75 + Math.sin(tick / 8) * 0.25
      const seriesData = histogramData.data.map((d) => ({
        value: [d[0], d[1], d[2]],
        itemStyle: d[4]
          ? {
              color: '#ef4444',
              opacity: pulseOpacity,
              shadowBlur: 16,
              shadowColor: '#ef4444',
            }
          : { color: '#06b6d4', opacity: 0.85 },
      }))

      chart.setOption({
        series: [
          {
            type: 'bar3D',
            data: seriesData,
            barSize: 22,
            shading: 'lambert',
            minHeight: 0.1,
            itemStyle: {
              borderWidth: 0.5,
              borderColor: 'rgba(255,255,255,0.15)',
            },
          },
        ],
      })
      animRef.current = requestAnimationFrame(animate)
    }

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(59,130,246,0.3)',
        textStyle: { color: '#e2e8f0' },
        hideDelay: 8000,
        enterable: true,
        triggerOn: 'mousemove|click',
        formatter: (p: any) => {
          const raw = histogramData.data[p.dataIndex]
          const binVal = Number(raw?.[3] || 0).toLocaleString()
          return `
            <div style="font-family:monospace;font-size:12px">
              <div style="color:#06b6d4;margin-bottom:4px">${histogramData.xCol}</div>
              <div>中心值: <b>${binVal}</b></div>
              <div>频数: <b style="color:#3b82f6">${p.data[2]}</b></div>
              ${raw?.[4] ? '<div style="color:#ef4444;margin-top:4px">🚨 包含异常值</div>' : ''}
            </div>
          `
        },
      },
      xAxis3D: {
        type: 'value',
        name: histogramData.xCol,
        min: 0,
        max: histogramData.bins,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 9,
          formatter: (_: any, i: number) => {
            const d = histogramData.data[i]
            return d ? Number(d[3]).toFixed(0) : ''
          },
          interval: Math.floor(histogramData.bins / 5),
        },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.1)' } },
      },
      yAxis3D: {
        type: 'category',
        data: ['频数'],
        name: '',
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { show: false },
      },
      zAxis3D: {
        type: 'value',
        name: '计数',
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.1)' } },
      },
      grid3D: {
        boxWidth: 180,
        boxDepth: 60,
        boxHeight: 120,
        viewControl: {
          autoRotate: autoRotate,
          autoRotateSpeed: 5,
          rotateSensitivity: 1.5,
          zoomSensitivity: 1.2,
        },
        light: {
          main: { intensity: 1.3, shadow: true },
          ambient: { intensity: 0.5 },
        },
        postEffect: {
          enable: true,
          bloom: { enable: true, bloomIntensity: 0.35 },
        },
        groundPlane: { show: false },
      },
      series: [],
    })

    animate()

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [histogramData, autoRotate])

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-end px-4 pt-2 pb-1 z-10">
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
      <div ref={ref} className="flex-1" />
    </div>
  )
}
