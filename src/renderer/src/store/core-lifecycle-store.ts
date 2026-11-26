import { create } from 'zustand'
import { getCoreState, mihomoGroups } from '@renderer/utils/ipc'

// Wait until mihomo has fully loaded all proxy providers / groups (or timeout).
// Mihomo emits "RESTful API listening" immediately but loads remote proxy-providers
// asynchronously — groups are empty until all providers finish loading.
// Without this wait the UI shows VPN as "connected" but traffic doesn't route.
const waitForGroupsReady = async (maxAttempts = 15, intervalMs = 500): Promise<void> => {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const groups = await mihomoGroups()
      // Consider ready when at least one group has proxies loaded
      if (Array.isArray(groups) && groups.length > 0 && groups.some((g) => g.all?.length > 0)) {
        return
      }
    } catch {
      // API not ready yet — keep polling
    }
    await new Promise<void>((resolve) => setTimeout(resolve, intervalMs))
  }
  // Timed out — proceed anyway so the UI doesn't freeze
}

interface CoreLifecycleStore {
  startedAt: number
  coreState: CoreState
  // `at` of the error the user closed; a newer error opens the alert again
  dismissedErrorAt: number
}

export const useCoreLifecycleStore = create<CoreLifecycleStore>(() => ({
  startedAt: 0,
  coreState: { status: 'stopped' },
  dismissedErrorAt: 0
}))

export const subscribeCoreStarted = (callback: () => void): (() => void) =>
  useCoreLifecycleStore.subscribe((state, previous) => {
    if (state.startedAt !== previous.startedAt) callback()
  })

export const dismissCoreError = (): void => {
  const { error } = useCoreLifecycleStore.getState().coreState
  useCoreLifecycleStore.setState({ dismissedErrorAt: error?.at ?? 0 })
}

export const reopenCoreError = (): void => {
  useCoreLifecycleStore.setState({ dismissedErrorAt: 0 })
}

let attached = false
let ipcListener: (() => void) | null = null
let coreStateListener: ((_event: unknown, coreState: CoreState) => void) | null = null

const mapCoreErrorReason = (reason: unknown): CoreErrorReason => {
  switch (reason) {
    case 'binary-missing':
    case 'core_missing':
    case 'core_invalid':
      return 'binary-missing'
    case 'config-invalid':
    case 'profile_error':
    case 'config_error':
      return 'config-invalid'
    default:
      return 'crashed'
  }
}

const normalizeCoreState = (coreState: CoreState): CoreState => {
  if (!coreState?.error) return coreState
  const rawErr = coreState.error as CoreState['error'] & { message?: string }
  return {
    ...coreState,
    error: {
      reason: mapCoreErrorReason(rawErr.reason),
      detail: rawErr.detail || rawErr.message || '',
      at: typeof rawErr.at === 'number' && rawErr.at > 0 ? rawErr.at : Date.now()
    }
  }
}

export const attachCoreLifecycleStore = (): (() => void) => {
  if (attached) {
    return () => {
      /* already attached, noop detach */
    }
  }
  attached = true

  ipcListener = (): void => {
    // Wait for mihomo to finish loading proxy providers before marking core as started.
    // Without this, logs are empty and traffic doesn't route for ~30-60s after enabling VPN.
    waitForGroupsReady().then(() => {
      useCoreLifecycleStore.setState({ startedAt: Date.now() })
    })
  }
  window.electron.ipcRenderer.on('core-started', ipcListener)

  coreStateListener = (_event, coreState): void => {
    useCoreLifecycleStore.setState({ coreState: normalizeCoreState(coreState) })
  }
  window.electron.ipcRenderer.on('coreStateChanged', coreStateListener)
  // A failure at startup can happen before this window was listening for events
  getCoreState()
    .then((coreState) => {
      const normalized = normalizeCoreState(coreState)
      useCoreLifecycleStore.setState({ coreState: normalized })
      if (normalized?.status === 'running' && useCoreLifecycleStore.getState().startedAt === 0) {
        waitForGroupsReady().then(() => {
          if (useCoreLifecycleStore.getState().startedAt === 0) {
            useCoreLifecycleStore.setState({ startedAt: Date.now() })
          }
        })
      }
    })
    .catch(() => {})

  return (): void => {
    if (!attached) return
    attached = false
    if (ipcListener) {
      window.electron.ipcRenderer.removeListener('core-started', ipcListener)
      ipcListener = null
    }
    if (coreStateListener) {
      window.electron.ipcRenderer.removeListener('coreStateChanged', coreStateListener)
      coreStateListener = null
    }
  }
}
