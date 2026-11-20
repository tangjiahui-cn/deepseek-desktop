import {
  app,
  BrowserWindow,
  dialog,
  Notification,
  shell,
  type MessageBoxOptions,
} from 'electron'
import { autoUpdater, CancellationToken } from 'electron-updater'
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { DISPLAY_NAME, RELEASES_URL, releasePageUrl } from './constants'

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'

export type UpdateState = {
  phase: UpdatePhase
  currentVersion: string
  latestVersion: string | null
  progress: number | null
  error: string | null
  dismissed: boolean
  canDownload: boolean
  canInstall: boolean
  releaseUrl: string | null
  /** 当前平台是否支持在应用内下载/安装；macOS 与 deb 为 false */
  supported: boolean
}

type InitOptions = {
  getWindow: () => BrowserWindow | null
}

const isZh = () => app.getLocale().toLowerCase().startsWith('zh')
const text = (zhText: string, enText: string) => (isZh() ? zhText : enText)

const supportsInAppUpdate = () =>
  process.platform === 'win32' || (process.platform === 'linux' && Boolean(process.env.APPIMAGE))

let state: UpdateState = {
  phase: 'idle',
  currentVersion: app.getVersion(),
  latestVersion: null,
  progress: null,
  error: null,
  dismissed: false,
  canDownload: false,
  canInstall: false,
  releaseUrl: null,
  supported: supportsInAppUpdate(),
}

let getWindow: () => BrowserWindow | null = () => null
let dismissedVersion: string | null = null
let lastCheckManual = false
let downloadToken: CancellationToken | null = null
let cancelRequested = false
let installRequested = false
let updating = false
let allowQuit = false
let quitPromptOpen = false
let prepareAckResolver: (() => void) | null = null
let interruptedVersion: string | null = null
let initialized = false
const pendingNotices: string[] = []

const preferencesPath = () => path.join(app.getPath('userData'), 'update-preferences.json')
const markerPath = () => path.join(app.getPath('userData'), 'installing-update.json')
const appCacheRoot = () => {
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA ?? path.join(app.getPath('home'), 'AppData', 'Local')
  }
  if (process.platform === 'darwin') {
    return path.join(app.getPath('home'), 'Library', 'Caches')
  }
  return process.env.XDG_CACHE_HOME ?? path.join(app.getPath('home'), '.cache')
}

// 与 app-update.yml 的 updaterCacheDirName 保持一致
const pendingDir = () => path.join(appCacheRoot(), __UPDATER_CACHE_DIR__, 'pending')

const loadPreferences = () => {
  try {
    const value: unknown = JSON.parse(readFileSync(preferencesPath(), 'utf8'))
    if (
      typeof value === 'object' &&
      value !== null &&
      'dismissedUpdateVersion' in value &&
      typeof value.dismissedUpdateVersion === 'string'
    ) {
      dismissedVersion = value.dismissedUpdateVersion
    }
  } catch {
    // 没有偏好文件或文件损坏时按未忽略处理
  }
}

const savePreferences = () => {
  try {
    writeFileSync(preferencesPath(), JSON.stringify({ dismissedUpdateVersion: dismissedVersion }))
  } catch (error) {
    console.error('[updater] failed to persist preferences', error)
  }
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

const broadcast = () => {
  const win = getWindow()
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
    win.webContents.send('update:state', state)
  }
}

const notice = (message: string) => {
  const win = getWindow()
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
    win.webContents.send('update:notice', message)
  } else {
    pendingNotices.push(message)
  }
}

const setState = (patch: Partial<UpdateState>) => {
  state = { ...state, ...patch }
  state.canDownload =
    state.supported && (state.phase === 'available' || state.phase === 'error') && !!state.latestVersion
  state.canInstall = state.supported && state.phase === 'downloaded'
  broadcast()
}

const clearPendingCache = () => {
  try {
    rmSync(pendingDir(), { recursive: true, force: true })
  } catch (error) {
    console.error('[updater] failed to clear pending cache', error)
  }
}

