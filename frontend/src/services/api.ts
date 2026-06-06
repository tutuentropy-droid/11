import axios from 'axios'
import type { AnalysisResult, CompareResult, CleanResult } from '../types'

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

export async function uploadAndCompare(
  fileA: File,
  fileB: File,
  options?: {
    labelA?: string
    labelB?: string
    alignStrategy?: string
    alignField?: string
  },
  onProgress?: (percent: number) => void,
): Promise<CompareResult> {
  const form = new FormData()
  form.append('file_a', fileA)
  form.append('file_b', fileB)
  if (options?.labelA) form.append('label_a', options.labelA)
  if (options?.labelB) form.append('label_b', options.labelB)
  if (options?.alignStrategy) form.append('align_strategy', options.alignStrategy)
  if (options?.alignField) form.append('align_field', options.alignField)

  const res = await api.post<CompareResult>('/compare', form, {
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.min(90, Math.round((e.loaded / e.total) * 50)))
      }
    },
  })
  if (onProgress) onProgress(100)
  return res.data
}

export async function cleanIssue(taskId: string, issueIndex: number): Promise<CleanResult> {
  const res = await api.post<CleanResult>('/clean', {
    task_id: taskId,
    issue_index: issueIndex,
    fix_all: false,
  })
  return res.data
}

export async function cleanAllIssues(taskId: string): Promise<CleanResult> {
  const res = await api.post<CleanResult>('/clean', {
    task_id: taskId,
    fix_all: true,
  })
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
