import { create } from 'zustand'
import type { AnalysisResult, ChartType, Insight, OutlierStoryCard } from '../types'

interface AnalysisState {
  result: AnalysisResult | null
  loading: boolean
  error: string | null
  activeChart: ChartType
  selectedPoint: Record<string, any> | null
  selectedInsight: Insight | null
  selectedOutlierStory: OutlierStoryCard | null
  progress: number

  setResult: (r: AnalysisResult | null) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  setProgress: (n: number) => void
  setActiveChart: (c: ChartType) => void
  setSelectedPoint: (p: Record<string, any> | null) => void
  setSelectedInsight: (i: Insight | null) => void
  setSelectedOutlierStory: (s: OutlierStoryCard | null) => void
  reset: () => void
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  result: null,
  loading: false,
  error: null,
  activeChart: 'correlation',
  selectedPoint: null,
  selectedInsight: null,
  selectedOutlierStory: null,
  progress: 0,

  setResult: (r) => set({ result: r }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
  setProgress: (n) => set({ progress: n }),
  setActiveChart: (c) => set({ activeChart: c }),
  setSelectedPoint: (p) => set({ selectedPoint: p }),
  setSelectedInsight: (i) => set({ selectedInsight: i }),
  setSelectedOutlierStory: (s) => set({ selectedOutlierStory: s }),
  reset: () =>
    set({
      result: null,
      loading: false,
      error: null,
      activeChart: 'correlation',
      selectedPoint: null,
      selectedInsight: null,
      selectedOutlierStory: null,
      progress: 0,
    }),
}))
