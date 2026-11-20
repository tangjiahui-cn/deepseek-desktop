import { create } from 'zustand'
import { stopReadAloud } from '../speech/readAloud.js'
import { stopReply, useChatStore } from '../chat/store.js'
import { desktopApi, type DesktopUpdateState } from './api.js'

type DesktopUpdateStore = {
  state: DesktopUpdateState | null
}

export const useDesktopUpdate = create<DesktopUpdateStore>(() => ({ state: null }))

let initialized = false

const defaultDelay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** 安装前收尾：停掉所有生成中的回复与朗读，再给持久化一点时间 */
const prepareForInstall = async () => {
  const { streaming } = useChatStore.getState()
  for (const sessionId of Object.keys(streaming)) {
    stopReply(sessionId)
  }
  stopReadAloud()
  await defaultDelay(250)
}

/**
 * 订阅主进程的更新状态。只在桌面端生效；Web 构建下直接返回空清理函数。
 * onNotice 用于把主进程的提示（已是最新、检查失败等）接到应用内 toast。
 */
export const initDesktopUpdates = (options: {
  onNotice?: (message: string) => void
} = {}) => {
  const api = desktopApi()
  if (!api || initialized) {
    return () => {}
  }
  initialized = true
  let active = true

  const apply = (state: DesktopUpdateState) => {
    if (active) {
      useDesktopUpdate.setState({ state })
    }
  }

  void api.update.getState().then(apply).catch(() => {})
  const offState = api.update.onState(apply)
  const offNotice = api.update.onNotice((message) => options.onNotice?.(message))
  const offPrepare = api.update.onPrepare(() => {
    void prepareForInstall().then(() => api.update.ackPrepare())
  })

  return () => {
    active = false
    offState()
    offNotice()
    offPrepare()
    initialized = false
  }
}

export const checkDesktopUpdate = () => desktopApi()?.update.check()

export const downloadDesktopUpdate = () => desktopApi()?.update.download()

export const cancelDesktopUpdate = () => desktopApi()?.update.cancel()

export const openDesktopRelease = () => desktopApi()?.update.openRelease()

export const dismissDesktopUpdate = (version: string | null) => {
  if (version) {
    void desktopApi()?.update.dismiss(version)
  }
}

export const isGeneratingReply = () =>
  Object.keys(useChatStore.getState().streaming).length > 0

/** 用户点击「重启并安装」；是否中断当前回复由组件先确认 */
export const installDesktopUpdate = async () => {
  await desktopApi()?.update.install()
}
