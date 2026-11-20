/** 主进程通过 preload 暴露的桌面能力；Web 构建中 window.desktop 不存在 */
export type DesktopUpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'

export type DesktopUpdateState = {
  phase: DesktopUpdatePhase
  currentVersion: string
  latestVersion: string | null
  progress: number | null
  error: string | null
  dismissed: boolean
  canDownload: boolean
  canInstall: boolean
  releaseUrl: string | null
  supported: boolean
}

export type DesktopApi = {
  isDesktop: true
  platform: string
  versions: { electron: string; chrome: string; node: string }
  update: {
    getState: () => Promise<DesktopUpdateState>
    check: () => Promise<unknown>
    download: () => Promise<unknown>
    cancel: () => Promise<unknown>
    install: () => Promise<boolean>
    dismiss: (version: string) => Promise<DesktopUpdateState>
    openRelease: () => Promise<void>
    ackPrepare: () => void
    onState: (callback: (state: DesktopUpdateState) => void) => () => void
    onPrepare: (callback: () => void) => () => void
    onNotice: (callback: (message: string) => void) => () => void
  }
}

export const desktopApi = (): DesktopApi | null => {
  if (typeof window === 'undefined') {
    return null
  }
  return window.desktop ?? null
}
