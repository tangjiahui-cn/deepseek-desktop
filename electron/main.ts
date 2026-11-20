import { app, BrowserWindow, dialog, ipcMain, nativeTheme } from 'electron'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { APP_ID, APP_ORIGIN, PRODUCT_NAME } from './constants'
import { createAppMenu } from './menu'
import { registerAppProtocol, registerAppScheme } from './protocol'
import { attachSecurity, setupDownloads, setupPermissions } from './security'
import {
  ackPrepare,
  cancelDownload,
  checkForUpdates,
  checkInstallMarker,
  dismissUpdate,
  downloadUpdate,
  flushUpdaterNotices,
  getInterruptedVersion,
  getUpdateState,
  handleBeforeQuit,
  initUpdater,
  installUpdate,
  openReleasePage,
} from './updater'
import { attachWindowState, loadWindowState, MIN_WINDOW_SIZE } from './windowState'

// 自定义协议必须在 app ready 之前注册，否则 web storage 不会启用
registerAppScheme()

let mainWindow: BrowserWindow | null = null
/** 真正退出应用时为 true；macOS 的 Cmd+W 只隐藏窗口，保留 renderer 状态 */
let quitting = false

const getMainWindow = () => mainWindow

const rendererRoot = () =>
  app.isPackaged ? path.join(app.getAppPath(), 'dist') : path.join(__dirname, '../../dist')

const createMainWindow = () => {
  const state = loadWindowState()
  const win = new BrowserWindow({
    ...state,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    show: false,
    title: PRODUCT_NAME,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1f1f1f' : '#ffffff',
    icon: app.isPackaged ? undefined : path.join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  attachWindowState(win)
  attachSecurity(win.webContents, { allowPreview: true, getMainWindow })

  win.on('page-title-updated', (event) => {
    event.preventDefault()
    win.setTitle(PRODUCT_NAME)
  })
  // macOS 上 Cmd+W / 红色关闭按钮只隐藏窗口：renderer 不销毁，输入框、
  // 草稿、附件和滚动位置都保留；真正退出（Cmd+Q / 菜单）时放行。
  win.on('close', (event) => {
    if (process.platform === 'darwin' && !quitting) {
      event.preventDefault()
      win.hide()
    }
  })
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (mainWindow === win) {
      mainWindow = null
    }
  })

  win.webContents.once('did-finish-load', () => {
    flushUpdaterNotices()
    if (!app.isPackaged) {
      return
    }
    const interrupted = getInterruptedVersion() !== null
    setTimeout(() => {
      void checkForUpdates(false)
    }, interrupted ? 0 : 10_000)
    if (interrupted) {
      void showInterruptedNotice(win)
    }
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadURL(`${APP_ORIGIN}/`)
  }
  return win
}

const showInterruptedNotice = async (win: BrowserWindow) => {
  if (win.isDestroyed()) {
    return
  }
  await dialog.showMessageBox(win, {
    type: 'info',
    title: PRODUCT_NAME,
    message: app.getLocale().toLowerCase().startsWith('zh')
      ? '上次更新未完成'
      : 'The last update did not finish',
    detail: app.getLocale().toLowerCase().startsWith('zh')
      ? '应用仍是旧版本，可以重新下载并安装更新。'
      : 'The app is still on the previous version. You can download and install the update again.',
  })
}

const registerIpc = () => {
  ipcMain.handle('update:get-state', () => getUpdateState())
  ipcMain.handle('update:check', () => checkForUpdates(true))
  ipcMain.handle('update:download', () => downloadUpdate())
  ipcMain.handle('update:cancel', () => cancelDownload())
  ipcMain.handle('update:install', () => installUpdate())
  ipcMain.handle('update:dismiss', (_event, version: unknown) =>
    dismissUpdate(typeof version === 'string' ? version : '')
  )
  ipcMain.handle('update:open-release', () => openReleasePage())
  ipcMain.on('update:prepare-ack', () => ackPrepare())
}

const start = () => {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.show()
      mainWindow.focus()
      return
    }
    mainWindow = createMainWindow()
  })

  app.on('before-quit', (event) => {
    void handleBeforeQuit(event)
    // handleBeforeQuit 在需要弹「安装并退出」时会同步 preventDefault；
    // 只有没有被拦下时才允许窗口 close 事件销毁 renderer。
    if (!event.defaultPrevented) {
      quitting = true
    }
  })

  void app.whenReady().then(async () => {
    if (process.platform === 'win32') {
      // 通知与任务栏归组依赖 AppUserModelID
      app.setAppUserModelId(APP_ID)
    }

    setupPermissions()
    setupDownloads(getMainWindow)
    registerAppProtocol(rendererRoot(), __API_ORIGIN__)
    initUpdater({ getWindow: getMainWindow })
    registerIpc()

    const marker = await checkInstallMarker()
    if (marker === 'quit') {
      app.quit()
      return
    }

    mainWindow = createMainWindow()
    createAppMenu({
      isDev: !app.isPackaged,
      onCheckUpdates: () => void checkForUpdates(true),
      getWindow: getMainWindow,
    })
  })
}

app.setName(PRODUCT_NAME)
if (!app.isPackaged) {
  // 开发数据与正式安装隔离，避免开发时的会话污染真实数据；
  // 单实例锁也要在改路径之后申请，否则开发版和正式版会互相抢锁
  const devUserData = path.join(app.getPath('appData'), `${PRODUCT_NAME} (dev)`)
  try {
    mkdirSync(devUserData, { recursive: true })
  } catch {
    // 无法创建时仍设置路径，由 Electron 决定是否能继续（例如受限的沙箱环境）
  }
  app.setPath('userData', devUserData)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  start()
}
