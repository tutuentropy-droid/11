from __future__ import annotations
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np
import re

from .templates import (
    IndustryTemplate,
    get_all_templates,
    get_template,
    GENERAL_TEMPLATE,
    ECOMMERCE_TEMPLATE,
    RETAIL_TEMPLATE,
    SAAS_TEMPLATE,
    FINANCE_TEMPLATE,
)
from .column_types import classify_all_columns


def _normalize_name(name: str) -> str:
    return re.sub(r"[\s_\-]+", "", name.lower())


def _find_matching_column(columns: List[str], keywords: List[str]) -> Optional[str]:
    normalized_cols = {_normalize_name(c): c for c in columns}
    for kw in keywords:
        norm_kw = _normalize_name(kw)
        for norm_col, original_col in normalized_cols.items():
            if norm_kw == norm_col or norm_kw in norm_col:
                return original_col
    return None


class IndustryMatcher:
    def __init__(self):
        self.templates = get_all_templates()

    def _score_template(
        self,
        template: IndustryTemplate,
        df: pd.DataFrame,
        col_types: Dict[str, str],
    ) -> float:
        score = 0.0
        columns = list(df.columns)
        normalized_cols = [_normalize_name(c) for c in columns]

        matched_keyword_count = 0
        for kw in template.keyword_columns:
            norm_kw = _normalize_name(kw)
            for norm_col in normalized_cols:
                if norm_kw == norm_col or norm_kw in norm_col:
                    matched_keyword_count += 1
                    break

        if matched_keyword_count > 0:
            score += min(matched_keyword_count * 15, 60)

        matched_pattern_count = 0
        for pattern in template.keyword_patterns:
            norm_pattern = _normalize_name(pattern)
            for norm_col in normalized_cols:
                if norm_pattern in norm_col:
                    matched_pattern_count += 1
                    break
        score += min(matched_pattern_count * 8, 30)

        type_match = 0
        for kw in template.numeric_indicators:
            col = _find_matching_column(columns, [kw])
            if col and col_types.get(col) == "numeric":
                type_match += 1
        for kw in template.categorical_indicators:
            col = _find_matching_column(columns, [kw])
            if col and col_types.get(col) in ("categorical", "boolean"):
                type_match += 1
        for kw in template.datetime_indicators:
            col = _find_matching_column(columns, [kw])
            if col and col_types.get(col) == "datetime":
                type_match += 1
        score += min(type_match * 5, 20)

        return score

    def match(self, df: pd.DataFrame) -> Tuple[IndustryTemplate, List[Tuple[str, float]]]:
        col_types = classify_all_columns(df)
        scores: List[Tuple[str, float]] = []

        for tpl in self.templates:
            if tpl.id == "general":
                continue
            score = self._score_template(tpl, df, col_types)
            scores.append((tpl.id, score))

        scores.sort(key=lambda x: x[1], reverse=True)

        if scores and scores[0][1] > 20:
            best_template = get_template(scores[0][0])
            best_template.match_score = scores[0][1]
            return best_template, scores

        GENERAL_TEMPLATE.match_score = 0.0
        return GENERAL_TEMPLATE, scores


