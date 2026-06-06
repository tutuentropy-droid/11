import { useEffect, useRef, useMemo, useState } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'
import { useAnalysisStore } from '../../store/analysisStore'

export default function Timeseries3D() {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const result = useAnalysisStore((s) => s.result)
  const setSelectedOutlierStory = useAnalysisStore((s) => s.setSelectedOutlierStory)
  const animRef = useRef<number | null>(null)
  const [autoRotate, setAutoRotate] = useState(true)

  const tsData = useMemo(() => {
    const ts = result?.timeseries
    if (!ts) return null
    return ts
  }, [result])

  const tsOutlierMap = useMemo(() => {
    const map = new Map<number, any>()
    if (!result?.outlier_stories || !tsData) return map
    const stories = result.outlier_stories.filter((s) => s.column === tsData.value_column)
    const sampled = result.sampled_data || []
    const timeCol = tsData.time_column

    for (let i = 0; i < tsData.data_points.length; i++) {
      const point = tsData.data_points[i]
      const t = point.time
      for (const story of stories) {
        const row = sampled[story.row_index]
        if (row && row[timeCol] && String(row[timeCol]).startsWith(String(t).slice(0, 10))) {
          map.set(i, story)
          break
        }
      }
    }
    return map
  }, [result, tsData])

  useEffect(() => {
    if (!ref.current || !tsData) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    }
    const chart = chartRef.current

    const points = tsData.data_points
    const trend = tsData.trend
    const forecast = tsData.forecast
    const forecastTimes = forecast?.times || []

    const allTimes = points.map((p) => p.time)
    const values = points.map((p) => p.value)
    const minV = Math.min(...values)
    const maxV = Math.max(...values)

    const outlierIndices = Array.from(tsOutlierMap.keys())
    const outlierPoints: number[][] = outlierIndices.map((i) => [i, 3.5, points[i].value, i])

    const surfaceData: number[][] = []
    const n = points.length
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 8; j++) {
        const base = values[i]
        const wave = Math.sin((i / n) * Math.PI * 4 + j / 2) * (maxV - minV) * 0.02
        surfaceData.push([i, j, base + wave])
      }
    }

    let tick = 0
    const animate = () => {
      tick++
      const glow = 8 + Math.sin(tick / 15) * 4
      const outlierOpacity = 0.5 + Math.sin(tick / 10) * 0.5
      const outlierSize = 18 + Math.sin(tick / 8) * 6
      chart.setOption({
        series: [
          {
            name: '历史曲面',
            type: 'surface',
            data: surfaceData,
            wireframe: { show: false },
            itemStyle: {
              opacity: 0.45,
            },
            shading: 'color',
          },
          {
            name: '历史数据',
            type: 'line3D',
            data: points.map((p, i) => [i, 3.5, p.value]),
            lineStyle: {
              color: '#06b6d4',
              width: 4,
              opacity: 1,
              shadowBlur: glow,
              shadowColor: '#06b6d4',
            },
          },
          {
            name: '趋势线',
            type: 'line3D',
            data: trend.map((p, i) => [i, 3.5, p.value]),
            lineStyle: {
              color: '#a78bfa',
              width: 3,
              type: 'dashed',
              opacity: 0.8,
              shadowBlur: 6,
              shadowColor: '#a78bfa',
            },
          },
          ...(outlierPoints.length > 0
            ? [
                {
                  type: 'scatter3D',
                  name: '时序异常点',
                  data: outlierPoints,
                  symbolSize: outlierSize,
                  itemStyle: {
                    color: '#ef4444',
                    opacity: outlierOpacity,
                    shadowBlur: 25,
                    shadowColor: '#ef4444',
                  },
                  emphasis: { itemStyle: { color: '#fff' } },
                },
              ]
            : []),
          ...(forecast && forecast.values && forecast.values.length > 0
            ? [
                {
                  name: '预测线',
                  type: 'line3D',
                  data: forecast.values.map((v, i) => [n + i, 3.5, v]),
                  lineStyle: {
                    color: '#f59e0b',
                    width: 3,
                    type: 'dashed',
                    opacity: 0.9,
                    shadowBlur: glow,
                    shadowColor: '#f59e0b',
                  },
                },
                ...(forecast.upper && forecast.lower
                  ? [
                      {
                        name: '置信区间',
                        type: 'line3D',
                        data: forecast.upper.map((v, i) => [n + i, 3.5, v]),
                        lineStyle: { color: 'rgba(245,158,11,0.5)', width: 1, type: 'dashed' },
                      },
                      {
                        name: '置信下界',
                        type: 'line3D',
                        data: forecast.lower.map((v, i) => [n + i, 3.5, v]),
                        lineStyle: { color: 'rgba(245,158,11,0.5)', width: 1, type: 'dashed' },
                      },
                    ]
                  : []),
              ]
            : []),
        ],
      })
      animRef.current = requestAnimationFrame(animate)
    }

    const tickStep = Math.max(1, Math.floor(points.length / 8))
    const xLabels: string[] = []
    for (let i = 0; i < points.length; i += tickStep) xLabels.push(points[i].time.slice(0, 10))

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(59,130,246,0.3)',
        textStyle: { color: '#e2e8f0' },
        formatter: (p: any) => {
          const idx = Math.round(p.data?.[0] ?? p.data?.[3] ?? 0)
          if (p.seriesName === '时序异常点') {
            const story = tsOutlierMap.get(p.data[3])
            const t = points[p.data[3]]?.time || ''
            const v = points[p.data[3]]?.value
            let html = `<div style="font-family:monospace;font-size:12px">`
            html += `<div style="color:#ef4444;margin-bottom:6px">🚨 时序异常点</div>`
            html += `<div>${t.slice(0, 16)}</div>`
            html += `<div>${tsData.value_column}: <b style="color:#ef4444">${Number(v).toLocaleString()}</b></div>`
            if (story) {
              html += `<div style="margin-top:6px;border-top:1px solid rgba(239,68,68,0.2);padding-top:6px;color:#e2e8f0">${story.story.slice(0, 40)}...</div>`
              html += `<div style="color:#94a3b8;margin-top:4px">点击查看完整故事卡片</div>`
            }
            html += '</div>'
            return html
          }
          if (p.seriesName === '预测线' && forecast) {
            const fIdx = idx - points.length
            const t = forecastTimes[fIdx] || points[points.length - 1]?.time
            return `
              <div style="font-family:monospace;font-size:12px">
                <div style="color:#f59e0b;margin-bottom:4px">📡 预测值</div>
                <div>${t ? t.slice(0, 16) : ''}</div>
                <div>预测: <b style="color:#f59e0b">${Number(p.data[2]).toLocaleString()}</b></div>
                ${forecast.upper && forecast.lower ? `<div style="color:#94a3b8">置信区间: ${Number(forecast.lower[fIdx]).toFixed(0)} ~ ${Number(forecast.upper[fIdx]).toFixed(0)}</div>` : ''}
              </div>
            `
          }
          const t = points[idx]?.time || ''
          const v = points[idx]?.value
          return `
            <div style="font-family:monospace;font-size:12px">
              <div style="color:#06b6d4;margin-bottom:4px">📈 历史数据</div>
              <div>${t.slice(0, 16)}</div>
              <div>${tsData.value_column}: <b style="color:#06b6d4">${Number(v ?? p.data[2]).toLocaleString()}</b></div>
            </div>
          `
        },
      },
      legend: {
        data: ['历史数据', '趋势线', '时序异常点', '预测线'].filter((n) => {
          if (n === '预测线') return forecast && forecast.values && forecast.values.length > 0
          if (n === '时序异常点') return outlierPoints.length > 0
          return true
        }),
        textStyle: { color: '#94a3b8' },
        top: 0,
        right: 10,
      },
      visualMap: {
        show: false,
        dimension: 2,
        min: minV,
        max: maxV,
        inRange: {
          color: ['#1e293b', '#3b82f6', '#06b6d4', '#a78bfa'],
        },
      },
      xAxis3D: {
        type: 'value',
        min: 0,
        max: (forecast?.values?.length || 0) + points.length,
        name: tsData.time_column,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 9,
          formatter: (v: number) => {
            const i = Math.round(v)
            if (i < points.length && i % tickStep === 0) {
              return points[i].time.slice(5, 10)
            }
            if (i >= points.length && forecastTimes) {
              const fi = i - points.length
              return forecastTimes[fi]?.slice(5, 10) || ''
            }
            return ''
          },
        },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      yAxis3D: {
        type: 'value',
        min: 0,
        max: 7,
        name: '',
        axisLabel: { show: false },
        axisLine: { show: false },
        splitLine: { show: false },
      },
      zAxis3D: {
        type: 'value',
        name: tsData.value_column,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      grid3D: {
        boxWidth: 200,
        boxDepth: 50,
        boxHeight: 120,
        viewControl: {
          autoRotate: autoRotate,
          autoRotateSpeed: 4,
          rotateSensitivity: 1.5,
          zoomSensitivity: 1.2,
        },
        light: {
          main: { intensity: 1.4, shadow: true },
          ambient: { intensity: 0.6 },
        },
        postEffect: {
          enable: true,
          bloom: { enable: true, bloomIntensity: 0.5 },
          SSAO: { enable: true, quality: 'medium', radius: 2 },
        },
        groundPlane: { show: false },
      },
      series: [],
    })

    animate()

    chart.on('click', (params: any) => {
      if (params.seriesName === '时序异常点' && params.data) {
        const idx = params.data[3]
        const story = tsOutlierMap.get(idx)
        if (story) {
          setSelectedOutlierStory(story)
        }
      }
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [tsData, tsOutlierMap, setSelectedOutlierStory, autoRotate])

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
