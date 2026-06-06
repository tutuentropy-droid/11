import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import { useAnalysisStore } from '../../store/analysisStore'

export default function CompareCategorical() {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const compareResult = useAnalysisStore((s) => s.compareResult)
  const [activeCol, setActiveCol] = useState<string | null>(null)

  useEffect(() => {
    if (!ref.current || !compareResult) return
    const diffs = compareResult.categorical_diffs || []
    if (diffs.length === 0) return
    if (!activeCol) setActiveCol(diffs[0].column)
  }, [compareResult, activeCol])

  useEffect(() => {
    if (!ref.current || !compareResult || !activeCol) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current, undefined, { renderer: 'canvas' })
    }
    const chart = chartRef.current
    const diffs = compareResult.categorical_diffs || []
    const diff = diffs.find((d) => d.column === activeCol)
    if (!diff) return

    const items = diff.items.slice(0, 15)
    const categories = items.map((i) => i.category)

    chart.setOption({
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: 'rgba(17,24,39,0.95)',
        borderColor: 'rgba(59,130,246,0.3)',
        textStyle: { color: '#e2e8f0' },
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const ps = Array.isArray(params) ? params : [params]
          const idx = ps[0]?.dataIndex
          if (idx === undefined) return ''
          const item = items[idx]
          const pctColor = item.pct_change >= 0 ? '#22c55e' : '#ef4444'
          const pctSign = item.pct_change >= 0 ? '+' : ''
          return `
            <div style="font-family:monospace;font-size:12px">
              <div style="color:#f59e0b;margin-bottom:6px">${item.category}</div>
              <div style="color:#06b6d4">${compareResult.label_a}: ${item.count_a} (${item.pct_a}%)</div>
              <div style="color:#a78bfa">${compareResult.label_b}: ${item.count_b} (${item.pct_b}%)</div>
              <div style="margin-top:4px">数量变化: ${item.count_change >= 0 ? '+' : ''}${item.count_change}</div>
              <div style="color:${pctColor}">占比变化: ${pctSign}${item.pct_change.toFixed(2)}pp</div>
              ${Math.abs(item.pct_change) >= 5 ? '<div style="color:#f59e0b;margin-top:4px">🚨 显著变化</div>' : ''}
            </div>
          `
        },
      },
      legend: {
        data: [compareResult.label_a, compareResult.label_b, '占比变化(pp)'],
        textStyle: { color: '#94a3b8' },
        top: 0,
        right: 10,
      },
      grid: { left: 60, right: 60, top: 40, bottom: 60 },
      xAxis: {
        type: 'category',
        data: categories,
        axisLabel: {
          color: '#94a3b8',
          fontSize: 10,
          rotate: 30,
          formatter: (v: string) => (v.length > 10 ? v.slice(0, 10) + '…' : v),
        },
        axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
        splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
      },
      yAxis: [
        {
          type: 'value',
          name: '数量',
          nameTextStyle: { color: '#94a3b8', fontSize: 10 },
          axisLabel: { color: '#94a3b8', fontSize: 9 },
          axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
          splitLine: { lineStyle: { color: 'rgba(59,130,246,0.08)' } },
        },
        {
          type: 'value',
          name: '占比变化(pp)',
          nameTextStyle: { color: '#94a3b8', fontSize: 10 },
          axisLabel: { color: '#94a3b8', fontSize: 9 },
          axisLine: { lineStyle: { color: 'rgba(59,130,246,0.3)' } },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: compareResult.label_a,
          type: 'bar',
          data: items.map((i) => ({
            value: i.count_a,
            itemStyle: {
              color: Math.abs(i.pct_change) >= 5 ? 'rgba(6,182,212,0.9)' : 'rgba(6,182,212,0.6)',
            },
          })),
          barGap: '10%',
          barWidth: '25%',
        },
        {
          name: compareResult.label_b,
          type: 'bar',
          data: items.map((i) => ({
            value: i.count_b,
            itemStyle: {
              color: Math.abs(i.pct_change) >= 5 ? 'rgba(167,139,250,0.95)' : 'rgba(167,139,250,0.65)',
            },
          })),
          barWidth: '25%',
        },
        {
          name: '占比变化(pp)',
          type: 'line',
          yAxisIndex: 1,
          data: items.map((i) => i.pct_change),
          lineStyle: { color: '#f59e0b', width: 2 },
          itemStyle: {
            color: (p: any) => (p.value >= 0 ? '#22c55e' : '#ef4444'),
            borderColor: '#f59e0b',
            borderWidth: 2,
          },
          symbolSize: (v: number) => (Math.abs(v) >= 5 ? 12 : 8),
          markLine: {
            silent: true,
            symbol: 'none',
            lineStyle: { color: 'rgba(148,163,184,0.3)', type: 'dashed' },
            data: [{ yAxis: 0 }],
          },
        },
      ],
    })

    const onResize = () => chart.resize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [compareResult, activeCol])

  const diffs = compareResult?.categorical_diffs || []

  if (!compareResult || diffs.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-cockpit-muted">
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-30">🥧</div>
          <div>无可对比的分类列</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-wrap gap-1 px-2 pt-2 pb-2">
        {diffs.map((d) => (
          <button
            key={d.column}
            onClick={() => setActiveCol(d.column)}
            className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${
              activeCol === d.column
                ? 'bg-cockpit-purple/30 text-cockpit-purple border border-cockpit-purple/50'
                : 'bg-cockpit-panel/50 text-cockpit-muted hover:text-cockpit-text border border-transparent'
            }`}
          >
            {d.column}
          </button>
        ))}
      </div>
      <div ref={ref} className="flex-1" />
    </div>
  )
}
