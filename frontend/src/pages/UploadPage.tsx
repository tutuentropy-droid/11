import { useCallback, useState, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { useAnalysisStore } from '../store/analysisStore'
import { uploadAndAnalyze } from '../services/api'

const ACCEPTED = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
}

function LoadingOverlay({ progress }: { progress: number }) {
  const stages = [
    { at: 10, label: '解析文件结构...' },
    { at: 30, label: '识别数据类型...' },
    { at: 50, label: '计算统计指标...' },
    { at: 65, label: '检测异常与相关性...' },
    { at: 80, label: '生成洞察摘要...' },
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
        <div className="text-cockpit-muted text-sm">正在指挥舱中分析数据，稍候...</div>
      </div>
    </div>
  )
}

export default function UploadPage() {
  const navigate = useNavigate()
  const { setResult, setLoading, loading, setError, setProgress, progress } = useAnalysisStore()
  const [dragPulse, setDragPulse] = useState(false)

  useEffect(() => {
    let t: any
    if (loading) {
      t = setInterval(() => {
        setProgress(Math.min(95, progress + Math.random() * 3))
      }, 400)
    }
    return () => clearInterval(t)
  }, [loading, progress, setProgress])

  const handleFile = useCallback(
    async (file: File) => {
      setError(null)
      setLoading(true)
      setProgress(5)
      try {
        const data = await uploadAndAnalyze(file, (p) => setProgress(p))
        setResult(data)
        setTimeout(() => navigate('/dashboard'), 400)
      } catch (e: any) {
        setError(e?.response?.data?.detail || e?.message || '上传失败')
        setLoading(false)
      }
    },
    [navigate, setError, setLoading, setProgress, setResult]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPTED,
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    onDragEnter: () => setDragPulse(true),
    onDragLeave: () => setDragPulse(false),
    onDrop: (files) => {
      setDragPulse(false)
      if (files[0]) handleFile(files[0])
    },
  })

  const error = useAnalysisStore((s) => s.error)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 grid-bg">
      {loading && <LoadingOverlay progress={progress} />}
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10 animate-float">
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
            <div className="text-cockpit-muted text-sm mb-4">
              支持 .csv · .xlsx · .xls · 最大 50MB
            </div>
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

        {error && (
          <div className="mt-6 p-4 rounded-lg bg-cockpit-danger/10 border border-cockpit-danger/30 text-cockpit-danger text-center">
            ⚠️ {error}
          </div>
        )}

        <div className="mt-10 text-center text-cockpit-muted text-xs">
          所有数据仅在本地和服务器内存中处理，不会持久化存储
        </div>
      </div>
    </div>
  )
}
