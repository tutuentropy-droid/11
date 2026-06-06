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

export interface OutlierStoryCard {
  row_index: number
  column: string
  story: string
  actual_value: number
  expected_min: number
  expected_max: number
  deviation_percent: number
  direction: '偏高' | '偏低' | string
  context_fields: Record<string, any>
}

export interface KPIDefinition {
  id: string
  name: string
  description: string
  unit: string
  icon: string
  color: string
  trend_supported: boolean
}

export interface MatchScoreItem {
  template_id: string
  score: number
}

export interface KPITrendPoint {
  period: string
  kpis: Record<string, any>
}

export interface IndustryAnalysis {
  template_id: string
  template_name: string
  template_icon: string
  template_color: string
  template_description: string
  match_score: number
  match_scores: MatchScoreItem[]
  kpi_definitions: KPIDefinition[]
  kpi_values: Record<string, any>
  kpi_trends: KPITrendPoint[]
  matched_columns: Record<string, string>
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
  outlier_stories: OutlierStoryCard[]
  industry?: IndustryAnalysis
}

export type ChartType = 'correlation' | 'scatter' | 'histogram' | 'timeseries' | 'pie'

export interface NumericDiff {
  column: string
  mean_a?: number
  mean_b?: number
  mean_change_pct?: number
  median_a?: number
  median_b?: number
  median_change_pct?: number
  std_a?: number
  std_b?: number
}

export interface CategoricalDiffItem {
  category: string
  count_a: number
  count_b: number
  count_change: number
  pct_a: number
  pct_b: number
  pct_change: number
}

export interface CategoricalDiff {
  column: string
  items: CategoricalDiffItem[]
}

export interface TimeseriesDiffPoint {
  time: string
  value_a?: number
  value_b?: number
  diff?: number
  diff_pct?: number
}

export interface TimeseriesDiff {
  time_column: string
  value_column: string
  aligned_points: TimeseriesDiffPoint[]
  only_in_a: Array<Record<string, any>>
  only_in_b: Array<Record<string, any>>
  total_a?: number
  total_b?: number
  total_change_pct?: number
}

export interface CorrelationDiffPair {
  col1: string
  col2: string
  corr_a?: number
  corr_b?: number
  corr_diff?: number
}

export interface CorrelationDiff {
  common_pairs: CorrelationDiffPair[]
}

export interface CompareInsight {
  severity: 'high' | 'medium' | 'low'
  text: string
  category: string
  details?: Record<string, any>
}

export interface CompareSummary {
  headline: string
  insights: CompareInsight[]
  key_metrics: Array<Record<string, any>>
}

export interface CompareResult {
  compare_id?: string
  dataset_a: AnalysisResult
  dataset_b: AnalysisResult
  label_a: string
  label_b: string
  common_columns: string[]
  common_numeric_columns: string[]
  common_categorical_columns: string[]
  common_datetime_columns: string[]
  numeric_diffs: NumericDiff[]
  categorical_diffs: CategoricalDiff[]
  timeseries_diff?: TimeseriesDiff
  correlation_diff?: CorrelationDiff
  summary: CompareSummary
  align_strategy: string
  align_field?: string
}

export type CompareChartType = 'compare_timeseries' | 'compare_correlation' | 'compare_histogram' | 'compare_numeric' | 'compare_categorical' | 'side_by_side'
