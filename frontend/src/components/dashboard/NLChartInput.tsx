import { useState, useEffect, useRef } from 'react'
import { useAnalysisStore } from '../../store/analysisStore'
import { queryNLChart, getLLMStatus, configureLLM } from '../../services/api'
import Modal from './Modal'

const EXAMPLE_QUERIES = [
  '画一张华东区每月利润趋势图',
  '对比电子产品在三个区域的销量',
  '各品类销售额占比饼图',
  '展示利润和销售额的关系散点图',
  '按季度统计华北区平均销售额',
  '每月销量趋势对比南北区',
]

export default function NLChartInput() {
  const result = useAnalysisStore((s) => s.result)
  const nlChartLoading = useAnalysisStore((s) => s.nlChartLoading)
  const nlChartHistory = useAnalysisStore((s) => s.nlChartHistory)
  const llmConfig = useAnalysisStore((s) => s.llmConfig)
  const setNLChartLoading = useAnalysisStore((s) => s.setNLChartLoading)
  const setNLChartError = useAnalysisStore((s) => s.setNLChartError)
  const setNLChartResponse = useAnalysisStore((s) => s.setNLChartResponse)
  const addNLChartHistory = useAnalysisStore((s) => s.addNLChartHistory)
  const setShowNLCustomChart = useAnalysisStore((s) => s.setShowNLCustomChart)
  const setLLMConfig = useAnalysisStore((s) => s.setLLMConfig)

  const [query, setQuery] = useState('')
  const [showConfig, setShowConfig] = useState(false)
  const [configProvider, setConfigProvider] = useState('openai')
  const [configApiKey, setConfigApiKey] = useState('')
  const [configBaseUrl, setConfigBaseUrl] = useState('')
  const [configModel, setConfigModel] = useState('')
  const [configSaving, setConfigSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getLLMStatus().then(setLLMConfig).catch(() => {})
  }, [setLLMConfig])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const q = query.trim()
    if (!q || !result?.task_id || nlChartLoading) return

    setNLChartLoading(true)
    setNLChartError(null)
    try {
      const response = await queryNLChart(result.task_id, q)
      setNLChartResponse(response)
      if (response.success && response.chart_data) {
        setShowNLCustomChart(true)
      }
      addNLChartHistory({
        id: Date.now().toString(),
        query: q,
        timestamp: Date.now(),
        response,
      })
      setQuery('')
    } catch (err: any) {
      setNLChartError(err?.message || '请求失败')
    } finally {
      setNLChartLoading(false)
    }
  }

  const handleHistoryClick = (q: string) => {
    setQuery(q)
    inputRef.current?.focus()
  }

  const handleConfigSave = async () => {
    if (!configApiKey) return
    setConfigSaving(true)
    try {
      const status = await configureLLM(
        configProvider,
        configApiKey,
        configBaseUrl || undefined,
        configModel || undefined,
      )
      setLLMConfig(status)
      setShowConfig(false)
      setConfigApiKey('')
    } catch (err: any) {
      alert('配置失败: ' + (err?.message || '未知错误'))
    } finally {
      setConfigSaving(false)
    }
  }

  return (
    <div className="glass-panel relative p-4">
      <span className="hud-corner tl" />
      <span className="hud-corner br" />
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-mono text-cockpit-cyan uppercase tracking-wider flex items-center gap-2">
          <span>🗣️</span> 自然语言出图
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-mono ${
              llmConfig.configured
                ? 'bg-cockpit-primary/20 text-cockpit-cyan border border-cockpit-primary/40'
                : 'bg-cockpit-panel/50 text-cockpit-muted border border-cockpit-border'
            }`}
            title={llmConfig.configured ? `已配置: ${llmConfig.provider} / ${llmConfig.model}` : '未配置 LLM，使用关键词匹配'}
          >
            {llmConfig.configured ? '🧠 LLM' : '🔍 关键词'}
          </span>
          <button
            onClick={() => {
              setConfigProvider(llmConfig.provider || 'openai')
              setConfigModel(llmConfig.model || '')
              setShowConfig(true)
            }}
            className="text-xs px-2 py-1 rounded border border-cockpit-border text-cockpit-muted hover:text-cockpit-text hover:border-cockpit-primary/40 transition-colors"
            title="配置 LLM API Key"
          >
            ⚙
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例：画一张华东区每月利润趋势图"
          className="flex-1 bg-cockpit-panel/80 border border-cockpit-border rounded-md px-3 py-2 text-sm text-cockpit-text placeholder-cockpit-muted focus:outline-none focus:border-cockpit-primary/60 focus:ring-1 focus:ring-cockpit-primary/30 transition-all"
          disabled={nlChartLoading || !result?.task_id}
        />
        <button
          type="submit"
          disabled={nlChartLoading || !query.trim() || !result?.task_id}
          className="px-4 py-2 rounded-md bg-gradient-to-r from-cockpit-primary to-cockpit-purple text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-cockpit-primary/20 transition-all flex items-center gap-1.5"
        >
          {nlChartLoading ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              生成中
            </>
          ) : (
            <>
              <span>✨</span> 生成
            </>
          )}
        </button>
      </form>

      <div className="mt-3">
        <div className="text-[10px] font-mono text-cockpit-muted mb-1.5">快捷问法：</div>
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLE_QUERIES.slice(0, 4).map((q) => (
            <button
              key={q}
              onClick={() => handleHistoryClick(q)}
              className="text-[11px] px-2 py-1 rounded bg-cockpit-panel/50 text-cockpit-muted border border-cockpit-border/60 hover:text-cockpit-cyan hover:border-cockpit-primary/40 transition-colors truncate max-w-[200px]"
              title={q}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {nlChartHistory.length > 0 && (
        <div className="mt-3 pt-3 border-t border-cockpit-border/30">
          <div className="text-[10px] font-mono text-cockpit-muted mb-1.5">历史记录：</div>
          <div className="space-y-1 max-h-[100px] overflow-y-auto">
            {nlChartHistory.slice(0, 5).map((item) => (
              <button
                key={item.id}
                onClick={() => handleHistoryClick(item.query)}
                className={`w-full text-left text-[11px] px-2 py-1 rounded truncate transition-colors ${
                  item.response.success
                    ? 'text-cockpit-muted hover:text-cockpit-text hover:bg-cockpit-primary/5'
                    : 'text-cockpit-danger/70 hover:bg-cockpit-danger/5'
                }`}
                title={item.query}
              >
                {item.response.success ? '✓' : '✗'} {item.query}
              </button>
            ))}
          </div>
        </div>
      )}

      <Modal open={showConfig} onClose={() => setShowConfig(false)} title="🧠 配置大语言模型" small>
        <div className="space-y-4">
          <div className="text-xs text-cockpit-muted leading-relaxed">
            填入 API Key 后，系统将优先调用大语言模型理解查询意图，识别更准确。
            未配置时自动使用关键词匹配规则。
          </div>
          <div>
            <label className="block text-xs font-mono text-cockpit-muted mb-1">服务商 Provider</label>
            <select
              value={configProvider}
              onChange={(e) => setConfigProvider(e.target.value)}
              className="w-full bg-cockpit-panel/80 border border-cockpit-border rounded-md px-3 py-2 text-sm text-cockpit-text focus:outline-none focus:border-cockpit-primary/60"
            >
              <option value="openai">OpenAI</option>
              <option value="deepseek">DeepSeek</option>
              <option value="qwen">通义千问 (Qwen)</option>
              <option value="glm">智谱 GLM</option>
              <option value="claude">Anthropic Claude</option>
              <option value="custom">自定义兼容接口</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono text-cockpit-muted mb-1">API Key *</label>
            <input
              type="password"
              value={configApiKey}
              onChange={(e) => setConfigApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full bg-cockpit-panel/80 border border-cockpit-border rounded-md px-3 py-2 text-sm text-cockpit-text placeholder-cockpit-muted focus:outline-none focus:border-cockpit-primary/60"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-cockpit-muted mb-1">Base URL（可选，兼容接口时填写）</label>
            <input
              type="text"
              value={configBaseUrl}
              onChange={(e) => setConfigBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="w-full bg-cockpit-panel/80 border border-cockpit-border rounded-md px-3 py-2 text-sm text-cockpit-text placeholder-cockpit-muted focus:outline-none focus:border-cockpit-primary/60"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-cockpit-muted mb-1">模型名称（可选）</label>
            <input
              type="text"
              value={configModel}
              onChange={(e) => setConfigModel(e.target.value)}
              placeholder="gpt-4o-mini / deepseek-chat / qwen-plus ..."
              className="w-full bg-cockpit-panel/80 border border-cockpit-border rounded-md px-3 py-2 text-sm text-cockpit-text placeholder-cockpit-muted focus:outline-none focus:border-cockpit-primary/60"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 rounded-md text-sm text-cockpit-muted border border-cockpit-border hover:text-cockpit-text transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleConfigSave}
              disabled={!configApiKey || configSaving}
              className="px-4 py-2 rounded-md bg-gradient-to-r from-cockpit-primary to-cockpit-purple text-white text-sm font-medium disabled:opacity-50 transition-all"
            >
              {configSaving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
