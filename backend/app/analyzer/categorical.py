from typing import List
import pandas as pd

from ..models.schemas import CategoricalFrequency


def compute_categorical_freq(df: pd.DataFrame, cat_cols: List[str], top_k: int = 10) -> List[CategoricalFrequency]:
    results: List[CategoricalFrequency] = []
    for col in cat_cols:
        series = df[col].dropna().astype(str)
        if len(series) == 0:
            continue
        counts = series.value_counts().head(top_k)
        total = len(series)
        values = []
        for cat, count in counts.items():
            values.append({
                "name": str(cat),
                "count": int(count),
                "percentage": round(float(count) / total * 100, 2),
            })
        results.append(CategoricalFrequency(column=col, values=values))
    return results
