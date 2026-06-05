import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'
import { useAnalysisStore } from '../../store/analysisStore'

export default function Correlation3D() {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const result = useAnalysisStore((s) => s.result)
  const setSelectedInsight = useAnalysisStore((s) => s.setSelectedInsight)

  useEffect(() => {
    if (!ref.current || !result?.correlations) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    }
    const chart = chartRef.current
    const corr = result.correlations
    const cols = corr.columns

    const data: number[][] = []
    for (let i = 0; i < cols.length; i++) {
      for (let j = 0; j < cols.length; j++) {
        data.push([j, i, corr.matrix[i][j]])
      }
    }

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(59,130,246,0.3)',
        textStyle: { color: '#e2e8f0' },
        formatter: (p: any) => {
          const [x, y, z] = p.data
          const val = Number(z).toFixed(3)
          const sign = Number(z) >= 0 ? '正相关' : '负相关'
          const strength =
            Math.abs(Number(z)) >= 0.7 ? '强' : Math.abs(Number(z)) >= 0.4 ? '中' : '弱'
          return `
            <div style="font-family:monospace;font-size:12px">
              <div style="color:#06b6d4;margin-bottom:4px">${cols[y]} × ${cols[x]}</div>
              <div>相关系数 r = <b style="color:#3b82f6">${val}</b></div>
              <div style="color:#94a3b8;margin-top:4px">${strength}${sign}</div>
            </div>
          `
        },
      },
      xAxis3D: {
        type: 'category',
        data: cols,
        name: '',
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          rotate: 35,
        },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.1)' } },
      },
      yAxis3D: {
        type: 'category',
        data: cols,
        name: '',
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.1)' } },
      },
      zAxis3D: {
        type: 'value',
        min: -1,
        max: 1,
        name: '',
        axisLabel: { color: '#94a3b8', fontSize: 10 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.1)' } },
      },
      grid3D: {
        boxWidth: 160,
        boxDepth: 160,
        boxHeight: 100,
        viewControl: {
          autoRotate: true,
          autoRotateSpeed: 6,
          rotateSensitivity: 1.5,
          zoomSensitivity: 1.2,
          panSensitivity: 1,
        },
        light: {
          main: { intensity: 1.3, shadow: true, quality: 'high' },
          ambient: { intensity: 0.5 },
        },
        postEffect: {
          enable: true,
          bloom: { enable: true, bloomIntensity: 0.3 },
          SSAO: { enable: true, quality: 'medium', radius: 2 },
        },
        groundPlane: { show: false },
      },
      visualMap: {
        show: true,
        dimension: 2,
        min: -1,
        max: 1,
        calculable: true,
        precision: 2,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        textStyle: { color: '#94a3b8' },
        inRange: {
          color: ['#ef4444', '#dc2626', '#1e293b', '#3b82f6', '#06b6d4'],
        },
      },
      series: [
        {
          type: 'bar3D',
          data,
          barSize: 18,
          shading: 'lambert',
          minHeight: 0.02,
          itemStyle: {
            opacity: 0.92,
            borderWidth: 0.5,
            borderColor: 'rgba(255,255,255,0.1)',
          },
          emphasis: {
            label: { show: false },
            itemStyle: { color: '#fff' },
          },
        },
      ],
    })

    chart.on('click', (params: any) => {
      if (params.data) {
        const [x, y, z] = params.data
        const cols2 = result.correlations!.columns
        setSelectedInsight({
          severity: Math.abs(Number(z)) >= 0.7 ? 'high' : Math.abs(Number(z)) >= 0.4 ? 'medium' : 'low',
          text: `'${cols2[y]}' 与 '${cols2[x]}' 相关系数 r = ${Number(z).toFixed(3)}`,
          viz: 'correlation',
          details: { col1: cols2[y], col2: cols2[x], r: Number(z) },
        })
      }
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [result, setSelectedInsight])

  return <div ref={ref} className="w-full h-full" />
}
