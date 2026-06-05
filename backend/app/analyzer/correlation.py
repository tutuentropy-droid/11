from typing import List, Tuple, Optional
import pandas as pd
import numpy as np

from ..models.schemas import CorrelationResult


def compute_correlation(df: pd.DataFrame, numeric_cols: List[str]) -> Optional[CorrelationResult]:
    if len(numeric_cols) < 2:
        return None
    data = df[numeric_cols].copy()
    for col in numeric_cols:
        data[col] = pd.to_numeric(data[col], errors="coerce")
    corr = data.corr(method="pearson")
    corr = corr.round(4)
    corr = corr.fillna(0.0)

    matrix: List[List[float]] = []
    for _, row in corr.iterrows():
        matrix.append([float(v) for v in row.tolist()])

    pairs: List[Tuple[str, str, float]] = []
    for i, c1 in enumerate(numeric_cols):
        for j, c2 in enumerate(numeric_cols):
            if i < j:
                val = float(corr.iloc[i, j])
                if not np.isnan(val):
                    pairs.append((c1, c2, val))
    pairs.sort(key=lambda x: abs(x[2]), reverse=True)
    top_pairs = [[p[0], p[1], round(p[2], 4)] for p in pairs[:10]]

    return CorrelationResult(columns=numeric_cols, matrix=matrix, top_pairs=top_pairs)
