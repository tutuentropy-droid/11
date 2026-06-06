from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Union


class ColumnStats(BaseModel):
    mean: Optional[float] = None
    median: Optional[float] = None
    std: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    q25: Optional[float] = None
    q75: Optional[float] = None
    iqr: Optional[float] = None


class ColumnInfo(BaseModel):
    name: str
    type: str
    missing_rate: float
    unique_count: int
    stats: Optional[ColumnStats] = None
    outliers: List[int] = Field(default_factory=list)
    categories: Optional[List[Dict[str, Any]]] = None
    sample: List[Any] = Field(default_factory=list)


class DatasetInfo(BaseModel):
    name: str
    rows: int
    cols: int
    total_missing_rate: float
    duplicate_rows: int


class CorrelationResult(BaseModel):
    columns: List[str]
    matrix: List[List[float]]
    top_pairs: List[List[Any]]


class CategoricalFrequency(BaseModel):
    column: str
    values: List[Dict[str, Any]]


class TimeSeriesResult(BaseModel):
    time_column: str
    value_column: str
    data_points: List[Dict[str, Any]]
    trend: List[Dict[str, Any]] = Field(default_factory=list)
    seasonal: List[Dict[str, Any]] = Field(default_factory=list)
    forecast: Optional[Dict[str, Any]] = None


class Insight(BaseModel):
    severity: str
    text: str
    viz: str
    details: Optional[Dict[str, Any]] = None


class SummaryResult(BaseModel):
    headline: str
    insights: List[Insight]


class OutlierStoryCard(BaseModel):
    row_index: int
    column: str
    story: str
    actual_value: float
    expected_min: float
    expected_max: float
    deviation_percent: float
    direction: str
    context_fields: Dict[str, Any] = Field(default_factory=dict)


class KPIDefinition(BaseModel):
    id: str
    name: str
    description: str
    unit: str = ""
    icon: str = "📊"
    color: str = "blue"
    trend_supported: bool = False


class MatchScoreItem(BaseModel):
    template_id: str
    score: float


class KPITrendPoint(BaseModel):
    period: str
    kpis: Dict[str, Any]


class IndustryAnalysis(BaseModel):
    template_id: str
    template_name: str
    template_icon: str
    template_color: str
    template_description: str
    match_score: float
    match_scores: List[MatchScoreItem] = Field(default_factory=list)
    kpi_definitions: List[KPIDefinition] = Field(default_factory=list)
    kpi_values: Dict[str, Any] = Field(default_factory=dict)
    kpi_trends: List[KPITrendPoint] = Field(default_factory=list)
    matched_columns: Dict[str, str] = Field(default_factory=dict)


class QualityFixSuggestion(BaseModel):
    fix_type: str
    column: Optional[str] = None
    description: str
    impact: str
    fill_strategy: Optional[str] = None
    fill_value: Optional[Union[int, float, str]] = None


class DataQualityIssue(BaseModel):
    issue_type: str
    severity: str
    column: str
    row_indices: List[int]
    count: int
    message: str
    details: Dict[str, Any] = Field(default_factory=dict)
    suggestion: Optional[QualityFixSuggestion] = None
    fixed: bool = False


class QualityCategory(BaseModel):
    score: float
    score_percentage: float
    grade: str
    breakdown: Dict[str, float] = Field(default_factory=dict)
    issue_counts: Dict[str, int] = Field(default_factory=dict)


class DataQualityReport(BaseModel):
    quality: QualityCategory
    issues: List[DataQualityIssue]
    total_rows: int
    total_columns: int
    total_cells: int
    total_issues: int
    total_affected_rows: int


class AnalysisResult(BaseModel):
    task_id: Optional[str] = None
    dataset: DatasetInfo
    columns: List[ColumnInfo]
    correlations: Optional[CorrelationResult] = None
    categorical_freq: List[CategoricalFrequency] = Field(default_factory=list)
    timeseries: Optional[TimeSeriesResult] = None
    summary: SummaryResult
    sampled_data: Optional[List[Dict[str, Any]]] = None
    outlier_stories: List[OutlierStoryCard] = Field(default_factory=list)
    industry: Optional[IndustryAnalysis] = None
    quality_report: Optional[DataQualityReport] = None


class CleanRequest(BaseModel):
    task_id: str
    issue_index: Optional[int] = None
    fix_all: bool = False


class CleanResult(BaseModel):
    task_id: str
    success: bool
    message: str
    fixed_issues: List[int] = Field(default_factory=list)
    quality_before: Optional[QualityCategory] = None
    quality_after: Optional[QualityCategory] = None
    updated_analysis: Optional[AnalysisResult] = None


class NumericDiff(BaseModel):
    column: str
    mean_a: Optional[float] = None
    mean_b: Optional[float] = None
    mean_change_pct: Optional[float] = None
    median_a: Optional[float] = None
    median_b: Optional[float] = None
    median_change_pct: Optional[float] = None
    std_a: Optional[float] = None
    std_b: Optional[float] = None


class CategoricalDiffItem(BaseModel):
    category: str
    count_a: int
    count_b: int
    count_change: int
    pct_a: float
    pct_b: float
    pct_change: float


class CategoricalDiff(BaseModel):
    column: str
    items: List[CategoricalDiffItem]


class TimeseriesDiffPoint(BaseModel):
    time: str
    value_a: Optional[float] = None
    value_b: Optional[float] = None
    diff: Optional[float] = None
    diff_pct: Optional[float] = None


class TimeseriesDiff(BaseModel):
    time_column: str
    value_column: str
    aligned_points: List[TimeseriesDiffPoint]
    only_in_a: List[Dict[str, Any]] = Field(default_factory=list)
    only_in_b: List[Dict[str, Any]] = Field(default_factory=list)
    total_a: Optional[float] = None
    total_b: Optional[float] = None
    total_change_pct: Optional[float] = None


class CorrelationDiffPair(BaseModel):
    col1: str
    col2: str
    corr_a: Optional[float] = None
    corr_b: Optional[float] = None
    corr_diff: Optional[float] = None


class CorrelationDiff(BaseModel):
    common_pairs: List[CorrelationDiffPair] = Field(default_factory=list)


class CompareInsight(BaseModel):
    severity: str
    text: str
    category: str
    details: Optional[Dict[str, Any]] = None


class CompareSummary(BaseModel):
    headline: str
    insights: List[CompareInsight]
    key_metrics: List[Dict[str, Any]] = Field(default_factory=list)


class CompareResult(BaseModel):
    compare_id: Optional[str] = None
    dataset_a: AnalysisResult
    dataset_b: AnalysisResult
    label_a: str
    label_b: str
    common_columns: List[str]
    common_numeric_columns: List[str]
    common_categorical_columns: List[str]
    common_datetime_columns: List[str]
    numeric_diffs: List[NumericDiff] = Field(default_factory=list)
    categorical_diffs: List[CategoricalDiff] = Field(default_factory=list)
    timeseries_diff: Optional[TimeseriesDiff] = None
    correlation_diff: Optional[CorrelationDiff] = None
    summary: CompareSummary
    align_strategy: str
    align_field: Optional[str] = None
