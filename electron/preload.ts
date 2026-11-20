import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

const on = <T>(channel: string, callback: (payload: T) => void) => {
  const listener = (_event: IpcRendererEvent, payload: T) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

const update = {
  getState: () => ipcRenderer.invoke('update:get-state'),
  check: () => ipcRenderer.invoke('update:check'),
  download: () => ipcRenderer.invoke('update:download'),
  cancel: () => ipcRenderer.invoke('update:cancel'),
  install: () => ipcRenderer.invoke('update:install'),
  dismiss: (version: string) => ipcRenderer.invoke('update:dismiss', version),
  openRelease: () => ipcRenderer.invoke('update:open-release'),
  ackPrepare: () => ipcRenderer.send('update:prepare-ack'),
  onState: (callback: (state: unknown) => void) => on('update:state', callback),
  onPrepare: (callback: () => void) => on('update:prepare', callback),
  onNotice: (callback: (message: string) => void) => on('update:notice', callback),
}

/** 只暴露必要的只读信息与更新操作，不暴露 ipcRenderer 本身 */
contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  update,
})
