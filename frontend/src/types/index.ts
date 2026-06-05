export interface ColumnStats {
  mean?: number
  median?: number
  std?: number
  min?: number
  max?: number
  q25?: number
  q75?: number
  iqr?: number
}

export interface CategoryItem {
  name: string
  count: number
  percentage: number
}

export interface ColumnInfo {
  name: string
  type: 'numeric' | 'categorical' | 'datetime' | 'text' | 'boolean'
  missing_rate: number
  unique_count: number
  stats?: ColumnStats
  outliers: number[]
  categories?: CategoryItem[]
  sample: any[]
}

export interface DatasetInfo {
  name: string
  rows: number
  cols: number
  total_missing_rate: number
  duplicate_rows: number
}

export interface CorrelationResult {
  columns: string[]
  matrix: number[][]
  top_pairs: [string, string, number][]
}

export interface CategoricalFrequency {
  column: string
  values: CategoryItem[]
}

export interface TimeSeriesPoint {
  time: string
  value: number
}

export interface TimeSeriesForecast {
  values: number[]
  upper: number[]
  lower: number[]
  times?: string[]
}

export interface TimeSeriesResult {
  time_column: string
  value_column: string
  data_points: TimeSeriesPoint[]
  trend: TimeSeriesPoint[]
  seasonal: TimeSeriesPoint[]
  forecast?: TimeSeriesForecast
}

export interface Insight {
  severity: 'high' | 'medium' | 'low'
  text: string
  viz: string
  details?: Record<string, any>
}

export interface SummaryResult {
  headline: string
  insights: Insight[]
}

export interface AnalysisResult {
  task_id?: string
  dataset: DatasetInfo
  columns: ColumnInfo[]
  correlations?: CorrelationResult
  categorical_freq: CategoricalFrequency[]
  timeseries?: TimeSeriesResult
  summary: SummaryResult
  sampled_data?: Record<string, any>[]
}

export type ChartType = 'correlation' | 'scatter' | 'histogram' | 'timeseries' | 'pie'