class IndustryKPICalculator:
    def __init__(self, df: pd.DataFrame, template: IndustryTemplate):
        self.df = df.copy()
        self.template = template
        self.columns = list(df.columns)
        self.col_types = classify_all_columns(df)
        self._col_cache: Dict[str, Optional[str]] = {}

    def _find_col(self, keywords: List[str]) -> Optional[str]:
        key = "|".join(keywords)
        if key in self._col_cache:
            return self._col_cache[key]
        result = _find_matching_column(self.columns, keywords)
        self._col_cache[key] = result
        return result

    def _safe_sum(self, col: Optional[str]) -> Optional[float]:
        if col is None or col not in self.df.columns:
            return None
        series = pd.to_numeric(self.df[col], errors="coerce").dropna()
        if series.empty:
            return None
        return round(float(series.sum()), 2)

    def _safe_mean(self, col: Optional[str]) -> Optional[float]:
        if col is None or col not in self.df.columns:
            return None
        series = pd.to_numeric(self.df[col], errors="coerce").dropna()
        if series.empty:
            return None
        return round(float(series.mean()), 2)

    def _safe_nunique(self, col: Optional[str]) -> Optional[int]:
        if col is None or col not in self.df.columns:
            return None
        return int(self.df[col].nunique(dropna=True))

    def _safe_count(self, col: Optional[str]) -> Optional[int]:
        if col is None or col not in self.df.columns:
            return None
        return int(self.df[col].notna().sum())

    def _calculate_ecommerce(self) -> Dict[str, Any]:
        kpis = {}
        amount_col = self._find_col([
            "支付金额", "pay_amount", "销售额", "sales", "amount",
            "订单金额", "order_amount", "交易金额",
        ])
        order_col = self._find_col(["订单号", "order_id", "订单ID", "orderid"])
        user_col = self._find_col([
            "用户ID", "user_id", "用户id", "customer_id", "客户id",
        ])
        qty_col = self._find_col(["购买数量", "quantity", "qty", "数量"])
        sku_col = self._find_col(["商品ID", "product_id", "sku_id", "sku"])
        refund_col = self._find_col(["退款金额", "refund", "return_amount"])
        repurchase_col = self._find_col(["是否复购", "is_repurchase", "repurchase"])

        gmv = self._safe_sum(amount_col)
        order_count = self._safe_nunique(order_col) if order_col else self._safe_count(amount_col)
        user_count = self._safe_nunique(user_col)
        sku_count = self._safe_nunique(sku_col)
        refund_total = self._safe_sum(refund_col)
        avg_qty = self._safe_mean(qty_col)

        kpis["gmv"] = gmv
        kpis["order_count"] = order_count
        kpis["user_count"] = user_count
        kpis["sku_count"] = sku_count
        kpis["avg_quantity"] = avg_qty

        if gmv and order_count and order_count > 0:
            kpis["aov"] = round(gmv / order_count, 2)
        else:
            kpis["aov"] = None

        if repurchase_col and repurchase_col in self.df.columns and user_col:
            try:
                user_purchase_counts = self.df.groupby(user_col)[order_col or amount_col].nunique()
                repurchase_users = (user_purchase_counts > 1).sum()
                total_users = user_purchase_counts.count()
                if total_users > 0:
                    kpis["repurchase_rate"] = round(repurchase_users / total_users * 100, 2)
                else:
                    kpis["repurchase_rate"] = None
            except Exception:
                kpis["repurchase_rate"] = None
        elif user_col and order_col:
            try:
                user_purchase_counts = self.df.groupby(user_col)[order_col].nunique()
                repurchase_users = (user_purchase_counts > 1).sum()
                total_users = user_purchase_counts.count()
                if total_users > 0:
                    kpis["repurchase_rate"] = round(repurchase_users / total_users * 100, 2)
                else:
                    kpis["repurchase_rate"] = None
            except Exception:
                kpis["repurchase_rate"] = None
        else:
            kpis["repurchase_rate"] = None

        if gmv and refund_total and gmv > 0:
            kpis["refund_rate"] = round(refund_total / gmv * 100, 2)
        else:
            kpis["refund_rate"] = None

        return kpis

    def _calculate_retail(self) -> Dict[str, Any]:
        kpis = {}
        sales_col = self._find_col([
            "销售额", "sales_amount", "revenue", "营业额",
            "支付金额", "pay_amount", "sales", "amount",
        ])
        cost_col = self._find_col(["进价", "cost", "成本", "cost_price"])
        profit_col = self._find_col(["毛利", "gross_profit", "利润", "profit"])
        store_col = self._find_col(["门店", "store", "门店ID", "store_id", "店铺"])
        sku_col = self._find_col(["商品", "product", "商品ID", "product_id", "sku"])
        qty_col = self._find_col(["销量", "sales_qty", "quantity_sold", "销售数量", "购买数量"])
        stock_col = self._find_col(["库存", "inventory", "stock", "库存数量"])
        date_col = self._find_col(["销售时间", "sale_time", "sale_date", "交易日期", "下单时间"])

        total_sales = self._safe_sum(sales_col)
        total_cost = self._safe_sum(cost_col)
        store_count = self._safe_nunique(store_col)
        sku_count = self._safe_nunique(sku_col)

        kpis["total_sales"] = total_sales
        kpis["store_count"] = store_count
        kpis["sku_count"] = sku_count

        if profit_col:
            gross_profit = self._safe_sum(profit_col)
        elif total_sales and total_cost:
            gross_profit = round(total_sales - total_cost, 2)
        else:
            gross_profit = None
        kpis["gross_profit"] = gross_profit

        if total_sales and gross_profit and total_sales > 0:
            kpis["gross_margin"] = round(gross_profit / total_sales * 100, 2)
        else:
            kpis["gross_margin"] = None

        if total_sales and store_count and store_count > 0:
            days = 1
            if date_col and date_col in self.df.columns:
                try:
                    dates = pd.to_datetime(self.df[date_col], errors="coerce").dropna()
                    if not dates.empty:
                        days = max((dates.max() - dates.min()).days, 1)
                except Exception:
                    pass
            kpis["avg_store_sales"] = round(total_sales / store_count / days, 2)
        else:
            kpis["avg_store_sales"] = None

        total_sales_qty = self._safe_sum(qty_col) if qty_col else None
        avg_stock = self._safe_mean(stock_col) if stock_col else None
        if total_sales_qty and avg_stock and avg_stock > 0:
            kpis["inventory_turnover"] = round(avg_stock / (total_sales_qty / 30), 1) if total_sales_qty else None
        else:
            kpis["inventory_turnover"] = None

        if sku_col and qty_col:
            try:
                sku_sales = self.df.groupby(sku_col)[qty_col].sum().sort_values(ascending=False)
                top_skus = sku_sales.head(3).index.tolist()
                kpis["top_sku"] = [str(s) for s in top_skus]
            except Exception:
                kpis["top_sku"] = None
        else:
            kpis["top_sku"] = None

        return kpis

    def _calculate_saas(self) -> Dict[str, Any]:
        kpis = {}
        revenue_col = self._find_col([
            "订阅金额", "subscription", "arr", "mrr", "revenue", "收入",
            "月费", "monthly_fee",
        ])
        mrr_col = self._find_col(["mrr", "月度经常性收入"])
        arr_col = self._find_col(["arr", "年度经常性收入"])
        customer_col = self._find_col(["客户ID", "customer_id", "客户id", "租户ID", "tenant_id", "公司名称"])
        churn_col = self._find_col(["流失", "churned", "churn", "流失用户"])
        renew_col = self._find_col(["是否续费", "is_renew", "renewed", "续费"])
        seats_col = self._find_col(["用户数", "user_count", "seats", "席位"])
        start_date_col = self._find_col(["订阅开始时间", "start_date", "subscribe_date", "签约日期"])
        end_date_col = self._find_col(["订阅结束时间", "end_date", "expire_date", "到期日期"])

        customer_count = self._safe_nunique(customer_col)
        total_revenue = self._safe_sum(revenue_col)

        if mrr_col:
            mrr = self._safe_sum(mrr_col)
        elif arr_col:
            arr_val = self._safe_sum(arr_col)
            mrr = round(arr_val / 12, 2) if arr_val else None
        elif revenue_col:
            mrr = total_revenue
        else:
            mrr = None

        if arr_col:
            arr = self._safe_sum(arr_col)
        elif mrr:
            arr = round(mrr * 12, 2)
        else:
            arr = None

        kpis["arr"] = arr
        kpis["mrr"] = mrr
        kpis["customer_count"] = customer_count

        if customer_count and customer_count > 0 and arr:
            kpis["acv"] = round(arr / customer_count, 2)
        else:
            kpis["acv"] = None

        if churn_col and churn_col in self.df.columns and customer_col:
            try:
                churned = self.df[churn_col].astype(str).str.lower().isin(["1", "true", "yes", "是", "y", "t"]).sum()
                total = self.df[customer_col].nunique()
                if total > 0:
                    kpis["churn_rate"] = round(churned / total * 100, 2)
                else:
                    kpis["churn_rate"] = None
            except Exception:
                kpis["churn_rate"] = None
        elif end_date_col and customer_col:
            try:
                now = pd.Timestamp.now()
                expired = self.df[pd.to_datetime(self.df[end_date_col], errors="coerce") < now][customer_col].nunique()
                total = self.df[customer_col].nunique()
                if total > 0:
                    kpis["churn_rate"] = round(expired / total * 100, 2)
                else:
                    kpis["churn_rate"] = None
            except Exception:
                kpis["churn_rate"] = None
        else:
            kpis["churn_rate"] = None

        if kpis.get("churn_rate") and mrr and customer_count and customer_count > 0:
            avg_mrr_per_customer = mrr / customer_count
            churned_customers = int(customer_count * kpis["churn_rate"] / 100)
            revenue_churn = churned_customers * avg_mrr_per_customer
            kpis["revenue_churn"] = round(revenue_churn / mrr * 100, 2) if mrr > 0 else None
        else:
            kpis["revenue_churn"] = None

        if renew_col and renew_col in self.df.columns:
            try:
                renewed = self.df[renew_col].astype(str).str.lower().isin(["1", "true", "yes", "是", "y", "t"]).sum()
                total = self.df[renew_col].notna().sum()
                if total > 0:
                    kpis["renewal_rate"] = round(renewed / total * 100, 2)
                else:
                    kpis["renewal_rate"] = None
            except Exception:
                kpis["renewal_rate"] = None
        else:
            kpis["renewal_rate"] = None

        if kpis.get("renewal_rate") is not None:
            kpis["ndr"] = round(kpis["renewal_rate"], 2)
        else:
            kpis["ndr"] = None

        return kpis

    def _calculate_finance(self) -> Dict[str, Any]:
        kpis = {}
        revenue_col = self._find_col(["收入", "revenue", "income", "营业收入"])
        cost_col = self._find_col(["成本", "cost", "cogs", "营业成本"])
        expense_col = self._find_col(["费用", "expense", "费用金额"])
        profit_col = self._find_col(["利润", "profit", "net_profit", "净利润"])
        gp_col = self._find_col(["毛利", "gross_profit"])
        ar_col = self._find_col(["应收账款", "accounts_receivable", "ar"])
        cash_in_col = self._find_col(["现金流", "cash_flow", "现金流入"])
        cash_out_col = self._find_col(["现金流出"])
        debit_col = self._find_col(["借方", "debit", "debit_amount", "借方发生额"])
        credit_col = self._find_col(["贷方", "credit", "credit_amount", "贷方发生额"])

        total_revenue = self._safe_sum(revenue_col)
        total_cost = self._safe_sum(cost_col)
        total_expense = self._safe_sum(expense_col)
        total_debit = self._safe_sum(debit_col)
        total_credit = self._safe_sum(credit_col)

        if total_revenue is None and total_credit is not None:
            total_revenue = total_credit
        if total_cost is None and total_debit is not None:
            total_cost = total_debit

        kpis["total_revenue"] = total_revenue

        if total_cost is not None and total_expense is not None:
            kpis["total_cost"] = round(total_cost + total_expense, 2)
        elif total_cost is not None:
            kpis["total_cost"] = total_cost
        elif total_expense is not None:
            kpis["total_cost"] = total_expense
        else:
            kpis["total_cost"] = None

        if gp_col:
            gross_profit = self._safe_sum(gp_col)
        elif total_revenue and total_cost:
            gross_profit = round(total_revenue - total_cost, 2)
        else:
            gross_profit = None
        kpis["gross_profit"] = gross_profit

        if profit_col:
            kpis["net_profit"] = self._safe_sum(profit_col)
        elif gross_profit is not None and total_expense is not None:
            kpis["net_profit"] = round(gross_profit - total_expense, 2)
        else:
            kpis["net_profit"] = gross_profit

        if total_revenue and gross_profit and total_revenue > 0:
            kpis["gross_margin"] = round(gross_profit / total_revenue * 100, 2)
        else:
            kpis["gross_margin"] = None

        if total_revenue and kpis["net_profit"] and total_revenue > 0:
            kpis["net_margin"] = round(kpis["net_profit"] / total_revenue * 100, 2)
        else:
            kpis["net_margin"] = None

        if ar_col:
            kpis["ar_balance"] = self._safe_sum(ar_col)
        else:
            kpis["ar_balance"] = None

        cash_in = self._safe_sum(cash_in_col)
        cash_out = self._safe_sum(cash_out_col)
        if cash_in is not None and cash_out is not None:
            kpis["cash_flow_net"] = round(cash_in - cash_out, 2)
        elif cash_in is not None:
            kpis["cash_flow_net"] = cash_in
        else:
            kpis["cash_flow_net"] = total_revenue

        return kpis

    def _calculate_general(self) -> Dict[str, Any]:
        return {
            "rows": len(self.df),
            "cols": len(self.columns),
        }

    def calculate(self) -> Dict[str, Any]:
        calc_map = {
            "ecommerce": self._calculate_ecommerce,
            "retail": self._calculate_retail,
            "saas": self._calculate_saas,
            "finance": self._calculate_finance,
            "general": self._calculate_general,
        }
        calc_func = calc_map.get(self.template.id, self._calculate_general)
        return calc_func()

    def calculate_kpi_trends(self, time_col_keywords: List[str] = None) -> List[Dict[str, Any]]:
        if time_col_keywords is None:
            time_col_keywords = [
                "日期", "date", "时间", "time", "下单时间", "订单时间",
                "销售时间", "交易日期", "订阅开始时间", "记账日期",
            ]
        time_col = self._find_col(time_col_keywords)
        if not time_col or time_col not in self.df.columns:
            return []

        try:
            dates = pd.to_datetime(self.df[time_col], errors="coerce")
            if dates.isna().all():
                return []

            df_temp = self.df.copy()
            df_temp["_date"] = dates
            df_temp = df_temp.dropna(subset=["_date"])

            if df_temp.empty:
                return []

            df_temp["_period"] = df_temp["_date"].dt.to_period("M")
            period_groups = df_temp.groupby("_period")

            trends = []
            for period, group in period_groups:
                period_calc = IndustryKPICalculator(group, self.template)
                period_kpis = period_calc.calculate()
                trends.append({
                    "period": str(period),
                    "kpis": period_kpis,
                })
            trends.sort(key=lambda x: x["period"])
            return trends
        except Exception:
            return []


