import {
  app,
  dialog,
  Menu,
  shell,
  type BrowserWindow,
  type MenuItemConstructorOptions,
} from 'electron'
import { PRODUCT_NAME, RELEASES_URL } from './constants'

const isZh = () => app.getLocale().toLowerCase().startsWith('zh')
const text = (zhText: string, enText: string) => (isZh() ? zhText : enText)

export const showAbout = async (getWindow: () => BrowserWindow | null) => {
  const parent = getWindow()
  const options = {
    type: 'info' as const,
    title: text('关于', 'About'),
    message: `${PRODUCT_NAME} ${app.getVersion()}`,
    detail: [
      `Electron ${process.versions.electron}`,
      `Chromium ${process.versions.chrome}`,
      `Node.js ${process.versions.node}`,
    ].join('\n'),
  }
  if (parent) {
    await dialog.showMessageBox(parent, options)
  } else {
    await dialog.showMessageBox(options)
  }
}

type MenuOptions = {
  isDev: boolean
  onCheckUpdates: () => void
  getWindow: () => BrowserWindow | null
}

/** 菜单文案跟随系统语言，应用内切换语言不重建菜单 */
export const createAppMenu = ({ isDev, onCheckUpdates, getWindow }: MenuOptions) => {
  const checkUpdatesLabel = text('检查更新…', 'Check for Updates…')
  const releasesLabel = text('发布页面', 'Releases')
  const aboutLabel = text(`关于 ${PRODUCT_NAME}`, `About ${PRODUCT_NAME}`)
  const template: MenuItemConstructorOptions[] = []

  if (process.platform === 'darwin') {
    template.push({
      label: app.name,
      submenu: [
        { label: aboutLabel, click: () => void showAbout(getWindow) },
        { type: 'separator' },
        { label: checkUpdatesLabel, click: onCheckUpdates },
        { type: 'separator' },
        { role: 'hide', label: text('隐藏', 'Hide') },
        { role: 'hideOthers', label: text('隐藏其他', 'Hide Others') },
        { role: 'unhide', label: text('显示全部', 'Show All') },
        { type: 'separator' },
        { role: 'quit', label: text(`退出 ${PRODUCT_NAME}`, `Quit ${PRODUCT_NAME}`) },
      ],
    })
  } else {
    template.push({
      label: text('文件', 'File'),
      submenu: [
        {
          label: checkUpdatesLabel,
          click: onCheckUpdates,
        },
        { type: 'separator' },
        { role: 'quit', label: text('退出', 'Quit') },
      ],
    })
  }

  template.push({
    label: text('编辑', 'Edit'),
    submenu: [
      { role: 'undo', label: text('撤销', 'Undo') },
      { role: 'redo', label: text('重做', 'Redo') },
      { type: 'separator' },
      { role: 'cut', label: text('剪切', 'Cut') },
      { role: 'copy', label: text('复制', 'Copy') },
      { role: 'paste', label: text('粘贴', 'Paste') },
      { role: 'selectAll', label: text('全选', 'Select All') },
    ],
  })

  const viewSubmenu: MenuItemConstructorOptions[] = []
  if (isDev) {
    viewSubmenu.push(
      { role: 'reload', label: text('重新加载', 'Reload') },
      { role: 'toggleDevTools', label: text('开发者工具', 'Toggle Developer Tools') },
      { type: 'separator' }
    )
  }
  viewSubmenu.push(
    { role: 'resetZoom', label: text('实际大小', 'Actual Size') },
    { role: 'zoomIn', label: text('放大', 'Zoom In') },
    { role: 'zoomOut', label: text('缩小', 'Zoom Out') },
    { type: 'separator' },
    { role: 'togglefullscreen', label: text('全屏', 'Toggle Full Screen') }
  )
  template.push({ label: text('视图', 'View'), submenu: viewSubmenu })

  template.push({
    label: text('窗口', 'Window'),
    submenu: [
      { role: 'minimize', label: text('最小化', 'Minimize') },
      { role: 'zoom', label: text('缩放', 'Zoom') },
      { role: 'close', label: text('关闭', 'Close') },
    ],
  })

  const helpSubmenu: MenuItemConstructorOptions[] = [
    { label: checkUpdatesLabel, click: onCheckUpdates },
    {
      label: releasesLabel,
      click: () => void shell.openExternal(RELEASES_URL),
    },
  ]
  if (process.platform !== 'darwin') {
    helpSubmenu.push(
      { type: 'separator' },
      { label: aboutLabel, click: () => void showAbout(getWindow) }
    )
  }
  template.push({ label: text('帮助', 'Help'), submenu: helpSubmenu })

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
