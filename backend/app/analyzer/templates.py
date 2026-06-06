from __future__ import annotations
from typing import List, Dict, Any, Callable, Optional
from dataclasses import dataclass, field


@dataclass
class KPIDefinition:
    id: str
    name: str
    description: str
    unit: str = ""
    icon: str = "📊"
    color: str = "blue"
    trend_supported: bool = False


@dataclass
class IndustryTemplate:
    id: str
    name: str
    description: str
    icon: str
    color: str
    keyword_columns: List[str] = field(default_factory=list)
    keyword_patterns: List[str] = field(default_factory=list)
    required_columns: List[str] = field(default_factory=list)
    numeric_indicators: List[str] = field(default_factory=list)
    categorical_indicators: List[str] = field(default_factory=list)
    datetime_indicators: List[str] = field(default_factory=list)
    kpis: List[KPIDefinition] = field(default_factory=list)
    match_score: float = 0.0


ECOMMERCE_TEMPLATE = IndustryTemplate(
    id="ecommerce",
    name="电商行业",
    description="适用于电商交易数据，自动识别GMV、复购率、客单价等核心指标",
    icon="🛒",
    color="blue",
    keyword_columns=[
        "订单号", "order_id", "订单ID", "orderid",
        "用户ID", "user_id", "用户id", "customer_id", "客户id",
        "商品ID", "product_id", "sku_id", "sku",
        "支付金额", "pay_amount", "payment", "销售额", "sales", "amount",
        "订单金额", "order_amount", "交易金额",
        "购买数量", "quantity", "qty", "数量",
        "下单时间", "订单时间", "order_time", "order_date", "购买日期",
        "支付时间", "pay_time", "payment_time",
        "商品类目", "category", "品类", "product_category",
        "是否复购", "is_repurchase", "repurchase",
        "客单价", "aov", "avg_order_value",
        "折扣", "discount", "coupon", "优惠券",
        "运费", "shipping", "freight",
        "退款金额", "refund", "return_amount",
    ],
    keyword_patterns=[
        "gmv", "订单", "购买", "交易", "商品", "sku", "复购", "客单价",
        "conversion", "转化", "购物车", "cart",
    ],
    required_columns=[],
    numeric_indicators=[
        "支付金额", "pay_amount", "销售额", "sales", "amount",
        "订单金额", "order_amount", "交易金额",
        "购买数量", "quantity", "qty", "数量",
        "折扣", "discount", "退款金额", "refund",
    ],
    categorical_indicators=[
        "订单号", "order_id", "用户ID", "user_id", "客户id",
        "商品ID", "product_id", "sku_id", "sku",
        "商品类目", "category", "品类", "product_category",
        "是否复购", "is_repurchase",
    ],
    datetime_indicators=[
        "下单时间", "订单时间", "order_time", "order_date", "购买日期",
        "支付时间", "pay_time", "payment_time",
    ],
    kpis=[
        KPIDefinition(id="gmv", name="GMV (成交总额)", description="一定周期内所有订单的总成交金额", unit="¥", icon="💰", color="blue", trend_supported=True),
        KPIDefinition(id="order_count", name="订单总数", description="有效订单总数量", unit="单", icon="📦", color="cyan"),
        KPIDefinition(id="user_count", name="用户总数", description="下单用户总数", unit="人", icon="👥", color="purple"),
        KPIDefinition(id="aov", name="客单价", description="平均每笔订单的金额", unit="¥", icon="💎", color="blue", trend_supported=True),
        KPIDefinition(id="repurchase_rate", name="复购率", description="多次购买用户占总用户的比例", unit="%", icon="🔄", color="green", trend_supported=True),
        KPIDefinition(id="avg_quantity", name="单件购买数量", description="平均每笔订单包含的商品数量", unit="件", icon="📊", color="yellow"),
        KPIDefinition(id="refund_rate", name="退款率", description="退款金额占总GMV的比例", unit="%", icon="↩️", color="red"),
        KPIDefinition(id="sku_count", name="商品SKU数", description="在售商品SKU总数", unit="个", icon="🏷️", color="cyan"),
    ],
)

