import { create } from 'zustand'
import type { AnalysisResult, ChartType, Insight, OutlierStoryCard, CompareResult, CompareChartType, CleanResult, QualityCategory } from '../types'

interface AnalysisState {
  result: AnalysisResult | null
  compareResult: CompareResult | null
  loading: boolean
  error: string | null
  activeChart: ChartType
  activeCompareChart: CompareChartType
  selectedPoint: Record<string, any> | null
  selectedInsight: Insight | null
  selectedOutlierStory: OutlierStoryCard | null
  progress: number
  mode: 'single' | 'compare'
  compareViewMode: 'overlay' | 'sidebyside'
  cleaning: boolean
  cleaningError: string | null
  lastCleanResult: CleanResult | null
  qualityBeforeSnapshot: QualityCategory | null

  setResult: (r: AnalysisResult | null) => void
  setCompareResult: (r: CompareResult | null) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
  setProgress: (n: number) => void
  setActiveChart: (c: ChartType) => void
  setActiveCompareChart: (c: CompareChartType) => void
  setSelectedPoint: (p: Record<string, any> | null) => void
  setSelectedInsight: (i: Insight | null) => void
  setSelectedOutlierStory: (s: OutlierStoryCard | null) => void
  setMode: (m: 'single' | 'compare') => void
  setCompareViewMode: (m: 'overlay' | 'sidebyside') => void
  setCleaning: (v: boolean) => void
  setCleaningError: (e: string | null) => void
  setLastCleanResult: (r: CleanResult | null) => void
  setQualityBeforeSnapshot: (q: QualityCategory | null) => void
  applyCleanResult: (r: CleanResult) => void
  reset: () => void
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  result: null,
  compareResult: null,
  loading: false,
  error: null,
  activeChart: 'correlation',
  activeCompareChart: 'compare_timeseries',
  selectedPoint: null,
  selectedInsight: null,
  selectedOutlierStory: null,
  progress: 0,
  mode: 'single',
  compareViewMode: 'overlay',
  cleaning: false,
  cleaningError: null,
  lastCleanResult: null,
  qualityBeforeSnapshot: null,

  setResult: (r) => set({ result: r }),
  setCompareResult: (r) => set({ compareResult: r }),
  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
  setProgress: (n) => set({ progress: n }),
  setActiveChart: (c) => set({ activeChart: c }),
  setActiveCompareChart: (c) => set({ activeCompareChart: c }),
  setSelectedPoint: (p) => set({ selectedPoint: p }),
  setSelectedInsight: (i) => set({ selectedInsight: i }),
  setSelectedOutlierStory: (s) => set({ selectedOutlierStory: s }),
  setMode: (m) => set({ mode: m }),
  setCompareViewMode: (m) => set({ compareViewMode: m }),
  setCleaning: (v) => set({ cleaning: v }),
  setCleaningError: (e) => set({ cleaningError: e }),
  setLastCleanResult: (r) => set({ lastCleanResult: r }),
  setQualityBeforeSnapshot: (q) => set({ qualityBeforeSnapshot: q }),
  applyCleanResult: (r) => {
    if (r.updated_analysis) {
      set({ result: r.updated_analysis, lastCleanResult: r })
    } else {
      set({ lastCleanResult: r })
    }
  },
  reset: () =>
    set({
      result: null,
      compareResult: null,
      loading: false,
      error: null,
      activeChart: 'correlation',
      activeCompareChart: 'compare_timeseries',
      selectedPoint: null,
      selectedInsight: null,
      selectedOutlierStory: null,
      progress: 0,
      mode: 'single',
      compareViewMode: 'overlay',
      cleaning: false,
      cleaningError: null,
      lastCleanResult: null,
      qualityBeforeSnapshot: null,
    }),
}))