def detect_industry_and_calculate(df: pd.DataFrame) -> Dict[str, Any]:
    matcher = IndustryMatcher()
    template, scores = matcher.match(df)

    calculator = IndustryKPICalculator(df, template)
    kpi_values = calculator.calculate()
    kpi_trends = calculator.calculate_kpi_trends()

    matched_columns = {}
    for kpi_def in template.kpis:
        for kw_list in [
            template.numeric_indicators,
            template.categorical_indicators,
            template.datetime_indicators,
        ]:
            col = _find_matching_column(list(df.columns), kw_list)
            if col:
                matched_columns[kpi_def.id] = col

    return {
        "template_id": template.id,
        "template_name": template.name,
        "template_icon": template.icon,
        "template_color": template.color,
        "template_description": template.description,
        "match_score": template.match_score,
        "match_scores": [{"template_id": tid, "score": score} for tid, score in scores],
        "kpi_definitions": [
            {
                "id": k.id,
                "name": k.name,
                "description": k.description,
                "unit": k.unit,
                "icon": k.icon,
                "color": k.color,
                "trend_supported": k.trend_supported,
            }
            for k in template.kpis
        ],
        "kpi_values": kpi_values,
        "kpi_trends": kpi_trends,
        "matched_columns": matched_columns,
    }
