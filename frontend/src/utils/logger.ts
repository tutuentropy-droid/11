export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  logger: string
  message: string
  data?: Record<string, any>
  error?: {
    type: string
    message: string
    stack?: string
  }
}

const LOG_STORAGE_KEY = 'datainsight_frontend_logs'
const MAX_LOG_ENTRIES = 2000
const LOG_FILE_NAME = 'frontend_logs.jsonl'

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  const padMs = (n: number) => String(n).padStart(3, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${padMs(d.getUTCMilliseconds())}Z`
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  DEBUG: 'color: #06b6d4',
  INFO: 'color: #10b981',
  WARN: 'color: #f59e0b',
  ERROR: 'color: #ef4444',
}

let currentLogLevel: LogLevel = ((import.meta as any).env?.VITE_LOG_LEVEL as LogLevel) || 'INFO'

export function setLogLevel(level: LogLevel) {
  currentLogLevel = level
}

export function getLogLevel(): LogLevel {
  return currentLogLevel
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLogLevel]
}

function loadLogs(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLogs(logs: LogEntry[]) {
  try {
    const trimmed = logs.slice(-MAX_LOG_ENTRIES)
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(trimmed))
  } catch (e) {
    console.warn('[Logger] Failed to save logs to localStorage', e)
  }
}

function appendLog(entry: LogEntry) {
  const logs = loadLogs()
  logs.push(entry)
  saveLogs(logs)
}

function formatConsoleMessage(entry: LogEntry): string {
  const parts = [
    `%c[${entry.level}]`,
    `${entry.timestamp}`,
    `[${entry.logger}]`,
    entry.message,
  ]
  if (entry.data) {
    parts.push(JSON.stringify(entry.data, null, 0))
  }
  return parts.join(' ')
}

function buildEntry(
  level: LogLevel,
  logger: string,
  message: string,
  data?: Record<string, any>,
  error?: Error | unknown,
): LogEntry {
  const entry: LogEntry = {
    timestamp: formatTimestamp(Date.now()),
    level,
    logger,
    message,
  }
  if (data && Object.keys(data).length > 0) {
    entry.data = data
  }
  if (error) {
    if (error instanceof Error) {
      entry.error = {
        type: error.name,
        message: error.message,
        stack: error.stack,
      }
    } else {
      entry.error = {
        type: typeof error,
        message: String(error),
      }
    }
  }
  return entry
}

export class Logger {
  private name: string

  constructor(name: string) {
    this.name = name
  }

  debug(message: string, data?: Record<string, any>) {
    if (!shouldLog('DEBUG')) return
    const entry = buildEntry('DEBUG', this.name, message, data)
    console.debug(formatConsoleMessage(entry), LEVEL_COLORS.DEBUG)
    if (entry.data) console.debug(entry.data)
    appendLog(entry)
  }

  info(message: string, data?: Record<string, any>) {
    if (!shouldLog('INFO')) return
    const entry = buildEntry('INFO', this.name, message, data)
    console.info(formatConsoleMessage(entry), LEVEL_COLORS.INFO)
    if (entry.data) console.info(entry.data)
    appendLog(entry)
  }

  warn(message: string, data?: Record<string, any>) {
    if (!shouldLog('WARN')) return
    const entry = buildEntry('WARN', this.name, message, data)
    console.warn(formatConsoleMessage(entry), LEVEL_COLORS.WARN)
    if (entry.data) console.warn(entry.data)
    appendLog(entry)
  }

  error(message: string, error?: Error | unknown, data?: Record<string, any>) {
    if (!shouldLog('ERROR')) return
    const entry = buildEntry('ERROR', this.name, message, data, error)
    console.error(formatConsoleMessage(entry), LEVEL_COLORS.ERROR)
    if (entry.data) console.error(entry.data)
    if (entry.error?.stack) console.error(entry.error.stack)
    appendLog(entry)
  }
}

const loggerInstances: Record<string, Logger> = {}

export function getLogger(name: string): Logger {
  if (!loggerInstances[name]) {
    loggerInstances[name] = new Logger(name)
  }
  return loggerInstances[name]
}

export function getAllLogs(): LogEntry[] {
  return loadLogs()
}

export function getLogsByLevel(level: LogLevel): LogEntry[] {
  return loadLogs().filter((e) => e.level === level)
}

export function clearLogs() {
  localStorage.removeItem(LOG_STORAGE_KEY)
}

export function exportLogsAsFile() {
  const logs = loadLogs()
  const jsonl = logs.map((e) => JSON.stringify(e)).join('\n')
  const blob = new Blob([jsonl], { type: 'application/x-ndjson;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = LOG_FILE_NAME
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

window.addEventListener('error', (event) => {
  const logger = getLogger('global')
  logger.error(
    'Uncaught error',
    event.error,
    {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      event_type: 'window_error',
    },
  )
})

window.addEventListener('unhandledrejection', (event) => {
  const logger = getLogger('global')
  logger.error(
    'Unhandled promise rejection',
    event.reason,
    { event_type: 'unhandled_rejection' },
  )
})
