import { useEffect, useRef, useMemo, useState } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'
import { useAnalysisStore } from '../../store/analysisStore'

export default function CompareTimeseries3D() {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const compareResult = useAnalysisStore((s) => s.compareResult)
  const compareViewMode = useAnalysisStore((s) => s.compareViewMode)
  const animRef = useRef<number | null>(null)
  const [autoRotate, setAutoRotate] = useState(true)

  const tsDiff = useMemo(() => compareResult?.timeseries_diff, [compareResult])

  useEffect(() => {
    if (!ref.current || !tsDiff) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    }
    const chart = chartRef.current
    const points = tsDiff.aligned_points
    if (points.length === 0) return

    const valuesA = points.map((p) => p.value_a ?? 0)
    const valuesB = points.map((p) => p.value_b ?? 0)
    const allValues = [...valuesA, ...valuesB]
    const minV = Math.min(...allValues) * 0.9
    const maxV = Math.max(...allValues) * 1.1
    const n = points.length

    const highlightedIndices: number[] = []
    points.forEach((p, i) => {
      if (p.diff_pct !== undefined && Math.abs(p.diff_pct) >= 20) {
        highlightedIndices.push(i)
      }
    })

    const surfaceA: number[][] = []
    const surfaceB: number[][] = []
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 5; j++) {
        const waveA = Math.sin((i / n) * Math.PI * 4 + j / 2) * (maxV - minV) * 0.015
        const waveB = Math.sin((i / n) * Math.PI * 4 + j / 2 + 0.5) * (maxV - minV) * 0.015
        if (compareViewMode === 'sidebyside') {
          surfaceA.push([i, j, valuesA[i] + waveA])
          surfaceB.push([i, j + 6, valuesB[i] + waveB])
        } else {
          surfaceA.push([i, j, valuesA[i] + waveA])
          surfaceB.push([i, j + 0.5, valuesB[i] + waveB])
        }
      }
    }

    const lineA = points.map((p, i) =>
      compareViewMode === 'sidebyside' ? [i, 2, p.value_a ?? 0] : [i, 2, p.value_a ?? 0],
    )
    const lineB = points.map((p, i) =>
      compareViewMode === 'sidebyside' ? [i, 8, p.value_b ?? 0] : [i, 3.5, p.value_b ?? 0],
    )

    const highlightPointsA = highlightedIndices.map((i) => [
      ...lineA[i],
      i,
      'A',
      points[i].diff_pct,
    ])
    const highlightPointsB = highlightedIndices.map((i) => [
      ...lineB[i],
      i,
      'B',
      points[i].diff_pct,
    ])

    let tick = 0
    const animate = () => {
      tick++
      const glowA = 8 + Math.sin(tick / 15) * 4
      const glowB = 8 + Math.sin(tick / 15 + 1) * 4
      const hlOpacity = 0.75 + Math.sin(tick / 8) * 0.25
      const hlSize = 20 + Math.sin(tick / 6) * 6

      const series: any[] = [
        {
          name: `${compareResult?.label_a || 'A'} 曲面`,
          type: 'surface',
          data: surfaceA,
          wireframe: { show: false },
          itemStyle: { opacity: 0.35, color: '#06b6d4' },
          shading: 'color',
        },
        {
          name: `${compareResult?.label_b || 'B'} 曲面`,
          type: 'surface',
          data: surfaceB,
          wireframe: { show: false },
          itemStyle: { opacity: 0.35, color: '#a78bfa' },
          shading: 'color',
        },
        {
          name: compareResult?.label_a || '数据集 A',
          type: 'line3D',
          data: lineA,
          lineStyle: {
            color: '#06b6d4',
            width: 4,
            opacity: 1,
            shadowBlur: glowA,
            shadowColor: '#06b6d4',
          },
        },
        {
          name: compareResult?.label_b || '数据集 B',
          type: 'line3D',
          data: lineB,
          lineStyle: {
            color: '#a78bfa',
            width: 4,
            opacity: 1,
            shadowBlur: glowB,
            shadowColor: '#a78bfa',
          },
        },
      ]

      if (highlightedIndices.length > 0) {
        series.push({
          type: 'scatter3D',
          name: `${compareResult?.label_a || 'A'} 关键变化`,
          data: highlightPointsA,
          symbolSize: hlSize,
          itemStyle: {
            color: '#ef4444',
            opacity: hlOpacity,
            shadowBlur: 25,
            shadowColor: '#ef4444',
          },
        })
        series.push({
          type: 'scatter3D',
          name: `${compareResult?.label_b || 'B'} 关键变化`,
          data: highlightPointsB,
          symbolSize: hlSize,
          itemStyle: {
            color: '#f59e0b',
            opacity: hlOpacity,
            shadowBlur: 25,
            shadowColor: '#f59e0b',
          },
        })
      }

      chart.setOption({ series })
      animRef.current = requestAnimationFrame(animate)
    }

    const tickStep = Math.max(1, Math.floor(n / 8))
    const xLabels: string[] = []
    for (let i = 0; i < n; i += tickStep) xLabels.push(points[i].time.slice(0, 10))

    const yMax = compareViewMode === 'sidebyside' ? 12 : 7

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(59,130,246,0.3)',
        textStyle: { color: '#e2e8f0' },
        hideDelay: 10000,
        enterable: true,
        triggerOn: 'mousemove|click',
        extraCssText: 'box-shadow: 0 4px 20px rgba(0,0,0,0.5);',
        formatter: (p: any) => {
          const idx = Math.round(p.data?.[0] ?? p.data?.[3] ?? 0)
          if (idx < 0 || idx >= points.length) return ''
          const pt = points[idx]
          const labelA = compareResult?.label_a || '数据集 A'
          const labelB = compareResult?.label_b || '数据集 B'
          const isHighlightA = p.seriesName?.includes('关键变化') && p.seriesName?.includes(labelA)
          const isHighlightB = p.seriesName?.includes('关键变化') && p.seriesName?.includes(labelB)
          const isHighlight = isHighlightA || isHighlightB
          const isSurface = p.seriesName?.includes('曲面')

          let html = `<div style="font-family:monospace;font-size:12px;min-width:200px">`
          if (isHighlight) {
            const hlColor = isHighlightA ? '#ef4444' : '#f59e0b'
            html += `<div style="color:${hlColor};margin-bottom:8px;font-weight:bold">🚨 关键变化点 · ${isHighlightA ? labelA : labelB}</div>`
          } else if (isSurface) {
            html += `<div style="color:#94a3b8;margin-bottom:8px">🌊 曲面数据</div>`
          } else {
            html += `<div style="color:#06b6d4;margin-bottom:8px;font-weight:bold">📊 时序对比数据</div>`
          }
          html += `<div style="color:#e2e8f0;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(59,130,246,0.2)">⏰ ${pt.time}</div>`
          html += `<div style="margin-top:6px;color:#06b6d4">● ${labelA}: <b style="color:#e2e8f0">${Number(pt.value_a).toLocaleString()}</b></div>`
          html += `<div style="color:#a78bfa">● ${labelB}: <b style="color:#e2e8f0">${Number(pt.value_b).toLocaleString()}</b></div>`
          if (pt.diff !== undefined) {
            const sign = pt.diff >= 0 ? '+' : ''
            html += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(59,130,246,0.15)">差值 (B - A): <b style="color:#e2e8f0">${sign}${Number(pt.diff).toLocaleString()}</b></div>`
          }
          if (pt.diff_pct !== undefined) {
            const color = pt.diff_pct >= 0 ? '#22c55e' : '#ef4444'
            const sign = pt.diff_pct >= 0 ? '↑' : '↓'
            html += `<div style="color:${color}">变化率: <b>${sign} ${Math.abs(pt.diff_pct).toFixed(2)}%</b></div>`
            if (Math.abs(pt.diff_pct) >= 20) {
              html += `<div style="color:#f59e0b;margin-top:4px">⚠ 显著变化 (≥20%)</div>`
            }
          }
          if (!isHighlight && !isSurface) {
            html += `<div style="color:#64748b;margin-top:8px;padding-top:6px;border-top:1px solid rgba(59,130,246,0.15);font-size:11px">💡 点击可锁定此提示框</div>`
          }
          html += '</div>'
          return html
        },
      },
      legend: {
        data: [
          { name: compareResult?.label_a || '数据集 A', itemStyle: { color: '#06b6d4' } },
          { name: compareResult?.label_b || '数据集 B', itemStyle: { color: '#a78bfa' } },
          ...(highlightedIndices.length > 0 ? [
            { name: `${compareResult?.label_a || 'A'} 关键变化`, itemStyle: { color: '#ef4444' } },
            { name: `${compareResult?.label_b || 'B'} 关键变化`, itemStyle: { color: '#f59e0b' } },
          ] : []),
        ],
        textStyle: { color: '#94a3b8' },
        top: 0,
        right: 10,
        itemWidth: 14,
        itemHeight: 10,
        itemGap: 10,
      },
      visualMap: {
        show: false,
      },
      xAxis3D: {
        type: 'value',
        min: 0,
        max: n,
        name: tsDiff.time_column,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 9,
          formatter: (v: number) => {
            const i = Math.round(v)
            if (i >= 0 && i < n && i % tickStep === 0) {
              return points[i].time.slice(5, 10)
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
        max: yMax,
        name: compareViewMode === 'sidebyside' ? 'A / B 通道' : '',
        nameTextStyle: { color: '#94a3b8', fontSize: 10 },
        axisLabel: { show: false },
        axisLine: { show: false },
        splitLine: { show: false },
      },
      zAxis3D: {
        type: 'value',
        min: minV,
        max: maxV,
        name: tsDiff.value_column,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      grid3D: {
        boxWidth: 200,
        boxDepth: compareViewMode === 'sidebyside' ? 120 : 60,
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

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [tsDiff, compareViewMode, compareResult?.label_a, compareResult?.label_b, autoRotate])

  if (!tsDiff) {
    return (
      <div className="w-full h-full flex items-center justify-center text-cockpit-muted">
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-30">📈</div>
          <div>未检测到可对齐的时间序列</div>
        </div>
      </div>
    )
  }

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
