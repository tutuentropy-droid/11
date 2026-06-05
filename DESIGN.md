# 数据洞察指挥舱 - 设计文档

## 1. 项目概述

一个面向非专业用户的智能数据分析可视化平台。用户只需拖拽 CSV/Excel 文件，系统在 30 秒内自动完成全套数据分析，并通过沉浸式 3D 交互仪表盘呈现洞察。

### 核心价值
- **零配置**：上传即分析，无需任何参数设置
- **自动洞察**：自动识别数据类型、异常、趋势、相关性
- **3D 沉浸体验**：科技感仪表盘，可漫游、缩放、旋转
- **人话摘要**：自动生成自然语言解读，不懂数据也能看懂

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         前端 (React)                                  │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  文件上传   │  │ 仪表盘布局    │  │ 3D 可视化层   │  │ 摘要面板   │  │
│  │  DragDrop  │  │ Dashboard    │  │ echarts-gl   │  │ Summary   │  │
│  └──────┬─────┘  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
│         │               │                  │                │        │
│         └───────────────┴──────────────────┴────────────────┘        │
│                              │                                        │
│                    React Context / Zustand                           │
│                              │                                        │
│                    Axios / fetch API                                 │
└──────────────────────────────┼───────────────────────────────────────┘
                               │ RESTful JSON
┌──────────────────────────────┼───────────────────────────────────────┐
│                      后端 (Python FastAPI)                            │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  文件接收   │  │  分析引擎     │  │  摘要生成器   │  │ 报告导出   │  │
│  │  Upload    │  │  Analyzer    │  │  Summarizer  │  │ Exporter  │  │
│  └──────┬─────┘  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │
│         │               │                  │                │        │
│         └───────────────┴──────────────────┴────────────────┘        │
│                              │                                        │
│                     pandas / numpy / scipy / statsmodels             │
│                     openpyxl (Excel 支持)                             │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 3. 模块详细设计

### 3.1 后端分析引擎 (Analyzer Engine)

#### 数据处理流水线
```
原始文件 → 格式解析 → 列类型识别 → 质量检测 → 统计计算 → 高级分析 → JSON 输出
```

#### 分析维度清单

| 模块 | 功能 | 输出 |
|------|------|------|
| **ColumnTyper** | 自动识别列类型 | `numeric`, `categorical`, `datetime`, `text`, `boolean` |
| **DataQuality** | 缺失率、重复率、异常值比例 | 质量评分 + 各列详情 |
| **NumericStats** | 均值、中位数、标准差、分位数、IQR | 每列统计摘要 |
| **OutlierDetector** | IQR / Z-Score 异常点检测 | 异常行索引 + 标记 |
| **Correlation** | Pearson/Spearman 相关矩阵 + 强相关对 | 热图数据 + Top 相关 |
| **CategoricalFreq** | 频率、占比、卡方检验 | 柱图/饼图数据 |
| **TimeSeries** | 趋势拆解(STL)、季节性、简单预测(ARIMA/线性) | 趋势线 + 预测区间 |
| **AutoSummarizer** | 基于规则生成自然语言摘要 | 人话洞察卡片 |
| **LLMSummarizer** (可选) | 调用 LLM 润色摘要 | 更自然的叙述 |

#### 输出 JSON Schema
```json
{
  "dataset": { "name": "sales.csv", "rows": 1500, "cols": 12 },
  "columns": [
    {
      "name": "revenue",
      "type": "numeric",
      "missing_rate": 0.02,
      "stats": { "mean": 45200, "median": 42100, "std": 12300, "min": 5000, "max": 120000 },
      "outliers": [142, 387, 1024]
    }
  ],
  "correlations": {
    "matrix": [[1, 0.87], [0.87, 1]],
    "top_pairs": [["revenue", "orders", 0.87]]
  },
  "timeseries": {
    "column": "date",
    "trend": [...],
    "seasonal": [...],
    "forecast": { "values": [...], "upper": [...], "lower": [...] }
  },
  "summary": {
    "headline": "数据整体质量良好，发现 3 个强相关关系",
    "insights": [
      { "severity": "high", "text": "revenue 与 orders 高度相关 (r=0.87)", "viz": "correlation" },
      { "severity": "medium", "text": "第 142、387、1024 行存在异常高 revenue 值", "viz": "scatter" }
    ]
  }
}
```

---

### 3.2 前端可视化系统

#### 技术选型
- **图表引擎**：`echarts` + `echarts-gl` (优先于 Three.js，配置化更快，3D 图表丰富)
- **UI 框架**：React 18 + TypeScript + Tailwind CSS (科技感主题)
- **状态管理**：Zustand (轻量级)
- **文件上传**：react-dropzone

#### 3D 图表类型映射

| 分析结果 | 3D 可视化形式 | 特效 |
|----------|---------------|------|
| 相关性矩阵 | 3D 柱状图 (bar3D) / 3D 散点 | 柱高 = 相关强度，颜色 = 正负 |
| 数值分布 | 3D 直方图 | 异常柱闪烁高亮 (红色脉冲) |
| 多维散点 | 3D 散点图 (scatter3D) | 异常点 = 闪烁红色大球 |
| 时间序列 | 3D 曲面 + 发光曲线 | 发光曲线 = 历史数据，半透明光带 = 预测区间 |
| 分类占比 | 3D 饼图 / 玫瑰图 | 悬浮高亮，点击展开详情 |