/** 启动时清掉上次中断留下的临时包；已下载完整的缓存保留，供再次点击更新时复用 */
const cleanupStalePending = () => {
  const dir = pendingDir()
  if (!existsSync(dir)) {
    return
  }
  let valid = false
  try {
    const info: unknown = JSON.parse(readFileSync(path.join(dir, 'update-info.json'), 'utf8'))
    const fileName =
      typeof info === 'object' &&
      info !== null &&
      'fileName' in info &&
      typeof info.fileName === 'string'
        ? info.fileName
        : null
    valid = Boolean(fileName && existsSync(path.join(dir, path.basename(fileName))))
  } catch {
    valid = false
  }
  if (!valid) {
    clearPendingCache()
    return
  }
  try {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('temp-')) {
        rmSync(path.join(dir, name), { recursive: true, force: true })
      }
    }
  } catch {
    // 清理失败不阻塞启动
  }
}

const writeInstallMarker = () => {
  try {
    writeFileSync(markerPath(), JSON.stringify({ version: app.getVersion(), startedAt: Date.now() }))
  } catch (error) {
    console.error('[updater] failed to write install marker', error)
  }
}

const removeInstallMarker = () => {
  try {
    rmSync(markerPath(), { force: true })
  } catch {
    // 忽略
  }
}

/**
 * 启动时检查安装标记：
 * - 版本已变化：安装成功，静默清理
 * - 版本没变且刚启动安装：提示正在安装并退出，避免和安装程序抢文件
 * - 版本没变且已过去一段时间：视为安装中断，提示后允许重新下载
 */
export const checkInstallMarker = async (): Promise<'quit' | 'continue'> => {
  if (!existsSync(markerPath())) {
    return 'continue'
  }
  try {
    const marker: unknown = JSON.parse(readFileSync(markerPath(), 'utf8'))
    const version =
      typeof marker === 'object' &&
      marker !== null &&
      'version' in marker &&
      typeof marker.version === 'string'
        ? marker.version
        : null
    const startedAt =
      typeof marker === 'object' &&
      marker !== null &&
      'startedAt' in marker &&
      typeof marker.startedAt === 'number'
        ? marker.startedAt
        : 0
    if (!version || version !== app.getVersion()) {
      removeInstallMarker()
      return 'continue'
    }
    if (Date.now() - startedAt < 2 * 60 * 1000) {
      await dialog.showMessageBox({
        type: 'info',
        title: DISPLAY_NAME,
        message: text('更新正在安装', 'Update in progress'),
        detail: text(
          '安装程序仍在运行，请稍候再启动应用。',
          'The installer is still running. Please start the app again later.'
        ),
      })
      return 'quit'
    }
    removeInstallMarker()
    interruptedVersion = version
    dismissedVersion = null
    savePreferences()
  } catch {
    removeInstallMarker()
  }
  return 'continue'
}

export const getInterruptedVersion = () => interruptedVersion

const showDownloadedNotification = () => {
  const win = getWindow()
  if (win?.isFocused() || !Notification.isSupported()) {
    return
  }
  const notification = new Notification({
    title: DISPLAY_NAME,
    body: text('更新已下载，点击打开应用完成安装', 'Update downloaded. Open the app to install it.'),
  })
  notification.on('click', () => {
    const target = getWindow()
    if (target && !target.isDestroyed()) {
      if (target.isMinimized()) {
        target.restore()
      }
      target.show()
      target.focus()
    }
  })
  notification.show()
}

