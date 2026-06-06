import { useEffect, useRef, useMemo, useState } from 'react'
import * as echarts from 'echarts'
import 'echarts-gl'
import { useAnalysisStore } from '../../store/analysisStore'
import type { CustomChartData } from '../../types'

const CHART_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#14b8a6', '#6366f1', '#f97316']

export default function CustomChart3D() {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const nlChartResponse = useAnalysisStore((s) => s.nlChartResponse)
  const nlChartLoading = useAnalysisStore((s) => s.nlChartLoading)
  const nlChartError = useAnalysisStore((s) => s.nlChartError)
  const setShowNLCustomChart = useAnalysisStore((s) => s.setShowNLCustomChart)
  const [autoRotate, setAutoRotate] = useState(true)

  const chartData = useMemo<CustomChartData | null>(() => {
    return nlChartResponse?.chart_data || null
  }, [nlChartResponse])

  const intent = useMemo(() => nlChartResponse?.intent, [nlChartResponse])

  useEffect(() => {
    if (!ref.current) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    }
    const chart = chartRef.current

    if (!chartData) {
      chart.setOption({
        backgroundColor: 'transparent',
        title: {
          text: nlChartLoading ? '正在生成图表...' : nlChartError || '暂无数据',
          left: 'center',
          top: 'center',
          textStyle: { color: '#94a3b8', fontSize: 14 },
        },
      })
      return
    }

    const ctype = chartData.chart_type

    if (ctype === 'timeseries' || ctype === 'line' || ctype === 'area') {
      renderTimeseries(chart, chartData)
    } else if (ctype === 'pie') {
      renderPie(chart, chartData)
    } else if (ctype === 'scatter') {
      renderScatter(chart, chartData)
    } else {
      renderBar(chart, chartData)
    }

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [chartData, nlChartLoading, nlChartError, autoRotate])

  const renderBar = (chart: echarts.ECharts, data: CustomChartData) => {
    const categories = data.categories
    const seriesData = data.series

    if (seriesData.length === 0 || categories.length === 0) {
      chart.setOption({
        backgroundColor: 'transparent',
        title: { text: '无数据可展示', left: 'center', top: 'center', textStyle: { color: '#94a3b8', fontSize: 14 } },
      })
      return
    }

    const barData: number[][] = []
    if (seriesData.length === 1) {
      const s0 = seriesData[0].data || []
      for (let i = 0; i < categories.length; i++) {
        const item = s0[i] || { value: 0 }
        barData.push([i, 0, Number(item?.value ?? 0)])
      }
    } else {
      for (let si = 0; si < seriesData.length; si++) {
        const sd = seriesData[si].data || []
        for (let ci = 0; ci < categories.length; ci++) {
          const item = sd.find((d: any) => d.category === categories[ci])
          const val = Number(item?.value ?? 0)
          barData.push([ci, si, val])
        }
      }
    }

    const allVals = barData.map((d) => d[2])
    const maxV = Math.max(...allVals, 1)
    const minV = Math.min(...allVals, 0)

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(59,130,246,0.3)',
        textStyle: { color: '#e2e8f0' },
        formatter: (p: any) => {
          const [cx, cy, cz] = p.data
          const cat = categories[Math.round(cx)] || ''
          const sname = seriesData.length > 1 ? (seriesData[Math.round(cy)]?.name || '') : (seriesData[0]?.name || data.z_label)
          return `
            <div style="font-family:monospace;font-size:12px">
              <div style="color:#06b6d4;margin-bottom:4px">${cat}</div>
              ${sname ? `<div style="color:#94a3b8">${sname}</div>` : ''}
              <div>数值: <b style="color:#3b82f6">${Number(cz).toLocaleString()}</b></div>
            </div>
          `
        },
      },
      legend: {
        show: seriesData.length > 1,
        data: seriesData.map((s) => s.name),
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
        right: 10,
      },
      xAxis3D: {
        type: 'category',
        data: categories,
        name: data.x_label,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 9, rotate: categories.length > 8 ? 30 : 0 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      yAxis3D: {
        type: seriesData.length > 1 ? 'category' : 'value',
        data: seriesData.length > 1 ? seriesData.map((s) => s.name) : undefined,
        name: data.y_label,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: seriesData.length > 1 ? 9 : 8, show: seriesData.length > 1 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' }, show: seriesData.length > 1 },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
        min: 0,
        max: seriesData.length > 1 ? seriesData.length - 1 : undefined,
      },
      zAxis3D: {
        type: 'value',
        name: data.z_label,
        min: minV * 0.9,
        max: maxV * 1.1,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      grid3D: {
        boxWidth: Math.max(160, categories.length * 20),
        boxDepth: seriesData.length > 1 ? Math.max(80, seriesData.length * 30) : 30,
        boxHeight: 120,
        viewControl: {
          autoRotate: autoRotate,
          autoRotateSpeed: 5,
          rotateSensitivity: 1.5,
          zoomSensitivity: 1.2,
        },
        light: { main: { intensity: 1.4, shadow: true }, ambient: { intensity: 0.5 } },
        postEffect: { enable: true, bloom: { enable: true, bloomIntensity: 0.3 }, SSAO: { enable: true, quality: 'medium', radius: 2 } },
        groundPlane: { show: false },
      },
      visualMap: {
        show: seriesData.length <= 1,
        dimension: 2,
        min: minV,
        max: maxV,
        calculable: true,
        precision: 0,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        textStyle: { color: '#94a3b8' },
        inRange: { color: ['#1e293b', '#3b82f6', '#06b6d4', '#8b5cf6'] },
      },
      series: [
        {
          type: 'bar3D',
          data: barData,
          barSize: seriesData.length > 1 ? Math.max(8, 24 / Math.sqrt(seriesData.length)) : 20,
          shading: 'lambert',
          minHeight: 0.02,
          itemStyle: {
            opacity: 0.92,
            borderWidth: 0.5,
            borderColor: 'rgba(255,255,255,0.1)',
          },
          emphasis: { itemStyle: { color: '#fff' } },
        },
      ],
    })
  }

  const renderTimeseries = (chart: echarts.ECharts, data: CustomChartData) => {
    const categories = data.categories
    const seriesData = data.series

    if (seriesData.length === 0 || categories.length === 0) {
      chart.setOption({
        backgroundColor: 'transparent',
        title: { text: '无数据可展示', left: 'center', top: 'center', textStyle: { color: '#94a3b8', fontSize: 14 } },
      })
      return
    }

    const allValues: number[] = []
    seriesData.forEach((s) => (s.data || []).forEach((d: any) => allValues.push(Number(d.value ?? 0))))
    const maxV = Math.max(...allValues, 1)
    const minV = Math.min(...allValues, 0)

    const surfaceData: number[][] = []
    if (seriesData.length === 1) {
      const pts = seriesData[0].data || []
      for (let i = 0; i < pts.length; i++) {
        for (let j = 0; j < 8; j++) {
          const base = Number(pts[i]?.value ?? 0)
          const wave = Math.sin((i / Math.max(1, pts.length)) * Math.PI * 4 + j / 2) * (maxV - minV) * 0.01
          surfaceData.push([i, j, base + wave])
        }
      }
    }

    const series: any[] = []

    if (surfaceData.length > 0) {
      series.push({
        name: '历史曲面',
        type: 'surface',
        data: surfaceData,
        wireframe: { show: false },
        itemStyle: { opacity: 0.35 },
        shading: 'color',
      })
    }

    seriesData.forEach((s, si) => {
      const color = CHART_COLORS[si % CHART_COLORS.length]
      const pts = s.data || []
      series.push({
        name: s.name || `系列${si + 1}`,
        type: 'line3D',
        data: pts.map((p: any, i: number) => [i, 3.5, Number(p.value ?? 0)]),
        lineStyle: {
          color,
          width: 4,
          opacity: 1,
          shadowBlur: 8,
          shadowColor: color,
        },
      })
    })

    const tickStep = Math.max(1, Math.floor(categories.length / 8))

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(59,130,246,0.3)',
        textStyle: { color: '#e2e8f0' },
        formatter: (p: any) => {
          const idx = Math.round(p.data?.[0] ?? 0)
          const t = categories[idx] || ''
          const v = p.data?.[2]
          return `
            <div style="font-family:monospace;font-size:12px">
              <div style="color:#06b6d4;margin-bottom:4px">${p.seriesName}</div>
              <div>${t}</div>
              <div>数值: <b style="color:#3b82f6">${Number(v).toLocaleString()}</b></div>
            </div>
          `
        },
      },
      legend: {
        show: seriesData.length > 1 || surfaceData.length > 0,
        data: series.map((s) => s.name),
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
        right: 10,
      },
      visualMap: {
        show: false,
        dimension: 2,
        min: minV,
        max: maxV,
        inRange: { color: ['#1e293b', '#3b82f6', '#06b6d4', '#8b5cf6'] },
      },
      xAxis3D: {
        type: 'value',
        min: 0,
        max: Math.max(...categories.map((_, i) => i), 1),
        name: data.x_label,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 9,
          formatter: (v: number) => {
            const i = Math.round(v)
            if (i >= 0 && i < categories.length && i % tickStep === 0) return categories[i]
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
        name: data.z_label || seriesData[0]?.name || '',
        min: minV * 0.9,
        max: maxV * 1.1,
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
        light: { main: { intensity: 1.4, shadow: true }, ambient: { intensity: 0.6 } },
        postEffect: { enable: true, bloom: { enable: true, bloomIntensity: 0.5 }, SSAO: { enable: true, quality: 'medium', radius: 2 } },
        groundPlane: { show: false },
      },
      series,
    })
  }

  const renderPie = (chart: echarts.ECharts, data: CustomChartData) => {
    const s0 = data.series[0]
    const pieData = s0?.data || []

    if (pieData.length === 0) {
      chart.setOption({
        backgroundColor: 'transparent',
        title: { text: '无数据可展示', left: 'center', top: 'center', textStyle: { color: '#94a3b8', fontSize: 14 } },
      })
      return
    }

    const total = pieData.reduce((a: number, b: any) => a + Number(b.value ?? 0), 0) || 1

    function getParametricEquation(startRatio: number, endRatio: number, _isSelected: boolean, _isHovered: boolean, k: number, h: number) {
      const midRatio = (startRatio + endRatio) / 2
      const startRadian = startRatio * Math.PI * 2
      const endRadian = endRatio * Math.PI * 2
      const midRadian = midRatio * Math.PI * 2
      k = typeof k !== 'undefined' ? k : 1 / 3
      const offsetX = Math.cos(midRadian) * 0
      const offsetY = Math.sin(midRadian) * 0
      return {
        u: { min: -Math.PI, max: Math.PI * 3, step: Math.PI / 32 },
        v: { min: 0, max: Math.PI * 2, step: Math.PI / 20 },
        x: function (u: number, v: number) {
          if (u < startRadian) return offsetX + Math.cos(startRadian) * (1 + Math.cos(v) * k)
          if (u > endRadian) return offsetX + Math.cos(endRadian) * (1 + Math.cos(v) * k)
          return offsetX + Math.cos(u) * (1 + Math.cos(v) * k)
        },
        y: function (u: number, v: number) {
          if (u < startRadian) return offsetY + Math.sin(startRadian) * (1 + Math.cos(v) * k)
          if (u > endRadian) return offsetY + Math.sin(endRadian) * (1 + Math.cos(v) * k)
          return offsetY + Math.sin(u) * (1 + Math.cos(v) * k)
        },
        z: function (u: number, _v: number) {
          if (u < -Math.PI * 0.5) return Math.sin(u)
          if (u > Math.PI * 2.5) return Math.sin(u) * h
          return h
        },
      }
    }

    let startRatio = 0
    const series: any[] = pieData.map((d: any, idx: number) => {
      const v = Number(d.value ?? 0)
      const endRatio = startRatio + v / total
      const h = 0.4 + (idx / pieData.length) * 0.5
      const color = CHART_COLORS[idx % CHART_COLORS.length]
      const seriesItem = {
        name: d.name,
        type: 'surface',
        parametric: true,
        wireframe: { show: false },
        pieData: d,
        pieStatus: { selected: false, hovered: false, k: 0.15 },
        itemStyle: { color, opacity: 0.9 },
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
              <div style="color:#06b6d4;margin-bottom:4px">${d.name}</div>
              <div>数量: <b style="color:#3b82f6">${Number(d.value).toLocaleString()}</b></div>
              <div>占比: <b style="color:#a78bfa">${d.percentage ?? (Number(d.value) / total * 100).toFixed(2)}%</b></div>
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
        data: pieData.map((d: any, i: number) => ({
          name: d.name,
          itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
        })),
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
        light: { main: { intensity: 1.4, shadow: true }, ambient: { intensity: 0.5 } },
        postEffect: { enable: true, bloom: { enable: true, bloomIntensity: 0.3 } },
      },
      series,
    })
  }

  const renderScatter = (chart: echarts.ECharts, data: CustomChartData) => {
    const seriesData = data.series

    if (seriesData.length === 0) {
      chart.setOption({
        backgroundColor: 'transparent',
        title: { text: '无数据可展示', left: 'center', top: 'center', textStyle: { color: '#94a3b8', fontSize: 14 } },
      })
      return
    }

    const allX: number[] = []
    const allY: number[] = []
    const allZ: number[] = []
    seriesData.forEach((s) => (s.data || []).forEach((pt: any) => {
      allX.push(Number(pt[0] ?? 0))
      allY.push(Number(pt[1] ?? 0))
      if (pt.length > 2) allZ.push(Number(pt[2] ?? 0))
    }))
    const hasZ = allZ.length > 0 && allZ.some((v) => v !== 0)
    const minX = Math.min(...allX, 0)
    const maxX = Math.max(...allX, 1)
    const minY = Math.min(...allY, 0)
    const maxY = Math.max(...allY, 1)
    const minZ = hasZ ? Math.min(...allZ, 0) : 0
    const maxZ = hasZ ? Math.max(...allZ, 1) : 1

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(59,130,246,0.3)',
        textStyle: { color: '#e2e8f0' },
        formatter: (p: any) => {
          const [x, y, z] = p.data
          return `
            <div style="font-family:monospace;font-size:12px">
              <div style="color:#06b6d4;margin-bottom:4px">${p.seriesName}</div>
              <div>${data.x_label}: <b style="color:#3b82f6">${Number(x).toLocaleString()}</b></div>
              <div>${data.y_label}: <b style="color:#8b5cf6">${Number(y).toLocaleString()}</b></div>
              ${hasZ ? `<div>${data.z_label}: <b style="color:#f59e0b">${Number(z).toLocaleString()}</b></div>` : ''}
            </div>
          `
        },
      },
      legend: {
        show: seriesData.length > 1,
        data: seriesData.map((s) => s.name),
        textStyle: { color: '#94a3b8', fontSize: 11 },
        top: 0,
        right: 10,
      },
      xAxis3D: {
        type: 'value',
        name: data.x_label,
        min: minX,
        max: maxX,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      yAxis3D: {
        type: 'value',
        name: data.y_label,
        min: minY,
        max: maxY,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: 9 },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      zAxis3D: {
        type: 'value',
        name: hasZ ? data.z_label : '',
        min: minZ,
        max: maxZ,
        nameTextStyle: { color: '#94a3b8', fontSize: 11 },
        axisLabel: { color: '#94a3b8', fontSize: hasZ ? 9 : 0, show: hasZ },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' }, show: hasZ },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' }, show: hasZ },
      },
      grid3D: {
        boxWidth: 160,
        boxDepth: 160,
        boxHeight: hasZ ? 120 : 30,
        viewControl: {
          autoRotate: autoRotate,
          autoRotateSpeed: 6,
          rotateSensitivity: 1.5,
          zoomSensitivity: 1.2,
        },
        light: { main: { intensity: 1.3, shadow: true, quality: 'high' }, ambient: { intensity: 0.5 } },
        postEffect: { enable: true, bloom: { enable: true, bloomIntensity: 0.3 }, SSAO: { enable: true, quality: 'medium', radius: 2 } },
        groundPlane: { show: false },
      },
      series: seriesData.map((s, si) => ({
        name: s.name,
        type: 'scatter3D',
        data: s.data || [],
        symbolSize: 10,
        itemStyle: {
          color: CHART_COLORS[si % CHART_COLORS.length],
          opacity: 0.85,
          shadowBlur: 10,
          shadowColor: CHART_COLORS[si % CHART_COLORS.length],
        },
      })),
    })
  }

  if (nlChartLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-spin">🛰️</div>
          <div className="text-cockpit-muted text-sm">正在生成图表...</div>
        </div>
      </div>
    )
  }

  if (nlChartError) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 opacity-50">⚠️</div>
          <div className="text-cockpit-danger text-sm">{nlChartError}</div>
        </div>
      </div>
    )
  }

  if (!chartData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-30">✨</div>
          <div className="text-cockpit-muted text-sm">在左侧输入框输入描述，自动生成图表</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-2 pb-1 z-10">
        <div className="flex-1">
          <div className="text-sm font-medium text-cockpit-text truncate">{chartData.title}</div>
          {intent && (
            <div className="text-[10px] font-mono text-cockpit-muted mt-0.5">
              解析方式：
              <span className={intent.parser_source === 'llm' ? 'text-cockpit-cyan' : 'text-cockpit-purple'}>
                {intent.parser_source === 'llm' ? '🧠 大语言模型' : '🔍 关键词匹配'}
              </span>
              {intent.filters?.length > 0 && (
                <span className="ml-2">
                  筛选：{intent.filters.map((f) => `${f.column}∈[${f.values.join(',')}]`).join('; ')}
                </span>
              )}
              {intent.aggregation && (
                <span className="ml-2">
                  聚合：{intent.aggregation}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowNLCustomChart(false)}
          className="px-2 py-1 rounded text-xs text-cockpit-muted border border-cockpit-border hover:text-cockpit-danger hover:border-cockpit-danger/40 transition-colors"
          title="返回默认图表"
        >
          ← 返回
        </button>
        <button
          onClick={() => setAutoRotate(!autoRotate)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-all border ${
            autoRotate
              ? 'bg-cockpit-primary/20 text-cockpit-cyan border-cockpit-primary/40'
              : 'bg-cockpit-panel/50 text-cockpit-muted border-cockpit-border hover:text-cockpit-text'
          }`}
        >
          {autoRotate ? '⏸ 停止旋转' : '▶ 自动旋转'}
        </button>
      </div>
      <div ref={ref} className="flex-1" />
    </div>
  )
}
