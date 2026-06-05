# 🛰️ 数据洞察指挥舱 (Data Insight Command Center)

> 拖入一个乱七八糟的 CSV/Excel，30 秒内出来既漂亮又能讲故事的 3D 交互报告。

## ✨ 特性

- **零配置分析**：自动识别列类型、缺失率、均值中位数、分布、异常点、强相关性
- **时间序列智能**：自动趋势拆解、季节性分析、线性预测 + 置信区间
- **3D 沉浸可视化**：基于 `echarts + echarts-gl` 的可旋转缩放三维图表
  - 🔗 相关性 3D 柱状图（柱高=相关强度，颜色=正负）
  - ✨ 3D 散点图（异常点红色脉冲闪烁）
  - 📊 3D 分布直方图
  - 📈 时间序列曲面 + 发光曲线（预测部分半透明光带）
  - 🥧 3D 分类饼图
- **人话洞察摘要**：基于规则自动生成严重度分级的关键发现
- **未来指挥舱风格**：深空蓝黑背景、HUD 角标、发光边框、毛玻璃面板
- **一键分享**：将当前视图和摘要打包为单一 HTML 报告

## 🏗️ 架构

```
backend/   Python FastAPI + pandas/scipy/numpy
frontend/  React 18 + Vite + TypeScript + Tailwind + echarts-gl
```

详细设计见 [DESIGN.md](./DESIGN.md)

## 🚀 快速开始

### 启动后端

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

然后打开 http://localhost:5173 ，拖入 `backend/sample_data/sales_sample.csv` 即可看到效果。

### 导出报告

在仪表盘点击右上角 "📤 导出报告"，会下载一个可独立打开的 HTML 文件。

## 📁 项目结构

```
1011/
├── DESIGN.md                      # 设计文档（架构、模块、数据流）
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI 入口
│   │   ├── api/                   # REST API
│   │   ├── analyzer/              # 分析引擎核心
│   │   ├── models/                # Pydantic 数据模型
│   │   └── utils/                 # 文件 IO + 报告模板
│   ├── requirements.txt
│   └── sample_data/
└── frontend/
    ├── src/
    │   ├── pages/                 # 上传页 / 仪表盘
    │   ├── components/
    │   │   ├── dashboard/         # 仪表盘 UI 组件
    │   │   └── charts3d/          # 5 种 3D 图表
    │   ├── store/                 # Zustand 状态管理
    │   ├── services/              # API 封装
    │   ├── types/                 # TypeScript 类型
    │   └── styles/theme.css       # 指挥舱视觉主题
    └── ...
```

## 🧪 测试数据

`backend/sample_data/sales_sample.csv` 是一个模拟的销售数据集，包含：
- 70 行 × 9 列
- 日期、产品、地区、销售额、利润、数量、折扣、品类、客户群
- 可触发相关性分析、异常检测、时间序列预测、分类占比