const setupListeners = () => {
  autoUpdater.on('checking-for-update', () => {
    setState({ phase: 'checking', error: null, progress: null })
  })

  autoUpdater.on('update-available', (info) => {
    const version = info.version
    setState({
      phase: 'available',
      latestVersion: version,
      progress: null,
      error: null,
      dismissed: !lastCheckManual && dismissedVersion === version,
      releaseUrl: releasePageUrl(version),
    })
    lastCheckManual = false
  })

  autoUpdater.on('update-not-available', () => {
    setState({
      phase: 'idle',
      latestVersion: null,
      progress: null,
      error: null,
      dismissed: false,
      releaseUrl: null,
    })
    if (lastCheckManual) {
      notice(text('已是最新版本', 'You are up to date.'))
    }
    lastCheckManual = false
  })

  autoUpdater.on('download-progress', (progress) => {
    if (cancelRequested) {
      return
    }
    setState({
      phase: 'downloading',
      progress: Math.max(0, Math.min(100, progress.percent)),
    })
  })

  autoUpdater.on('update-downloaded', (event) => {
    if (cancelRequested) {
      return
    }
    downloadToken = null
    cancelRequested = false
    setState({
      phase: 'downloaded',
      latestVersion: event.version ?? state.latestVersion,
      progress: 100,
      error: null,
      dismissed: false,
      releaseUrl: releasePageUrl(event.version ?? state.latestVersion ?? app.getVersion()),
    })
    showDownloadedNotification()
  })

  autoUpdater.on('update-cancelled', () => {
    if (downloadToken?.cancelled) {
      setState({ phase: 'available', progress: null })
    }
  })

  autoUpdater.on('error', (error) => {
    if (cancelRequested || downloadToken?.cancelled || updating) {
      return
    }
    const message = messageOf(error)
    if (state.phase === 'downloaded') {
      notice(text(`更新失败：${message}`, `Update failed: ${message}`))
      return
    }
    setState({ phase: 'error', progress: null, error: message })
    notice(text(`更新失败：${message}`, `Update failed: ${message}`))
  })
}

export const initUpdater = (options: InitOptions) => {
  if (initialized) {
    getWindow = options.getWindow
    return
  }
  initialized = true
  getWindow = options.getWindow

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false
  autoUpdater.allowDowngrade = false
  autoUpdater.fullChangelog = false
  autoUpdater.logger = {
    info: (...args: unknown[]) => console.info('[updater]', ...args),
    warn: (...args: unknown[]) => console.warn('[updater]', ...args),
    error: (...args: unknown[]) => console.error('[updater]', ...args),
    debug: (...args: unknown[]) => {
      if (!app.isPackaged) {
        console.debug('[updater]', ...args)
      }
    },
  }

  loadPreferences()
  cleanupStalePending()
  state = {
    ...state,
    currentVersion: app.getVersion(),
    supported: supportsInAppUpdate(),
  }
  setupListeners()
}

export const getUpdateState = (): UpdateState => state

export const flushUpdaterNotices = () => {
  const win = getWindow()
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) {
    return
  }
  for (const message of pendingNotices.splice(0)) {
    win.webContents.send('update:notice', message)
  }
}

export const checkForUpdates = async (manual = false) => {
  if (!app.isPackaged) {
    if (manual) {
      notice(text('开发模式不检查更新', 'Update checks are disabled in development.'))
    }
    return null
  }
  if (state.phase === 'downloading' || state.phase === 'downloaded' || state.phase === 'installing') {
    if (manual) {
      notice(text('更新已下载，请先完成安装', 'An update is ready. Please install it first.'))
    }
    return null
  }

  lastCheckManual = manual
  if (manual) {
    dismissedVersion = null
    savePreferences()
    setState({ dismissed: false })
  }
  setState({ phase: 'checking', error: null, progress: null })

  try {
    return await autoUpdater.checkForUpdates()
  } catch (error) {
    const message = messageOf(error)
    setState({ phase: 'error', error: message, progress: null })
    if (manual) {
      notice(text(`检查更新失败：${message}`, `Failed to check for updates: ${message}`))
    }
    lastCheckManual = false
    return null
  }
}

export const openReleasePage = () => {
  const version = state.latestVersion
  void shell.openExternal(version ? releasePageUrl(version) : RELEASES_URL)
}

