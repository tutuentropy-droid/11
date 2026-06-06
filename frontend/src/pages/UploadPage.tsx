import { useCallback, useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { useAnalysisStore } from '../store/analysisStore'
import { uploadAndAnalyze, uploadAndCompare } from '../services/api'
import { getLogger } from '../utils/logger'

const logger = getLogger('pages.UploadPage')

const ACCEPTED = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
}

const INDUSTRY_TEMPLATES = [
  { icon: '🛒', name: '电商行业', desc: 'GMV、复购率、客单价、退款率', color: 'text-cockpit-primary', bg: 'bg-cockpit-primary/10', border: 'border-cockpit-primary/30' },
  { icon: '🏬', name: '零售行业', desc: '销售额、毛利率、坪效、库存周转', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  { icon: '☁️', name: 'SaaS行业', desc: 'ARR、MRR、Churn、续费率、NDR', color: 'text-cockpit-purple', bg: 'bg-cockpit-purple/10', border: 'border-cockpit-purple/30' },
  { icon: '💹', name: '财务会计', desc: '营收、成本、毛利、净利、现金流', color: 'text-yellow-300', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
]

function LoadingOverlay({ progress, mode }: { progress: number; mode: 'single' | 'compare' }) {
  const stages = [
    { at: 10, label: '解析文件结构...' },
    { at: 30, label: '识别数据类型...' },
    { at: 50, label: '计算统计指标...' },
    { at: 65, label: mode === 'compare' ? '对齐字段与计算差异...' : '检测异常与相关性...' },
    { at: 80, label: mode === 'compare' ? '生成对比摘要...' : '生成洞察摘要...' },
    { at: 95, label: '准备 3D 可视化...' },
    { at: 100, label: '完成！' },
  ]
  const current = stages.filter((s) => progress >= s.at).pop() || stages[0]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-cockpit-bg/90 backdrop-blur-md">
      <div className="glass-panel w-[480px] p-8 text-center relative">
        <span className="hud-corner tl" />
        <span className="hud-corner tr" />
        <span className="hud-corner bl" />
        <span className="hud-corner br" />
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto relative animate-spin-slow">
            <svg viewBox="0 0 80 80" className="w-full h-full">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(59,130,246,0.15)" strokeWidth="4" />
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="url(#grad)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${progress * 2.01} 200`}
                transform="rotate(-90 40 40)"
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-2xl text-gradient font-bold">{progress}%</span>
            </div>
          </div>
        </div>
        <div className="text-cockpit-text text-lg mb-2 glow-text">{current.label}</div>
        <div className="text-cockpit-muted text-sm">
          {mode === 'compare' ? '正在双数据舱对比分析，稍候...' : '正在指挥舱中分析数据，稍候...'}
        </div>
      </div>
    </div>
  )
}

function FileSlot({
  label,
  file,
  onFile,
  color,
  slotLabel,
}: {
  label: string
  file: File | null
  onFile: (f: File) => void
  color: string
  slotLabel: string
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED,
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    onDrop: (files) => files[0] && onFile(files[0]),
  })

  return (
    <div className="flex-1">
      <div className={`text-xs font-mono mb-2 ${color}`}>
        ◉ {slotLabel} · {label}
      </div>
      <div
        {...getRootProps()}
        className={`relative glass-panel p-6 cursor-pointer transition-all duration-300 min-h-[180px] flex flex-col items-center justify-center ${
          isDragActive ? 'scale-105 animate-glow' : ''
        } ${file ? 'ring-2 ring-cockpit-cyan/50' : ''}`}
      >
        <span className="hud-corner tl" />
        <span className="hud-corner tr" />
        <span className="hud-corner bl" />
        <span className="hud-corner br" />
        <input {...getInputProps()} />
        {file ? (
          <div className="text-center w-full">
            <div className={`text-3xl mb-2 ${color}`}>📄</div>
            <div className="text-cockpit-text font-semibold truncate max-w-full">{file.name}</div>
            <div className="text-cockpit-muted text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</div>
            <div className={`text-xs mt-2 ${color} font-mono`}>已就绪</div>
          </div>
        ) : (
          <div className="text-center">
            <div className={`text-3xl mb-2 opacity-40 ${color}`}>⬆</div>
            <div className="text-cockpit-muted text-sm">拖入或点击选择文件</div>
            <div className="text-cockpit-muted text-xs mt-1">.csv · .xlsx · .xls</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function UploadPage() {
  const navigate = useNavigate()
  const {
    setResult,
    setCompareResult,
    setLoading,
    loading,
    setError,
    setProgress,
    progress,
    mode,
    setMode,
  } = useAnalysisStore()
  const [dragPulse, setDragPulse] = useState(false)
  const [fileA, setFileA] = useState<File | null>(null)
  const [fileB, setFileB] = useState<File | null>(null)
  const [labelA, setLabelA] = useState('')
  const [labelB, setLabelB] = useState('')

  useEffect(() => {
    let t: any
    if (loading) {
      t = setInterval(() => {
        setProgress(Math.min(95, progress + Math.random() * 3))
      }, 400)
    }
    return () => clearInterval(t)
  }, [loading, progress, setProgress])

  const handleSingleFile = useCallback(
    async (file: File) => {
      logger.info('用户上传文件', {
        filename: file.name,
        size_bytes: file.size,
        type: file.type,
        mode: 'single',
        event: 'user_upload',
      })
      setError(null)
      setLoading(true)
      setProgress(5)
      try {
        const data = await uploadAndAnalyze(file, (p) => setProgress(p))
        setResult(data)
        logger.info('文件分析成功，即将跳转仪表盘', {
          filename: file.name,
          task_id: data.task_id,
          event: 'upload_navigate',
        })
        setTimeout(() => navigate('/dashboard'), 400)
      } catch (e: any) {
        logger.error(
          '文件上传失败',
          e,
          {
            filename: file.name,
            error_message: e?.response?.data?.detail || e?.message,
            event: 'upload_error',
          },
        )
        setError(e?.response?.data?.detail || e?.message || '上传失败')
        setLoading(false)
      }
    },
    [navigate, setError, setLoading, setProgress, setResult]
  )

  const handleCompare = useCallback(async () => {
    if (!fileA || !fileB) return
    logger.info('用户启动双文件对比分析', {
      file_a: fileA ? { name: fileA.name, size_bytes: fileA.size } : null,
      file_b: fileB ? { name: fileB.name, size_bytes: fileB.size } : null,
      label_a: labelA || undefined,
      label_b: labelB || undefined,
      event: 'user_compare_upload',
    })
    setError(null)
    setLoading(true)
    setProgress(5)
    try {
      const data = await uploadAndCompare(
        fileA,
        fileB,
        { labelA: labelA || undefined, labelB: labelB || undefined },
        (p) => setProgress(p),
      )
      setCompareResult(data)
      logger.info('对比分析成功，即将跳转对比页', {
        compare_id: data.compare_id,
        event: 'compare_navigate',
      })
      setTimeout(() => navigate('/compare'), 400)
    } catch (e: any) {
      logger.error(
        '对比分析失败',
        e,
        {
          error_message: e?.response?.data?.detail || e?.message,
          event: 'compare_error',
        },
      )
      setError(e?.response?.data?.detail || e?.message || '对比分析失败')
      setLoading(false)
    }
  }, [fileA, fileB, labelA, labelB, navigate, setError, setLoading, setProgress, setCompareResult])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED,
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    onDragEnter: () => setDragPulse(true),
    onDragLeave: () => setDragPulse(false),
    onDrop: (files) => {
      setDragPulse(false)
      if (files[0]) handleSingleFile(files[0])
    },
  })

  const error = useAnalysisStore((s) => s.error)
  const canCompare = fileA && fileB && !loading

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 grid-bg">
      {loading && <LoadingOverlay progress={progress} mode={mode} />}
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8 animate-float">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel text-xs text-cockpit-cyan font-mono mb-6">
            <span className="w-2 h-2 bg-cockpit-cyan rounded-full animate-pulse" />
            DATA INSIGHT COMMAND CENTER v1.0
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="text-gradient glow-text">数据洞察指挥舱</span>
          </h1>
          <p className="text-cockpit-muted text-lg max-w-xl mx-auto">
            拖拽 CSV 或 Excel 文件，30 秒内生成震撼的 3D 交互报告
            <br />
            不懂数据，也能看懂故事
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          <button
            onClick={() => {
              setMode('single')
              logger.info('用户切换到单文件分析模式', { event: 'mode_switch', mode: 'single' })
            }}
            className={`px-6 py-2 rounded-lg font-mono text-sm transition-all ${
              mode === 'single'
                ? 'bg-cockpit-primary/20 text-cockpit-cyan border border-cockpit-cyan/50'
                : 'glass-panel text-cockpit-muted hover:text-cockpit-text'
            }`}
          >
            ◈ 单文件分析
          </button>
          <button
            onClick={() => {
              setMode('compare')
              logger.info('用户切换到双文件对比模式', { event: 'mode_switch', mode: 'compare' })
            }}
            className={`px-6 py-2 rounded-lg font-mono text-sm transition-all ${
              mode === 'compare'
                ? 'bg-cockpit-purple/20 text-cockpit-purple border border-cockpit-purple/50'
                : 'glass-panel text-cockpit-muted hover:text-cockpit-text'
            }`}
          >
            ⚖ 双文件对比
          </button>
        </div>

        {mode === 'single' ? (
          <div
            {...getRootProps()}
            className={`relative glass-panel p-12 cursor-pointer transition-all duration-300 ${
              isDragActive || dragPulse ? 'scale-105 animate-glow' : ''
            }`}
          >
            <span className="hud-corner tl" />
            <span className="hud-corner tr" />
            <span className="hud-corner bl" />
            <span className="hud-corner br" />

            <input {...getInputProps()} />

            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 relative">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cockpit-primary/20 to-cockpit-purple/20 animate-pulse-slow" />
                <div className="absolute inset-2 rounded-xl bg-cockpit-panel flex items-center justify-center">
                  <svg viewBox="0 0 64 64" className="w-12 h-12 text-cockpit-primary">
                    <path
                      fill="currentColor"
                      d="M28 4h8l16 16v36a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4h12zm4 2.83V16h9.17L32 6.83zM20 28h24v4H20v-4zm0 8h24v4H20v-4zm0 8h16v4H20v-4z"
                      opacity="0.4"
                    />
                    <path
                      fill="currentColor"
                      d="M38 36c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8 8 3.6 8 8zm-4 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm-2 0h-4l2-4 2 4z"
                    />
                  </svg>
                </div>
              </div>
              <div className="text-2xl font-semibold mb-2 text-cockpit-text">
                {isDragActive ? '释放文件开始分析' : '拖入文件，或点击选择'}
              </div>
              <div className="text-cockpit-muted text-sm mb-4">支持 .csv · .xlsx · .xls · 最大 50MB</div>
              <div className="hud-line w-48 mx-auto my-4" />
              <div className="flex justify-center gap-8 text-sm">
                <div className="text-center">
                  <div className="text-cockpit-cyan font-mono text-xl font-bold">3D</div>
                  <div className="text-cockpit-muted">交互可视化</div>
                </div>
                <div className="text-center">
                  <div className="text-cockpit-purple font-mono text-xl font-bold">AI</div>
                  <div className="text-cockpit-muted">自动洞察</div>
                </div>
                <div className="text-center">
                  <div className="text-cockpit-warning font-mono text-xl font-bold">1-CLICK</div>
                  <div className="text-cockpit-muted">一键分享</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-4">
              <FileSlot
                label={labelA || '基准数据 (如: 促销前)'}
                file={fileA}
                onFile={setFileA}
                color="text-cockpit-cyan"
                slotLabel="数据集 A"
              />
              <div className="flex items-center justify-center px-2">
                <div className="text-3xl text-cockpit-purple font-mono font-bold">VS</div>
              </div>
              <FileSlot
                label={labelB || '对比数据 (如: 促销后)'}
                file={fileB}
                onFile={setFileB}
                color="text-cockpit-purple"
                slotLabel="数据集 B"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="数据集 A 标签 (可选，如：促销前)"
                  value={labelA}
                  onChange={(e) => setLabelA(e.target.value)}
                  className="w-full px-4 py-2 bg-cockpit-panel/50 border border-cockpit-primary/20 rounded-lg text-cockpit-text text-sm focus:outline-none focus:border-cockpit-cyan/50 placeholder-cockpit-muted/50"
                />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="数据集 B 标签 (可选，如：促销后)"
                  value={labelB}
                  onChange={(e) => setLabelB(e.target.value)}
                  className="w-full px-4 py-2 bg-cockpit-panel/50 border border-cockpit-primary/20 rounded-lg text-cockpit-text text-sm focus:outline-none focus:border-cockpit-purple/50 placeholder-cockpit-muted/50"
                />
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleCompare}
                disabled={!canCompare}
                className={`px-10 py-3 rounded-lg font-mono text-base font-semibold transition-all ${
                  canCompare
                    ? 'bg-gradient-to-r from-cockpit-primary to-cockpit-purple text-white hover:shadow-lg hover:shadow-cockpit-purple/30 hover:scale-105'
                    : 'bg-cockpit-panel/50 text-cockpit-muted/50 cursor-not-allowed'
                }`}
              >
                ⚡ 启动对比分析
              </button>
            </div>

            <div className="text-center text-cockpit-muted text-xs pt-2">
              系统将自动对齐时间字段或相同列名，检测关键变化并高亮显示
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 p-4 rounded-lg bg-cockpit-danger/10 border border-cockpit-danger/30 text-cockpit-danger text-center">
            ⚠️ {error}
          </div>
        )}

        <div className="mt-10">
          <div className="text-center mb-4">
            <div className="text-sm font-mono text-cockpit-muted uppercase tracking-wider">
              ⟡ 预置行业模板 · AI 自动匹配
            </div>
            <div className="text-cockpit-muted text-xs mt-1">
              上传文件后系统将自动识别数据所属行业，生成专属指标看板
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {INDUSTRY_TEMPLATES.map((tpl) => (
              <div
                key={tpl.name}
                className={`glass-panel relative p-4 border ${tpl.border}`}
              >
                <div className={`text-3xl mb-2 ${tpl.color}`}>{tpl.icon}</div>
                <div className={`text-sm font-semibold ${tpl.color}`}>{tpl.name}</div>
                <div className="text-xs text-cockpit-muted mt-1 leading-relaxed">
                  {tpl.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 text-center text-cockpit-muted text-xs">
          所有数据仅在本地和服务器内存中处理，不会持久化存储
        </div>
      </div>
    </div>
  )
}
