import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'
import { useAnalysisStore } from '../../store/analysisStore'

export default function CompareCorrelation3D() {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const compareResult = useAnalysisStore((s) => s.compareResult)
  const compareViewMode = useAnalysisStore((s) => s.compareViewMode)
  const [autoRotate, setAutoRotate] = useState(true)

  useEffect(() => {
    if (!ref.current || !compareResult) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    }
    const chart = chartRef.current

    const corrA = compareResult.dataset_a.correlations
    const corrB = compareResult.dataset_b.correlations

    if (!corrA || !corrB) {
      chart.clear()
      return
    }

    const commonCols = compareResult.common_numeric_columns.filter(
      (c) => corrA.columns.includes(c) && corrB.columns.includes(c),
    )

    if (commonCols.length < 2) {
      chart.clear()
      return
    }

    const dataA: number[][] = []
    const dataB: number[][] = []
    const diffData: number[][] = []

    for (let i = 0; i < commonCols.length; i++) {
      for (let j = 0; j < commonCols.length; j++) {
        const idxAi = corrA.columns.indexOf(commonCols[i])
        const idxAj = corrA.columns.indexOf(commonCols[j])
        const idxBi = corrB.columns.indexOf(commonCols[i])
        const idxBj = corrB.columns.indexOf(commonCols[j])
        const vA = idxAi >= 0 && idxAj >= 0 ? corrA.matrix[idxAi][idxAj] : 0
        const vB = idxBi >= 0 && idxBj >= 0 ? corrB.matrix[idxBi][idxBj] : 0
        const diff = vB - vA

        if (compareViewMode === 'sidebyside') {
          dataA.push([j, i, vA])
          dataB.push([j + commonCols.length + 1, i, vB])
        } else {
          dataA.push([j, i, vA])
          dataB.push([j, i + commonCols.length + 1, vB])
        }
        diffData.push([j, i, diff])
      }
    }

    const xLabels =
      compareViewMode === 'sidebyside'
        ? [...commonCols, ...Array(commonCols.length + 1).fill(''), ...commonCols]
        : commonCols
    const yLabels =
      compareViewMode === 'sidebyside'
        ? commonCols
        : [...commonCols, ...Array(commonCols.length + 1).fill(''), ...commonCols]
    const xMax = compareViewMode === 'sidebyside' ? commonCols.length * 2 + 1 : commonCols.length - 1
    const yMax = compareViewMode === 'sidebyside' ? commonCols.length - 1 : commonCols.length * 2 + 1

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(59,130,246,0.3)',
        textStyle: { color: '#e2e8f0' },
        formatter: (p: any) => {
          const [x, y, z] = p.data
          let xi = Math.round(x)
          let yi = Math.round(y)
          let which = 'A'
          if (compareViewMode === 'sidebyside') {
            if (xi >= commonCols.length + 1) {
              xi = xi - commonCols.length - 1
              which = 'B'
            }
          } else {
            if (yi >= commonCols.length + 1) {
              yi = yi - commonCols.length - 1
              which = 'B'
            }
          }
          if (xi < 0 || xi >= commonCols.length || yi < 0 || yi >= commonCols.length) return ''
          const val = Number(z).toFixed(3)
          const label = which === 'A' ? compareResult.label_a : compareResult.label_b
          const color = which === 'A' ? '#06b6d4' : '#a78bfa'
          const sign = Number(z) >= 0 ? '正相关' : '负相关'
          const strength = Math.abs(Number(z)) >= 0.7 ? '强' : Math.abs(Number(z)) >= 0.4 ? '中' : '弱'
          return `
            <div style="font-family:monospace;font-size:12px">
              <div style="color:${color};margin-bottom:4px">${commonCols[yi]} × ${commonCols[xi]} · ${label}</div>
              <div>r = <b style="color:${color}">${val}</b></div>
              <div style="color:#94a3b8;margin-top:4px">${strength}${sign}</div>
            </div>
          `
        },
      },
      legend: {
        data: [compareResult.label_a, compareResult.label_b],
        textStyle: { color: '#94a3b8' },
        top: 0,
        right: 10,
      },
      xAxis3D: {
        type: 'value',
        min: 0,
        max: xMax,
        name: '',
        axisLabel: {
          color: '#94a3b8',
          fontSize: 9,
          rotate: 35,
          formatter: (v: number) => {
            const i = Math.round(v)
            if (compareViewMode === 'sidebyside') {
              if (i >= 0 && i < commonCols.length) return commonCols[i]
              if (i > commonCols.length && i <= xMax) return commonCols[i - commonCols.length - 1] || ''
              return ''
            }
            return i >= 0 && i < commonCols.length ? commonCols[i] : ''
          },
        },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.06)' } },
      },
      yAxis3D: {
        type: 'value',
        min: 0,
        max: yMax,
        name: '',
        axisLabel: {
          color: '#94a3b8',
          fontSize: 9,
          formatter: (v: number) => {
            const i = Math.round(v)
            if (compareViewMode === 'sidebyside') {
              return i >= 0 && i < commonCols.length ? commonCols[i] : ''
            }
            if (i >= 0 && i < commonCols.length) return commonCols[i]
            if (i > commonCols.length && i <= yMax) return commonCols[i - commonCols.length - 1] || ''
            return ''
          },
        },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.06)' } },
      },
      zAxis3D: {
        type: 'value',
        min: -1,
        max: 1,
        name: '相关系数 r',
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      grid3D: {
        boxWidth: 200,
        boxDepth: 200,
        boxHeight: 100,
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
          name: compareResult.label_a,
          type: 'bar3D',
          data: dataA,
          barSize: 14,
          shading: 'lambert',
          minHeight: 0.02,
          itemStyle: {
            opacity: 0.85,
            color: function (params: any) {
              const v = params.value[2]
              if (v <= -0.7) return '#991b1b'
              if (v <= -0.4) return '#dc2626'
              if (v <= 0) return '#1e293b'
              if (v <= 0.4) return '#1e40af'
              if (v <= 0.7) return '#3b82f6'
              return '#06b6d4'
            },
          },
        },
        {
          name: compareResult.label_b,
          type: 'bar3D',
          data: dataB,
          barSize: 14,
          shading: 'lambert',
          minHeight: 0.02,
          itemStyle: {
            opacity: 0.85,
            color: function (params: any) {
              const v = params.value[2]
              if (v <= -0.7) return '#581c87'
              if (v <= -0.4) return '#7c3aed'
              if (v <= 0) return '#1e293b'
              if (v <= 0.4) return '#6d28d9'
              if (v <= 0.7) return '#8b5cf6'
              return '#a78bfa'
            },
          },
        },
      ],
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [compareResult, compareViewMode, autoRotate])

  const hasCorr =
    compareResult?.dataset_a.correlations && compareResult?.dataset_b.correlations
    && (compareResult?.common_numeric_columns || []).length >= 2

  if (!hasCorr) {
    return (
      <div className="w-full h-full flex items-center justify-center text-cockpit-muted">
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-30">🔗</div>
          <div>无可对比的相关性矩阵</div>
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