#### 漫游交互
- 鼠标拖拽 = 旋转视角
- 滚轮 = 缩放
- 右键拖拽 = 平移
- 点击数据点 = 弹出详情卡片 (指标解释 + 人话解读)
- 图表间可通过"驾驶舱导航面板"快速切换

#### 视觉风格 (未来指挥舱)
```
配色：
  背景：  #0a0e1a (深空蓝黑)
  面板：  #111827 带 rgba(59,130,246,0.05) 发光边
  主色：  #3b82f6 (科技蓝)
  强调：  #06b6d4 (青) / #8b5cf6 (紫)
  警告：  #ef4444 (红) 脉冲闪烁
  文字：  #e2e8f0
  次要：  #94a3b8

字体：  Inter / JetBrains Mono (数据显示)
特效：  CSS box-shadow 发光、backdrop-blur 毛玻璃、keyframes 脉冲动画
```

---

## 4. 数据流与时序

### 4.1 上传分析流程
```
用户拖入文件
    │
    ▼
前端校验大小/格式 (<50MB, .csv/.xlsx)
    │
    ▼
POST /api/upload  (multipart/form-data)
    │
    ▼
后端: pandas.read_csv/excel
    │
    ▼
分析流水线并行执行 (10-20s)
    │
    ▼
返回完整分析 JSON
    │
    ▼
前端路由跳转 /dashboard/:id
    │
    ▼
仪表盘渲染：
  1. 顶部摘要卡片 (关键发现)
  2. 中央 3D 主视图 (默认相关性矩阵)
  3. 左侧图表导航 (可切换)
  4. 右侧详情面板 (点击后显示)
```

### 4.2 分享流程
```
用户点击"导出报告"
    │
    ▼
POST /api/export/:id  (附带当前视图配置)
    │
    ▼
后端生成单文件 HTML (内联所有 CSS/JS/数据)
    │
    ▼
用户下载 .html，可直接在浏览器打开
```

---

## 5. 项目目录结构

```
1011/
├── DESIGN.md                    # 本文档
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 入口
│   │   ├── api/
│   │   │   ├── upload.py        # 文件上传接口
│   │   │   ├── analyze.py       # 分析接口
│   │   │   └── export.py        # 报告导出
│   │   ├── analyzer/
│   │   │   ├── engine.py        # 分析引擎主类
│   │   │   ├── column_types.py  # 列类型识别
│   │   │   ├── stats.py         # 统计计算
│   │   │   ├── outliers.py      # 异常检测
│   │   │   ├── correlation.py   # 相关性分析
│   │   │   ├── categorical.py   # 分类频率
│   │   │   ├── timeseries.py    # 时间序列分析
│   │   │   └── summarizer.py    # 摘要生成
│   │   ├── models/
│   │   │   └── schemas.py       # Pydantic 数据模型
│   │   └── utils/
│   │       ├── file_io.py       # 文件读写
│   │       └── report_template.py  # 导出报告 HTML 模板
│   ├── requirements.txt
│   └── sample_data/             # 测试用 CSV
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── UploadPage.tsx   # 上传页面
│   │   │   └── Dashboard.tsx    # 仪表盘
│   │   ├── components/
│   │   │   ├── upload/
│   │   │   │   └── DropZone.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── SummaryCards.tsx
│   │   │   │   ├── ChartNav.tsx
│   │   │   │   └── DetailPanel.tsx
│   │   │   └── charts3d/
│   │   │       ├── Correlation3D.tsx   # 3D 相关性柱图
│   │   │       ├── Scatter3D.tsx       # 3D 散点图
│   │   │       ├── Histogram3D.tsx     # 3D 直方图
│   │   │       ├── Timeseries3D.tsx    # 3D 时间序列
│   │   │       └── Pie3D.tsx           # 3D 分类饼图
│   │   ├── store/
│   │   │   └── analysisStore.ts  # Zustand 状态
│   │   ├── services/
│   │   │   └── api.ts            # API 封装
│   │   ├── types/
│   │   │   └── index.ts          # TypeScript 类型
│   │   └── styles/
│   │       └── theme.css         # 全局科技感主题
│   └── index.html
└── README.md
```

---

## 6. 关键技术难点与解决方案

### 6.1 大数据量性能
- **问题**：10万行+ 数据在前端渲染 3D 图表卡顿
- **方案**：后端自动采样 (最多 5000 点)，统计聚合，Canvas 渲染而非 SVG

### 6.2 列类型自动识别
- **方案**：多阶段投票
  1. pandas dtypes 初步判断
  2. 正则匹配日期格式
  3. 唯一值比例 <5% 判为分类
  4. 文本长度分布判断文本列

### 6.3 异常点高亮闪烁
- **方案**：echarts 自定义 `series.data[i].itemStyle` + CSS 动画或 echarts graphic 组件定时刷新透明度

### 6.4 导出单文件报告
- **方案**：后端将 echarts CDN、React 运行时、分析 JSON、当前视图配置内联到一个 HTML 文件中

---

## 7. 里程碑

| 阶段 | 内容 | 预计耗时 |
|------|------|----------|
| M1 | 后端分析引擎 + API | - |
| M2 | 前端上传页 + 仪表盘布局 | - |
| M3 | 3D 图表组件 | - |
| M4 | 摘要生成 + 交互详情 | - |
| M5 | 报告导出 + 测试优化 | - |