export const downloadUpdate = async () => {
  if (!state.supported) {
    openReleasePage()
    return state
  }
  if (state.phase === 'downloading' || !state.latestVersion) {
    return state
  }
  if (state.phase !== 'available' && state.phase !== 'error') {
    return state
  }

  cancelRequested = false
  downloadToken = new CancellationToken()
  setState({ phase: 'downloading', progress: 0, error: null, dismissed: false })

  try {
    await autoUpdater.downloadUpdate(downloadToken)
  } catch (error) {
    if (cancelRequested || downloadToken?.cancelled) {
      clearPendingCache()
      setState({ phase: 'available', progress: null, error: null })
    } else {
      const message = messageOf(error)
      setState({ phase: 'error', progress: null, error: message })
      notice(text(`下载更新失败：${message}`, `Failed to download the update: ${message}`))
    }
  } finally {
    downloadToken = null
    cancelRequested = false
  }
  return state
}

export const cancelDownload = () => {
  cancelRequested = true
  downloadToken?.cancel()
  setState({ phase: 'available', progress: null })
}

export const dismissUpdate = (version: string) => {
  if (state.phase === 'downloading' || state.phase === 'installing') {
    return state
  }
  if (version !== state.latestVersion) {
    return state
  }
  dismissedVersion = version
  savePreferences()
  setState({ dismissed: true })
  return state
}

const requestRendererPrepare = async () => {
  const win = getWindow()
  if (!win || win.isDestroyed() || win.webContents.isDestroyed()) {
    return
  }
  await new Promise<void>((resolve) => {
    let settled = false
    const finish = () => {
      if (!settled) {
        settled = true
        prepareAckResolver = null
        resolve()
      }
    }
    prepareAckResolver = finish
    win.webContents.send('update:prepare')
    setTimeout(finish, 2000)
  })
}

const performInstall = () => {
  updating = true
  allowQuit = true
  setState({ phase: 'installing' })
  writeInstallMarker()
  try {
    autoUpdater.quitAndInstall(true, true)
  } catch (error) {
    removeInstallMarker()
    updating = false
    allowQuit = false
    installRequested = false
    const message = messageOf(error)
    setState({ phase: 'downloaded', error: message })
    notice(text(`安装更新失败：${message}`, `Failed to install the update: ${message}`))
  }
}

export const installUpdate = async (): Promise<boolean> => {
  if (state.phase !== 'downloaded' || !state.supported || installRequested) {
    return false
  }
  installRequested = true
  await requestRendererPrepare()
  performInstall()
  return true
}

export const ackPrepare = () => {
  prepareAckResolver?.()
}

const promptToInstallOnQuit = async () => {
  const options: MessageBoxOptions = {
    type: 'question',
    title: DISPLAY_NAME,
    message: text('更新已下载', 'Update downloaded'),
    detail: text(
      `新版本 v${state.latestVersion ?? ''} 已下载。现在安装并退出，还是直接退出？`,
      `Version v${state.latestVersion ?? ''} is ready. Install and quit, or quit without installing?`
    ),
    buttons: [
      text('安装并退出', 'Install and Quit'),
      text('直接退出', 'Quit Without Installing'),
      text('取消', 'Cancel'),
    ],
    defaultId: 0,
    cancelId: 2,
  }
  const parent = getWindow()
  // 窗口可能被 Cmd+W 隐藏；隐藏窗口上的 sheet 不可见，改用独立对话框
  const visibleParent = parent != null && parent.isVisible() ? parent : null
  const result = visibleParent
    ? await dialog.showMessageBox(visibleParent, options)
    : await dialog.showMessageBox(options)

  if (result.response === 0) {
    allowQuit = true
    void installUpdate()
    return
  }
  if (result.response === 1) {
    allowQuit = true
    app.quit()
  }
}

/** 主进程 before-quit 的拦截：下载中取消，已下载时询问 */
export const handleBeforeQuit = async (event: { preventDefault: () => void }) => {
  if (allowQuit || updating) {
    return
  }
  if (state.phase === 'downloading') {
    cancelRequested = true
    downloadToken?.cancel()
    allowQuit = true
    return
  }
  if (state.phase !== 'downloaded') {
    return
  }

  event.preventDefault()
  if (quitPromptOpen) {
    return
  }
  quitPromptOpen = true
  try {
    await promptToInstallOnQuit()
  } finally {
    quitPromptOpen = false
  }
}

export const openReleaseFromMenu = () => openReleasePage()
