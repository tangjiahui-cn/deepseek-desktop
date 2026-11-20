import { app, BrowserWindow } from 'electron'

const previewTitle = () => (app.getLocale().toLowerCase().startsWith('zh') ? '附件预览' : 'Attachment')

/**
 * 附件预览窗口：与主窗口隔离，没有 preload、没有 Node 能力。
 * PDF 需要开启 Chromium 内置 PDF 查看器（plugins），因此单独开这个窗口。
 */
export const openPreviewWindow = (url: string, parent: BrowserWindow | null) => {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 480,
    minHeight: 320,
    parent: parent ?? undefined,
    show: false,
    autoHideMenuBar: true,
    title: previewTitle(),
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      plugins: true,
    },
  })

  win.setMenuBarVisibility(false)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, target) => {
    if (!target.startsWith('blob:')) {
      event.preventDefault()
    }
  })
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())
  win.on('page-title-updated', (event) => {
    event.preventDefault()
  })
  win.once('ready-to-show', () => win.show())
  win.webContents.on('did-fail-load', (_event, code, description, validatedUrl) => {
    console.error('[preview] failed to load attachment', code, description, validatedUrl)
    win.close()
  })

  void win.loadURL(url)
  return win
}
