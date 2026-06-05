import { create } from 'zustand'
import type { AnalysisResult, ChartType, Insight } from '../types'

interface AnalysisState {
  result: AnalysisResult | null
  loading: boolean
  error: string | null
  activeChart: ChartType
  selectedPoint: Record<string, any> | null
  selectedInsight: Insight | null
  progress: number

  setResult: (r: AnalysisResult | null) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  setProgress: (n: number) => void
  setActiveChart: (c: ChartType) => void
  setSelectedPoint: (p: Record<string, any> | null) => void
  setSelectedInsight: (i: Insight | null) => void
  reset: () => void
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  result: null,
  loading: false,
  error: null,
  activeChart: 'correlation',
  selectedPoint: null,
  selectedInsight: null,
  progress: 0,

  setResult: (r) => set({ result: r }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
  setProgress: (n) => set({ progress: n }),
  setActiveChart: (c) => set({ activeChart: c }),
  setSelectedPoint: (p) => set({ selectedPoint: p }),
  setSelectedInsight: (i) => set({ selectedInsight: i }),
  reset: () =>
    set({
      result: null,
      loading: false,
      error: null,
      activeChart: 'correlation',
      selectedPoint: null,
      selectedInsight: null,
      progress: 0,
    }),
}))
