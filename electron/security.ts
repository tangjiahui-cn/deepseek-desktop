import {
  app,
  BrowserWindow,
  dialog,
  session,
  shell,
  systemPreferences,
  type DownloadItem,
  type Session,
  type WebContents,
} from 'electron'
import path from 'node:path'
import { APP_ORIGIN } from './constants'
import { openPreviewWindow } from './preview'

/** app://deepseek 是唯一允许承载界面的 origin */
export const isAppUrl = (value: string): boolean => {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}` === APP_ORIGIN
  } catch {
    return false
  }
}

const isDevRendererUrl = (value: string): boolean => {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (!devUrl) {
    return false
  }
  try {
    return new URL(value).origin === new URL(devUrl).origin
  } catch {
    return false
  }
}

const isTrustedRenderer = (value: string) => isAppUrl(value) || isDevRendererUrl(value)

const openExternal = (value: string) => {
  try {
    const url = new URL(value)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      void shell.openExternal(url.toString())
    }
  } catch {
    // 非法 URL 直接忽略
  }
}

/** 只允许应用自身发起媒体权限请求，其他权限一律拒绝 */
export const setupPermissions = (target: Session = session.defaultSession) => {
  target.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl ?? webContents.getURL()
    if (permission !== 'media' || !isTrustedRenderer(requestingUrl)) {
      callback(false)
      return
    }
    const mediaTypes = 'mediaTypes' in details ? (details.mediaTypes ?? []) : []
    if (mediaTypes.length > 0 && !mediaTypes.includes('audio')) {
      callback(false)
      return
    }
    if (process.platform === 'darwin') {
      systemPreferences.askForMediaAccess('microphone').then(callback, () => callback(false))
      return
    }
    callback(true)
  })

  target.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    if (permission !== 'media' || !isTrustedRenderer(requestingOrigin)) {
      return false
    }
    return details.mediaType === undefined || details.mediaType === 'audio'
  })
}

const saveDownload = async (
  item: DownloadItem,
  webContents: WebContents,
  getMainWindow: () => BrowserWindow | null
) => {
  const parent = BrowserWindow.fromWebContents(webContents) ?? getMainWindow()
  const filename = path.basename(item.getFilename()) || 'download'
  const defaultPath = path.join(app.getPath('downloads'), filename)
  const title = app.getLocale().toLowerCase().startsWith('zh') ? '保存文件' : 'Save File'

  try {
    item.pause()
  } catch {
    // 已经暂停或无法暂停时继续弹窗
  }

  try {
    const options = { title, defaultPath, buttonLabel: title }
    const result = parent
      ? await dialog.showSaveDialog(parent, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) {
      item.cancel()
      return
    }
    item.setSavePath(result.filePath)
    item.resume()
  } catch (error) {
    console.error('[download] save dialog failed', error)
    item.cancel()
  }
}

/** 所有下载都走系统保存对话框，避免文件静默落到未知目录 */
export const setupDownloads = (
  getMainWindow: () => BrowserWindow | null,
  target: Session = session.defaultSession
) => {
  target.on('will-download', (_event, item, webContents) => {
    void saveDownload(item, webContents, getMainWindow)
  })
}

type SecurityOptions = {
  allowPreview: boolean
  getMainWindow: () => BrowserWindow | null
}

/** 导航、window.open、webview 的统一收口 */
export const attachSecurity = (contents: WebContents, options: SecurityOptions) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (!options.allowPreview) {
      return { action: 'deny' }
    }
    if (url.startsWith('blob:')) {
      openPreviewWindow(url, options.getMainWindow())
      return { action: 'deny' }
    }
    openExternal(url)
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event, url) => {
    if (!isTrustedRenderer(url)) {
      event.preventDefault()
    }
  })
  contents.on('will-redirect', (event, url) => {
    if (!isTrustedRenderer(url)) {
      event.preventDefault()
    }
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
}
