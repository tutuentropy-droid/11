import axios from 'axios'
import type { AnalysisResult } from '../types'

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
})

export async function uploadAndAnalyze(file: File, onProgress?: (percent: number) => void): Promise<AnalysisResult> {
  const form = new FormData()
  form.append('file', file)
  const res = await api.post<AnalysisResult>('/upload', form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.min(90, Math.round((e.loaded / e.total) * 50)))
      }
    },
  })
  if (onProgress) onProgress(100)
  return res.data
}

export async function exportReport(taskId: string, viewConfig?: Record<string, any>): Promise<Blob> {
  const res = await api.post(`/export/${taskId}`, viewConfig || {}, {
    responseType: 'blob',
  })
  return res.data
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await api.get('/health')
    return res.data?.status === 'ok'
  } catch {
    return false
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
