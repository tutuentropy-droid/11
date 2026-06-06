import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'
import { useAnalysisStore } from '../../store/analysisStore'

export default function CompareNumeric3D() {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const compareResult = useAnalysisStore((s) => s.compareResult)
  const [autoRotate, setAutoRotate] = useState(true)

  useEffect(() => {
    if (!ref.current || !compareResult) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    }
    const chart = chartRef.current
    const numericDiffs = compareResult.numeric_diffs || []
    if (numericDiffs.length === 0) return

    const cols = numericDiffs.map((d) => d.column)
    const data: any[][] = []
    const highlights: Set<string> = new Set()

    numericDiffs.forEach((d, colIdx) => {
      const meanA = d.mean_a ?? 0
      const meanB = d.mean_b ?? 0
      data.push([0, colIdx, meanA, d.column, 'A'])
      data.push([1, colIdx, meanB, d.column, 'B'])
      if (d.mean_change_pct !== undefined && Math.abs(d.mean_change_pct) >= 10) {
        highlights.add(`${d.column}`)
      }
    })

    const maxVal = Math.max(...data.map((d) => d[2])) * 1.15

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(59,130,246,0.3)',
        textStyle: { color: '#e2e8f0' },
        formatter: (p: any) => {
          const [x, y, z, col, side] = p.data
          const diff = numericDiffs[y]
          const label = side === 'A' ? compareResult.label_a : compareResult.label_b
          const color = side === 'A' ? '#06b6d4' : '#a78bfa'
          let html = `<div style="font-family:monospace;font-size:12px">`
          html += `<div style="color:${color};margin-bottom:6px">${col} · ${label}</div>`
          html += `<div>均值: <b style="color:${color}">${Number(z).toLocaleString()}</b></div>`
          if (diff.mean_change_pct !== undefined) {
            const c = diff.mean_change_pct >= 0 ? '#22c55e' : '#ef4444'
            const sign = diff.mean_change_pct >= 0 ? '+' : ''
            html += `<div style="margin-top:4px;color:${c}">B vs A: <b>${sign}${diff.mean_change_pct.toFixed(1)}%</b></div>`
          }
          if (highlights.has(col)) {
            html += `<div style="margin-top:4px;color:#f59e0b">🚨 显著变化</div>`
          }
          html += '</div>'
          return html
        },
      },
      xAxis3D: {
        type: 'category',
        data: [compareResult.label_a, compareResult.label_b],
        name: '',
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      yAxis3D: {
        type: 'category',
        data: cols,
        name: '',
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          rotate: 20,
          formatter: (v: string) => {
            if (highlights.has(v)) return `★ ${v}`
            return v
          },
        },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      zAxis3D: {
        type: 'value',
        min: 0,
        max: maxVal,
        name: '均值',
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      grid3D: {
        boxWidth: 120,
        boxDepth: 180,
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
          bloom: { enable: true, bloomIntensity: 0.3 },
          SSAO: { enable: true, quality: 'medium', radius: 2 },
        },
        groundPlane: { show: false },
      },
      series: [
        {
          type: 'bar3D',
          data: data.map((d) => ({
            value: [d[0], d[1], d[2]],
            itemStyle: {
              color:
                d[4] === 'A'
                  ? highlights.has(d[3])
                    ? '#0891b2'
                    : '#06b6d4'
                  : highlights.has(d[3])
                  ? '#7c3aed'
                  : '#a78bfa',
              opacity: highlights.has(d[3]) ? 1 : 0.85,
              shadowBlur: highlights.has(d[3]) ? 20 : 8,
              shadowColor: highlights.has(d[3])
                ? d[4] === 'A'
                  ? '#06b6d4'
                  : '#a78bfa'
                : 'transparent',
            },
          })),
          barSize: 20,
          shading: 'lambert',
          minHeight: 0.02,
          emphasis: {
            itemStyle: { color: '#fff' },
          },
        },
      ],
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [compareResult, autoRotate])

  if (!compareResult || (compareResult.numeric_diffs || []).length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-cockpit-muted">
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-30">📊</div>
          <div>无可对比的数值列</div>
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
