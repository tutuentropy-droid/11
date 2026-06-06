import { useEffect, useRef, useMemo, useState } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'
import { useAnalysisStore } from '../../store/analysisStore'

export default function Scatter3D() {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const result = useAnalysisStore((s) => s.result)
  const setSelectedPoint = useAnalysisStore((s) => s.setSelectedPoint)
  const setSelectedOutlierStory = useAnalysisStore((s) => s.setSelectedOutlierStory)
  const animRef = useRef<number | null>(null)
  const [autoRotate, setAutoRotate] = useState(true)

  const { normalData, outlierData, xCol, yCol, zCol, outlierIndices } = useMemo(() => {
    if (!result) return { normalData: [], outlierData: [], xCol: '', yCol: '', zCol: '', outlierIndices: new Set<number>() }
    const numericCols = result.columns.filter((c) => c.type === 'numeric').map((c) => c.name)
    const outlierCols = result.columns.filter((c) => c.outliers.length > 0 && c.type === 'numeric')
    const cols = numericCols.length >= 3 ? numericCols.slice(0, 3) : numericCols
    if (cols.length < 2) return { normalData: [], outlierData: [], xCol: '', yCol: '', zCol: '', outlierIndices: new Set<number>() }

    const xC = cols[0]
    const yC = cols[1]
    const zC = cols[2] || cols[0]

    const outSet = new Set<number>()
    outlierCols.forEach((c) => c.outliers.forEach((i) => outSet.add(i)))

    const normal: number[][] = []
    const outlier: number[][] = []
    const data = result.sampled_data || []
    data.forEach((row, idx) => {
      const x = Number(row[xC])
      const y = Number(row[yC])
      const z = Number(row[zC])
      if (isNaN(x) || isNaN(y) || isNaN(z)) return
      const point = [x, y, z, idx]
      if (outSet.has(idx)) {
        outlier.push(point as any)
      } else {
        normal.push(point as any)
      }
    })
    return { normalData: normal, outlierData: outlier, xCol: xC, yCol: yC, zCol: zC, outlierIndices: outSet }
  }, [result])

  useEffect(() => {
    if (!ref.current) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    }
    const chart = chartRef.current

    if (normalData.length === 0 && outlierData.length === 0) {
      chart.setOption({
        backgroundColor: 'transparent',
        title: {
          text: '数据不足，无法绘制 3D 散点图',
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
      const opacity = 0.7 + Math.sin(tick / 12) * 0.3
      const size = 18 + Math.sin(tick / 10) * 6
      chart.setOption({
        series: [
          {
            type: 'scatter3D',
            name: '正常数据',
            data: normalData,
            symbolSize: 8,
            itemStyle: {
              color: '#3b82f6',
              opacity: 0.7,
            },
            emphasis: { itemStyle: { color: '#06b6d4', opacity: 1 } },
          },
          {
            type: 'scatter3D',
            name: '异常点',
            data: outlierData,
            symbolSize: size,
            itemStyle: {
              color: '#ef4444',
              opacity,
              shadowBlur: 20,
              shadowColor: '#ef4444',
            },
            emphasis: { itemStyle: { color: '#fff' } },
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
          const d = p.data
          const isOutlier = p.seriesName === '异常点'
          const row = result?.sampled_data?.[d[3]]
          let html = `<div style="font-family:monospace;font-size:12px">`
          html += isOutlier
            ? `<div style="color:#ef4444;margin-bottom:6px">🚨 异常数据点 #${d[3]}</div>`
            : `<div style="color:#3b82f6;margin-bottom:6px">数据点 #${d[3]}</div>`
          html += `<div>${xCol}: <b style="color:#06b6d4">${Number(d[0]).toLocaleString()}</b></div>`
          html += `<div>${yCol}: <b style="color:#06b6d4">${Number(d[1]).toLocaleString()}</b></div>`
          html += `<div>${zCol}: <b style="color:#06b6d4">${Number(d[2]).toLocaleString()}</b></div>`
          if (row) {
            html += `<div style="color:#94a3b8;margin-top:6px;border-top:1px solid rgba(59,130,246,0.2);padding-top:6px">${isOutlier ? '点击查看异常故事卡片' : '点击查看全部字段'}</div>`
          }
          html += '</div>'
          return html
        },
      },
      legend: {
        data: ['正常数据', '异常点'],
        textStyle: { color: '#94a3b8' },
        top: 0,
        right: 10,
      },
      xAxis3D: {
        type: 'value',
        name: xCol,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      yAxis3D: {
        type: 'value',
        name: yCol,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      zAxis3D: {
        type: 'value',
        name: zCol,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      grid3D: {
        boxWidth: 180,
        boxDepth: 180,
        boxHeight: 120,
        viewControl: {
          autoRotate: autoRotate,
          autoRotateSpeed: 5,
          rotateSensitivity: 1.5,
          zoomSensitivity: 1.2,
        },
        light: {
          main: { intensity: 1.4, shadow: true },
          ambient: { intensity: 0.5 },
        },
        postEffect: {
          enable: true,
          bloom: { enable: true, bloomIntensity: 0.4 },
        },
        groundPlane: { show: false },
      },
      series: [],
    })

    animate()

    chart.on('click', (params: any) => {
      if (params.data && result) {
        const idx = params.data[3]
        const row = result.sampled_data?.[idx]
        if (row) {
          setSelectedPoint(row)
        }
        if (params.seriesName === '异常点' && result.outlier_stories) {
          const story = result.outlier_stories.find((s) => s.row_index === idx)
          if (story) {
            setSelectedOutlierStory(story)
          }
        }
      }
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [normalData, outlierData, xCol, yCol, zCol, result, setSelectedPoint, autoRotate])

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