RETAIL_TEMPLATE = IndustryTemplate(
    id="retail",
    name="零售行业",
    description="适用于门店零售、连锁零售数据，自动识别坪效、人效、库存周转等指标",
    icon="🏬",
    color="green",
    keyword_columns=[
        "门店", "store", "门店ID", "store_id", "店铺",
        "商品", "product", "商品ID", "product_id", "sku",
        "销量", "sales_qty", "quantity_sold", "销售数量",
        "销售额", "sales_amount", "revenue", "营业额",
        "库存", "inventory", "stock", "库存数量",
        "库存金额", "inventory_value", "stock_value",
        "进价", "cost", "cost_price", "成本",
        "售价", "price", "selling_price", "零售价格",
        "毛利", "gross_profit", "利润", "profit",
        "毛利率", "gross_margin", "profit_margin",
        "店员", "staff", "店员ID", "staff_id", "导购",
        "销售时间", "sale_time", "sale_date", "交易日期",
        "商品类目", "category", "品类",
        "供应商", "supplier", "vendor",
        "进货", "purchase", "进货量",
        "坪效", "sales_per_sqm",
        "人效", "sales_per_staff",
    ],
    keyword_patterns=[
        "门店", "零售", "零售", "库存", "坪效", "人效", "毛利",
        "store", "retail", "inventory", "stock", "margin",
    ],
    required_columns=[],
    numeric_indicators=[
        "销量", "sales_qty", "quantity_sold", "销售数量",
        "销售额", "sales_amount", "revenue", "营业额",
        "库存", "inventory", "stock", "库存数量",
        "库存金额", "inventory_value", "stock_value",
        "进价", "cost", "成本",
        "售价", "price", "selling_price",
        "毛利", "gross_profit", "利润", "profit",
        "毛利率", "gross_margin", "profit_margin",
    ],
    categorical_indicators=[
        "门店", "store", "门店ID", "store_id",
        "商品", "product", "商品ID", "product_id", "sku",
        "店员", "staff", "店员ID", "staff_id", "导购",
        "商品类目", "category", "品类",
        "供应商", "supplier", "vendor",
    ],
    datetime_indicators=[
        "销售时间", "sale_time", "sale_date", "交易日期",
    ],
    kpis=[
        KPIDefinition(id="total_sales", name="总销售额", description="所有门店销售额总和", unit="¥", icon="💰", color="green", trend_supported=True),
        KPIDefinition(id="gross_profit", name="总毛利", description="销售额减去成本后的利润", unit="¥", icon="📈", color="blue", trend_supported=True),
        KPIDefinition(id="gross_margin", name="综合毛利率", description="毛利占销售额的比例", unit="%", icon="📊", color="purple", trend_supported=True),
        KPIDefinition(id="store_count", name="门店数", description="参与统计的门店总数", unit="家", icon="🏬", color="cyan"),
        KPIDefinition(id="avg_store_sales", name="单店日均销售额", description="平均每家门店每天的销售额", unit="¥", icon="🏪", color="green"),
        KPIDefinition(id="sku_count", name="在售SKU数", description="有销售记录的商品SKU数量", unit="个", icon="🏷️", color="yellow"),
        KPIDefinition(id="inventory_turnover", name="库存周转天数", description="库存平均多少天周转一次", unit="天", icon="🔄", color="orange"),
        KPIDefinition(id="top_sku", name="TOP热销商品", description="销量最高的前3个商品", icon="🥇", color="gold"),
    ],
)

