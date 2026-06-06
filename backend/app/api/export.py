from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
import json
import os
import tempfile

from ..utils import get_logger

logger = get_logger("api.export")

router = APIRouter(prefix="/api", tags=["export"])


REPORT_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>数据洞察报告 - {title}</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/echarts-gl@2.0.9/dist/echarts-gl.min.js"></script>
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
  background: #0a0e1a;
  color: #e2e8f0;
  min-height: 100vh;
  padding: 24px;
}}
.header {{
  text-align: center;
  padding: 24px;
  background: linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.1));
  border: 1px solid rgba(59,130,246,0.3);
  border-radius: 16px;
  margin-bottom: 24px;
  box-shadow: 0 0 40px rgba(59,130,246,0.15);
}}
.header h1 {{ font-size: 28px; background: linear-gradient(90deg,#3b82f6,#06b6d4,#8b5cf6); -webkit-background-clip: text; color: transparent; }}
.header p {{ color: #94a3b8; margin-top: 8px; }}
.stats-bar {{ display: flex; gap: 16px; justify-content: center; margin-top: 16px; flex-wrap: wrap; }}
.stat {{ background: rgba(17,24,39,0.8); border: 1px solid rgba(59,130,246,0.2); border-radius: 12px; padding: 12px 24px; }}
.stat-label {{ font-size: 12px; color: #94a3b8; }}
.stat-value {{ font-size: 24px; font-weight: 700; color: #06b6d4; font-family: 'JetBrains Mono', monospace; }}
.insights {{ background: rgba(17,24,39,0.6); border: 1px solid rgba(139,92,246,0.2); border-radius: 16px; padding: 20px; margin-bottom: 24px; }}
.insights h2 {{ font-size: 18px; color: #a78bfa; margin-bottom: 16px; }}
.insight-item {{ padding: 12px 16px; border-left: 3px solid #3b82f6; background: rgba(59,130,246,0.05); margin-bottom: 8px; border-radius: 0 8px 8px 0; }}
.insight-high {{ border-color: #ef4444; background: rgba(239,68,68,0.08); }}
.insight-medium {{ border-color: #f59e0b; background: rgba(245,158,11,0.08); }}
.section {{ background: rgba(17,24,39,0.6); border: 1px solid rgba(59,130,246,0.15); border-radius: 16px; padding: 20px; margin-bottom: 24px; }}
.section h2 {{ font-size: 18px; color: #06b6d4; margin-bottom: 16px; }}
.chart {{ width: 100%; height: 500px; }}
.cols-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }}
.col-card {{ background: rgba(17,24,39,0.8); border: 1px solid rgba(59,130,246,0.15); border-radius: 12px; padding: 16px; }}
.col-card h3 {{ font-size: 15px; color: #e2e8f0; margin-bottom: 8px; }}
.col-meta {{ font-size: 12px; color: #94a3b8; margin-bottom: 12px; }}
.col-stat {{ display: flex; justify-content: space-between; font-size: 13px; padding: 4px 0; border-bottom: 1px solid rgba(148,163,184,0.1); }}
.col-stat span:first-child {{ color: #94a3b8; }}
.col-stat span:last-child {{ color: #06b6d4; font-family: 'JetBrains Mono', monospace; }}
.footer {{ text-align: center; color: #64748b; font-size: 12px; padding: 24px; }}
</style>
</head>
<body>
<div class="header">
  <h1>🛰️ 数据洞察指挥舱报告</h1>
  <p id="headline"></p>
  <div class="stats-bar" id="statsBar"></div>
</div>
<div class="insights">
  <h2>💡 关键洞察</h2>
  <div id="insightsList"></div>
</div>
<div class="section" id="corrSection" style="display:none">
  <h2>🔗 相关性矩阵 (3D)</h2>
  <div class="chart" id="corrChart"></div>
</div>
<div class="section" id="tsSection" style="display:none">
  <h2>📈 时间序列分析</h2>
  <div class="chart" id="tsChart"></div>
</div>
<div class="section">
  <h2>📊 列详情</h2>
  <div class="cols-grid" id="colsGrid"></div>
</div>
<div class="footer">由数据洞察指挥舱自动生成 · Data Insight Command Center</div>
<script>
const DATA = __DATA_JSON__;

function fmt(v) {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'number') return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(v);
}

document.getElementById('headline').textContent = DATA.summary.headline;

const statsBar = document.getElementById('statsBar');
const statItems = [
  ['数据文件', DATA.dataset.name],
  ['行数', DATA.dataset.rows],
  ['列数', DATA.dataset.cols],
  ['缺失率', (DATA.dataset.total_missing_rate * 100).toFixed(1) + '%'],
  ['重复行', DATA.dataset.duplicate_rows],
];
statItems.forEach(([l, v]) => {
  const d = document.createElement('div');
  d.className = 'stat';
  d.innerHTML = `<div class="stat-label">${l}</div><div class="stat-value">${fmt(v)}</div>`;
  statsBar.appendChild(d);
});

const insights = DATA.summary.insights || [];
const insList = document.getElementById('insightsList');
insights.forEach(ins => {
  const d = document.createElement('div');
  const sev = ins.severity || 'low';
  d.className = 'insight-item insight-' + sev;
  const icon = sev === 'high' ? '🚨' : sev === 'medium' ? '⚠️' : 'ℹ️';
  d.textContent = icon + ' ' + ins.text;
  insList.appendChild(d);
});

if (DATA.correlations && DATA.correlations.columns.length > 1) {
  document.getElementById('corrSection').style.display = 'block';
  const chart = echarts.init(document.getElementById('corrChart'), null, { renderer: 'canvas' });
  const cols = DATA.correlations.columns;
  const matrix = DATA.correlations.matrix;
  const data = [];
  for (let i = 0; i < cols.length; i++) {
    for (let j = 0; j < cols.length; j++) {
      data.push([j, i, matrix[i][j]]);
    }
  }
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { formatter: p => `${cols[p.data[1]]} × ${cols[p.data[0]]}<br/>r = ${p.data[2].toFixed(3)}` },
    xAxis3D: { type: 'category', data: cols, axisLabel: { color: '#94a3b8', fontSize: 10, rotate: 30 }, name: '' },
    yAxis3D: { type: 'category', data: cols, axisLabel: { color: '#94a3b8', fontSize: 10 }, name: '' },
    zAxis3D: { min: -1, max: 1, axisLabel: { color: '#94a3b8' }, name: '' },
    grid3D: {
      boxWidth: 160, boxDepth: 160, viewControl: { autoRotate: true, autoRotateSpeed: 8 },
      light: { main: { intensity: 1.2 }, ambient: { intensity: 0.4 } },
      itemStyle: { borderColor: 'rgba(59,130,246,0.2)' },
    },
    visualMap: {
      min: -1, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#ef4444', '#1e293b', '#3b82f6'] },
      textStyle: { color: '#94a3b8' },
    },
    series: [{ type: 'bar3D', data, shading: 'lambert', barSize: 16, itemStyle: { opacity: 0.9 } }],
  });
}

if (DATA.timeseries && DATA.timeseries.data_points.length > 0) {
  document.getElementById('tsSection').style.display = 'block';
  const chart = echarts.init(document.getElementById('tsChart'), null, { renderer: 'canvas' });
  const ts = DATA.timeseries;
  const histData = ts.data_points.map(p => [p.time, p.value]);
  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { data: ['原始数据', '趋势', '预测'], textStyle: { color: '#94a3b8' }, top: 0 },
    xAxis: { type: 'category', data: histData.map(p => p[0]), axisLabel: { color: '#94a3b8' } },
    yAxis: { type: 'value', axisLabel: { color: '#94a3b8' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.1)' } } },
    series: [
      {
        name: '原始数据', type: 'line', data: histData.map(p => p[1]),
        lineStyle: { color: '#06b6d4', width: 2, shadowColor: '#06b6d4', shadowBlur: 10 },
        itemStyle: { color: '#06b6d4' },
        showSymbol: false, smooth: true,
      },
    ],
  };
  if (ts.trend && ts.trend.length > 0) {
    option.series.push({
      name: '趋势', type: 'line',
      data: ts.trend.map(p => p.value),
      lineStyle: { color: '#a78bfa', width: 2, type: 'dashed' },
      showSymbol: false, smooth: true,
    });
  }
  if (ts.forecast && ts.forecast.values && ts.forecast.values.length > 0) {
    const lastTime = histData[histData.length - 1][0];
    const forecastTimes = ts.forecast.times || ts.forecast.values.map((_, i) => `T+${i + 1}`);
    option.xAxis.data = option.xAxis.data.concat(forecastTimes);
    option.series.push({
      name: '预测', type: 'line',
      data: new Array(histData.length).fill(null).concat(ts.forecast.values),
      lineStyle: { color: '#f59e0b', width: 2, type: 'dashed' },
      itemStyle: { color: '#f59e0b' },
      areaStyle: { color: 'rgba(245,158,11,0.2)' },
      showSymbol: false, smooth: true,
    });
    if (ts.forecast.upper && ts.forecast.lower) {
      option.series.push({
        name: '预测上界', type: 'line', data: new Array(histData.length).fill(null).concat(ts.forecast.upper),
        lineStyle: { opacity: 0 }, stack: 'confidence', showSymbol: false,
      });
      option.series.push({
        name: '置信区间', type: 'line',
        data: new Array(histData.length).fill(null).concat(ts.forecast.upper.map((u, i) => Math.max(0, u - (ts.forecast.lower[i] || 0)))),
        lineStyle: { opacity: 0 }, areaStyle: { color: 'rgba(245,158,11,0.15)' },
        stack: 'confidence', showSymbol: false,
      });
    }
  }
  chart.setOption(option);
}

const colsGrid = document.getElementById('colsGrid');
DATA.columns.forEach(c => {
  const card = document.createElement('div');
  card.className = 'col-card';
  const typeColors = { numeric: '#06b6d4', categorical: '#a78bfa', datetime: '#3b82f6', boolean: '#10b981', text: '#f59e0b' };
  const tc = typeColors[c.type] || '#94a3b8';
  let html = `<h3>${c.name}</h3>`;
  html += `<div class="col-meta">类型: <span style="color:${tc}">${c.type}</span> · 缺失率: ${(c.missing_rate * 100).toFixed(1)}% · 唯一值: ${c.unique_count}</div>`;
  if (c.stats) {
    html += `<div class="col-stat"><span>均值</span><span>${fmt(c.stats.mean)}</span></div>`;
    html += `<div class="col-stat"><span>中位数</span><span>${fmt(c.stats.median)}</span></div>`;
    html += `<div class="col-stat"><span>标准差</span><span>${fmt(c.stats.std)}</span></div>`;
    html += `<div class="col-stat"><span>最小值</span><span>${fmt(c.stats.min)}</span></div>`;
    html += `<div class="col-stat"><span>最大值</span><span>${fmt(c.stats.max)}</span></div>`;
  }
  if (c.outliers && c.outliers.length > 0) {
    html += `<div class="col-stat" style="color:#ef4444"><span>异常点</span><span>${c.outliers.length} 个</span></div>`;
  }
  if (c.categories && c.categories.length > 0) {
    html += `<div style="margin-top:8px"><div style="font-size:12px;color:#94a3b8;margin-bottom:4px">Top 分类:</div>`;
    c.categories.slice(0, 5).forEach(cat => {
      html += `<div style="font-size:12px;display:flex;justify-content:space-between;padding:2px 0"><span style="color:#cbd5e1">${cat.name}</span><span style="color:#a78bfa">${cat.percentage}%</span></div>`;
    });
    html += `</div>`;
  }
  card.innerHTML = html;
  colsGrid.appendChild(card);
});

window.addEventListener('resize', () => {
  document.querySelectorAll('.chart').forEach(el => {
    const inst = echarts.getInstanceByDom(el);
    if (inst) inst.resize();
  });
});
</script>
</body>
</html>
"""


@router.post("/export/{task_id}", response_class=HTMLResponse)
async def export_report(task_id: str, request: Request):
    logger.info(
        "报告导出请求",
        task_id=task_id,
        event="export_start",
    )
    cache_dir = os.path.join(tempfile.gettempdir(), "datainsight_cache")
    cache_path = os.path.join(cache_dir, f"{task_id}.json")
    data = None
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    if data is None:
        logger.warning(
            "导出失败: 任务不存在",
            task_id=task_id,
            event="export_error",
        )
        raise HTTPException(404, "任务不存在或已过期，请重新上传分析")

    try:
        body = await request.json()
        if isinstance(body, dict):
            data["view_config"] = body
            logger.info(
                "报告导出包含视图配置",
                task_id=task_id,
                view_config_keys=list(body.keys()),
            )
    except Exception:
        pass

    data_json = json.dumps(data, ensure_ascii=False, default=str)
    title = data.get("dataset", {}).get("name", "Report")
    html = REPORT_TEMPLATE.replace("__DATA_JSON__", data_json).replace("{title}", title)

    logger.info(
        "报告导出完成",
        task_id=task_id,
        title=title,
        html_size=len(html),
        event="export_success",
    )

    return HTMLResponse(
        content=html,
        media_type="text/html",
        headers={"Content-Disposition": f'attachment; filename="insight_report_{task_id}.html"'},
    )
