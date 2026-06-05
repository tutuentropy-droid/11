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


class AnalysisResult(BaseModel):
    task_id: Optional[str] = None
    dataset: DatasetInfo
    columns: List[ColumnInfo]
    correlations: Optional[CorrelationResult] = None
    categorical_freq: List[CategoricalFrequency] = Field(default_factory=list)
    timeseries: Optional[TimeSeriesResult] = None
    summary: SummaryResult
    sampled_data: Optional[List[Dict[str, Any]]] = None