SAAS_TEMPLATE = IndustryTemplate(
    id="saas",
    name="SaaS行业",
    description="适用于订阅制SaaS业务数据，自动识别ARR、MRR、Churn、NDR等指标",
    icon="☁️",
    color="purple",
    keyword_columns=[
        "客户ID", "customer_id", "客户id", "租户ID", "tenant_id",
        "公司名称", "company", "company_name", "客户名称",
        "订阅金额", "subscription", "arr", "mrr", "revenue", "收入",
        "订阅开始时间", "start_date", "subscribe_date", "签约日期",
        "订阅结束时间", "end_date", "expire_date", "到期日期",
        "订阅计划", "plan", "tier", "套餐", "版本",
        "月费", "monthly_fee", "年费", "annual_fee",
        "用户数", "user_count", "seats", "席位",
        "活跃度", "active", "活跃用户", "active_users",
        "是否续费", "is_renew", "renewed", "续费",
        "流失", "churned", "churn", "流失用户",
        "客户等级", "tier", "segment",
        "所属行业", "industry",
        "签约代表", "sales_rep", "owner", "客户经理",
        "上一次登录", "last_login",
        "登录次数", "login_count",
    ],
    keyword_patterns=[
        "saas", "订阅", "arr", "mrr", "churn", "流失", "续费",
        "tenant", "租户", "席位", "seats", "ndr",
    ],
    required_columns=[],
    numeric_indicators=[
        "订阅金额", "subscription", "arr", "mrr", "revenue", "收入",
        "月费", "monthly_fee", "年费", "annual_fee",
        "用户数", "user_count", "seats", "席位",
        "活跃度", "登录次数", "login_count",
    ],
    categorical_indicators=[
        "客户ID", "customer_id", "租户ID", "tenant_id",
        "公司名称", "company", "company_name", "客户名称",
        "订阅计划", "plan", "tier", "套餐", "版本",
        "是否续费", "is_renew", "renewed",
        "流失", "churned", "churn",
        "客户等级", "tier", "segment",
        "所属行业", "industry",
        "签约代表", "sales_rep", "owner",
    ],
    datetime_indicators=[
        "订阅开始时间", "start_date", "subscribe_date", "签约日期",
        "订阅结束时间", "end_date", "expire_date", "到期日期",
        "上一次登录", "last_login",
    ],
    kpis=[
        KPIDefinition(id="arr", name="ARR (年度经常性收入)", description="年化的经常性订阅收入总和", unit="$", icon="📈", color="purple", trend_supported=True),
        KPIDefinition(id="mrr", name="MRR (月度经常性收入)", description="当月的经常性订阅收入", unit="$", icon="💰", color="blue", trend_supported=True),
        KPIDefinition(id="customer_count", name="付费客户数", description="当前有效订阅的客户总数", unit="家", icon="🏢", color="cyan"),
        KPIDefinition(id="churn_rate", name="客户流失率 (Churn)", description="流失客户占总客户数的比例", unit="%", icon="📉", color="red", trend_supported=True),
        KPIDefinition(id="revenue_churn", name="收入流失率", description="流失收入占总MRR的比例", unit="%", icon="💸", color="orange"),
        KPIDefinition(id="acv", name="平均客户价值 (ACV)", description="平均每个客户的年合同金额", unit="$", icon="💎", color="purple"),
        KPIDefinition(id="renewal_rate", name="续费率", description="到期客户中选择续费的比例", unit="%", icon="🔄", color="green", trend_supported=True),
        KPIDefinition(id="ndr", name="净收入留存率 (NDR)", description="考虑扩张、萎缩和流失后的净收入留存", unit="%", icon="📊", color="green"),
    ],
)

