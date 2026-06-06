import axios, { AxiosError } from 'axios'
import type { AnalysisResult, CompareResult, CleanResult, NLChartResponse, LLMConfigStatus } from '../types'
import { getLogger } from '../utils/logger'

const logger = getLogger('services.api')

const api = axios.create({
  baseURL: '/api',
  timeout: 120000,
})

api.interceptors.request.use((config) => {
  const requestId = Math.random().toString(36).slice(2, 10)
  ;(config as any)._requestStartTime = Date.now()
  ;(config as any)._requestId = requestId
  logger.info('API 请求', {
    request_id: requestId,
    method: config.method?.toUpperCase(),
    url: config.url,
    event: 'api_request',
  })
  return config
})

api.interceptors.response.use(
  (response) => {
    const requestId = (response.config as any)?._requestId
    const startTime = (response.config as any)?._requestStartTime
    const durationMs = startTime ? Date.now() - startTime : undefined
    logger.info('API 响应成功', {
      request_id: requestId,
      method: response.config.method?.toUpperCase(),
      url: response.config.url,
      status: response.status,
      duration_ms: durationMs,
      event: 'api_response_success',
    })
    return response
  },
  (error: AxiosError) => {
    const requestId = (error.config as any)?._requestId
    const startTime = (error.config as any)?._requestStartTime
    const durationMs = startTime ? Date.now() - startTime : undefined
    const status = error.response?.status
    const errorData = error.response?.data

    if (status && status >= 500) {
      logger.error(
        'API 响应错误',
        error,
        {
          request_id: requestId,
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status,
          duration_ms: durationMs,
          response_data: errorData,
          event: 'api_response_error',
        },
      )
    } else {
      logger.warn('API 响应异常', {
        request_id: requestId,
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        status,
        duration_ms: durationMs,
        error_message: error.message,
        response_data: errorData,
        event: 'api_response_warning',
      })
    }
    return Promise.reject(error)
  },
)

export async function uploadAndAnalyze(file: File, onProgress?: (percent: number) => void): Promise<AnalysisResult> {
  logger.info('开始上传并分析文件', {
    filename: file.name,
    size_bytes: file.size,
    type: file.type,
    event: 'upload_start',
  })
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
  logger.info('文件上传并分析成功', {
    filename: file.name,
    task_id: res.data.task_id,
    rows: res.data.dataset?.rows,
    cols: res.data.dataset?.cols,
    event: 'upload_success',
  })
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
  logger.info('开始双文件对比分析', {
    file_a: { name: fileA.name, size_bytes: fileA.size },
    file_b: { name: fileB.name, size_bytes: fileB.size },
    options,
    event: 'compare_upload_start',
  })
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
  logger.info('双文件对比分析成功', {
    compare_id: res.data.compare_id,
    event: 'compare_upload_success',
  })
  return res.data
}

export async function cleanIssue(taskId: string, issueIndex: number): Promise<CleanResult> {
  logger.info('修复数据质量问题', {
    task_id: taskId,
    issue_index: issueIndex,
    fix_all: false,
    event: 'clean_issue_start',
  })
  const res = await api.post<CleanResult>('/clean', {
    task_id: taskId,
    issue_index: issueIndex,
    fix_all: false,
  })
  logger.info('数据质量问题修复完成', {
    task_id: taskId,
    issue_index: issueIndex,
    fixed_count: res.data.fixed_issues?.length,
    event: 'clean_issue_success',
  })
  return res.data
}

export async function cleanAllIssues(taskId: string): Promise<CleanResult> {
  logger.info('一键修复所有数据质量问题', {
    task_id: taskId,
    event: 'clean_all_start',
  })
  const res = await api.post<CleanResult>('/clean', {
    task_id: taskId,
    fix_all: true,
  })
  logger.info('所有数据质量问题修复完成', {
    task_id: taskId,
    fixed_count: res.data.fixed_issues?.length,
    event: 'clean_all_success',
  })
  return res.data
}

export async function exportReport(taskId: string, viewConfig?: Record<string, any>): Promise<Blob> {
  logger.info('导出报告', {
    task_id: taskId,
    has_view_config: !!viewConfig,
    event: 'export_start',
  })
  const res = await api.post(`/export/${taskId}`, viewConfig || {}, {
    responseType: 'blob',
  })
  logger.info('报告导出成功', {
    task_id: taskId,
    blob_size: res.data.size,
    event: 'export_success',
  })
  return res.data
}

export async function healthCheck(): Promise<boolean> {
  try {
    const res = await api.get('/health')
    const ok = res.data?.status === 'ok'
    logger.debug('健康检查', { status: ok, event: 'health_check' })
    return ok
  } catch (e) {
    logger.warn('健康检查失败', { error: String(e), event: 'health_check_failed' })
    return false
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  logger.info('下载文件', { filename, size_bytes: blob.size, event: 'download' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function queryNLChart(taskId: string, query: string): Promise<NLChartResponse> {
  logger.info('自然语言出图查询', {
    task_id: taskId,
    query,
    event: 'nl_query_start',
  })
  const res = await api.post<NLChartResponse>('/nl-chart', {
    task_id: taskId,
    query,
  })
  const data = res.data
  logger.info(
    '自然语言出图响应',
    {
      task_id: taskId,
      query,
      success: data.success,
      parser_source: data.intent?.parser_source,
      chart_type: data.intent?.chart_type,
      value_columns: data.intent?.value_columns,
      group_by: data.intent?.group_by,
      filters: data.intent?.filters,
      message: data.message,
      error: data.error,
      event: data.success ? 'nl_query_success' : 'nl_query_failed',
    },
  )
  return data
}

export async function configureLLM(
  provider: string,
  apiKey: string,
  baseUrl?: string,
  model?: string,
): Promise<LLMConfigStatus> {
  logger.info('配置 LLM', {
    provider,
    has_api_key: !!apiKey,
    has_base_url: !!baseUrl,
    model: model || undefined,
    event: 'llm_config_update',
  })
  const res = await api.post<LLMConfigStatus>('/nl-chart/config', {
    provider,
    api_key: apiKey,
    base_url: baseUrl,
    model,
  })
  logger.info('LLM 配置已保存', {
    configured: res.data.configured,
    provider: res.data.provider,
    model: res.data.model,
    event: 'llm_config_updated',
  })
  return res.data
}

export async function getLLMStatus(): Promise<LLMConfigStatus> {
  const res = await api.get<LLMConfigStatus>('/nl-chart/config')
  logger.debug('查询 LLM 配置状态', {
    configured: res.data.configured,
    provider: res.data.provider,
    model: res.data.model,
    event: 'llm_config_query',
  })
  return res.data
}
