import { create } from 'zustand'
import dayjs from 'dayjs'
import { getBufferedLogs } from '@renderer/utils/ipc'

const MAX_LOGS = 500
// The core can emit bursts of lines; batching keeps the list at one update per tick.
const FLUSH_INTERVAL = 100

export interface LogEntry extends ControllerLog {
  // Sequence number in arrival order, shown in the row
  id: number
  // Full date and time, shown on hover
  time: string
  // Time only, shown in the row. Fixed width keeps the level badges aligned across rows.
  clock: string
}

interface LogsStore {
  // Newest first
  logs: LogEntry[]
  clear: () => void
}

let nextId = 1
let pending: LogEntry[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

// Drops unflushed lines and restarts numbering, so the first line after a clear is #1 again.
const reset = (): void => {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  pending = []
  nextId = 1
}

export const useLogsStore = create<LogsStore>((set) => ({
  logs: [],
  clear: (): void => {
    reset()
    set({ logs: [] })
  }
}))

const flush = (): void => {
  flushTimer = null
  const next = pending.reverse().concat(useLogsStore.getState().logs)
  pending = []
  useLogsStore.setState({ logs: next.length > MAX_LOGS ? next.slice(0, MAX_LOGS) : next })
}

const toLogEntry = (log: ControllerLog): LogEntry => {
  const now = dayjs()
  return {
    ...log,
    id: nextId++,
    time: now.format('L LTS'),
    clock: log.time || now.format('HH:mm:ss')
  }
}

const handleIpcPayload = (log: ControllerLog): void => {
  pending.push(toLogEntry(log))
  if (!flushTimer) {
    flushTimer = setTimeout(flush, FLUSH_INTERVAL)
  }
}

let attached = false
let ipcListener: ((event: unknown, payload: ControllerLog) => void) | null = null

export const attachLogsStore = (): (() => void) => {
  if (attached) {
    return () => {
      /* already attached, noop detach */
    }
  }
  attached = true

  let seeded = false
  const liveBeforeSeed: ControllerLog[] = []

  ipcListener = (_event, payload): void => {
    if (!seeded) {
      liveBeforeSeed.push(payload)
      return
    }
    handleIpcPayload(payload)
  }
  window.electron.ipcRenderer.on('mihomoLogs', ipcListener)

  // Hydrate logs captured by the Rust backend before WebView mounted (cold boot / silentStart).
  getBufferedLogs()
    .then((buffered) => {
      if (!attached) return
      const initial = Array.isArray(buffered) ? buffered : []
      // Drop leading overlap if any live event arrived concurrently while getBufferedLogs resolved
      const tail = initial.slice(-10)
      let startIdx = 0
      while (
        startIdx < liveBeforeSeed.length &&
        tail.some(
          (b) =>
            b.payload === liveBeforeSeed[startIdx].payload &&
            b.type === liveBeforeSeed[startIdx].type &&
            b.time === liveBeforeSeed[startIdx].time
        )
      ) {
        startIdx++
      }
      const combined = initial.concat(liveBeforeSeed.slice(startIdx)).slice(-MAX_LOGS)
      const entriesNewestFirst = combined.map(toLogEntry).reverse()
      seeded = true
      liveBeforeSeed.length = 0
      useLogsStore.setState({ logs: entriesNewestFirst })
    })
    .catch(() => {
      if (!attached) return
      seeded = true
      const queued = liveBeforeSeed.splice(0, liveBeforeSeed.length)
      queued.forEach(handleIpcPayload)
    })

  return (): void => {
    if (!attached) return
    attached = false
    if (ipcListener) {
      window.electron.ipcRenderer.removeListener('mihomoLogs', ipcListener)
      ipcListener = null
    }
    reset()
    useLogsStore.setState({ logs: [] })
  }
}