FINANCE_TEMPLATE = IndustryTemplate(
    id="finance",
    name="财务会计",
    description="适用于财务数据、会计报表、收支明细，自动识别营收、成本、利润、现金流等指标",
    icon="💹",
    color="gold",
    keyword_columns=[
        "会计期间", "period", "fiscal_period", "账期",
        "科目", "account", "account_code", "科目编码", "科目名称",
        "借方", "debit", "debit_amount", "借方发生额",
        "贷方", "credit", "credit_amount", "贷方发生额",
        "余额", "balance", "期末余额",
        "收入", "revenue", "income", "营业收入",
        "成本", "cost", "cogs", "营业成本",
        "费用", "expense", "费用金额",
        "利润", "profit", "net_profit", "净利润",
        "毛利率", "gross_margin",
        "利润率", "profit_margin", "净利率",
        "现金流", "cash_flow", "现金流入", "现金流出",
        "资产", "assets",
        "负债", "liabilities",
        "所有者权益", "equity", "所有者权益合计",
        "应收账款", "accounts_receivable", "ar",
        "应付账款", "accounts_payable", "ap",
        "部门", "department", "dept", "成本中心",
        "项目", "project", "项目ID", "project_id",
        "预算", "budget", "预算金额",
        "实际发生", "actual", "实际金额",
        "税率", "tax_rate",
        "税金", "tax", "tax_amount",
        "凭证号", "voucher", "voucher_no",
        "交易日期", "transaction_date", "post_date", "记账日期",
    ],
    keyword_patterns=[
        "财务", "会计", "科目", "借方", "贷方", "凭证", "现金流",
        "资产负债", "利润", "budget", "财务报表",
    ],
    required_columns=[],
    numeric_indicators=[
        "借方", "debit", "借方发生额",
        "贷方", "credit", "贷方发生额",
        "余额", "balance", "期末余额",
        "收入", "revenue", "income", "营业收入",
        "成本", "cost", "cogs", "营业成本",
        "费用", "expense", "费用金额",
        "利润", "profit", "net_profit", "净利润",
        "毛利率", "gross_margin",
        "利润率", "profit_margin", "净利率",
        "现金流", "cash_flow", "现金流入", "现金流出",
        "资产", "assets",
        "负债", "liabilities",
        "所有者权益", "equity",
        "应收账款", "accounts_receivable",
        "应付账款", "accounts_payable",
        "预算", "budget", "预算金额",
        "实际发生", "actual", "实际金额",
        "税金", "tax", "tax_amount",
    ],
    categorical_indicators=[
        "会计期间", "period", "fiscal_period", "账期",
        "科目", "account", "account_code", "科目编码", "科目名称",
        "部门", "department", "dept", "成本中心",
        "项目", "project", "project_id",
        "凭证号", "voucher", "voucher_no",
    ],
    datetime_indicators=[
        "交易日期", "transaction_date", "post_date", "记账日期",
    ],
    kpis=[
        KPIDefinition(id="total_revenue", name="营业总收入", description="统计周期内所有营业收入之和", unit="¥", icon="💰", color="gold", trend_supported=True),
        KPIDefinition(id="total_cost", name="营业总成本", description="统计周期内的成本与费用合计", unit="¥", icon="💸", color="red"),
        KPIDefinition(id="gross_profit", name="毛利润", description="营业收入减去营业成本", unit="¥", icon="📈", color="green", trend_supported=True),
        KPIDefinition(id="net_profit", name="净利润", description="扣除所有费用和税费后的利润", unit="¥", icon="🎯", color="blue", trend_supported=True),
        KPIDefinition(id="gross_margin", name="毛利率", description="毛利占营业收入的百分比", unit="%", icon="📊", color="purple", trend_supported=True),
        KPIDefinition(id="net_margin", name="净利率", description="净利润占营业收入的百分比", unit="%", icon="📊", color="green", trend_supported=True),
        KPIDefinition(id="ar_balance", name="应收账款余额", description="期末尚未收回的应收账款总额", unit="¥", icon="📋", color="orange"),
        KPIDefinition(id="cash_flow_net", name="净现金流", description="现金流入减去现金流出", unit="¥", icon="💹", color="blue", trend_supported=True),
    ],
)

GENERAL_TEMPLATE = IndustryTemplate(
    id="general",
    name="通用数据分析",
    description="通用数据分析模板，适用于所有类型的数据",
    icon="📊",
    color="gray",
    kpis=[
        KPIDefinition(id="rows", name="数据行数", description="数据集的总行数", unit="行", icon="📋", color="gray"),
        KPIDefinition(id="cols", name="数据列数", description="数据集的总列数", unit="列", icon="📋", color="gray"),
    ],
)

INDUSTRY_TEMPLATES: Dict[str, IndustryTemplate] = {
    "ecommerce": ECOMMERCE_TEMPLATE,
    "retail": RETAIL_TEMPLATE,
    "saas": SAAS_TEMPLATE,
    "finance": FINANCE_TEMPLATE,
    "general": GENERAL_TEMPLATE,
}


def get_all_templates() -> List[IndustryTemplate]:
    return list(INDUSTRY_TEMPLATES.values())


def get_template(template_id: str) -> Optional[IndustryTemplate]:
    return INDUSTRY_TEMPLATES.get(template_id)
