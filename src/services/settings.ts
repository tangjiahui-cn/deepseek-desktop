import { create } from 'zustand'
import type { TtsVoice } from './api/speech.js'
import { clampSystemPrompt } from './chat/systemPrompt.js'
import { normalizeLocation, type UserLocation } from './location.js'

export type Locale = 'zh-CN' | 'en-US'

/** 主题偏好；默认跟随系统 */
export type ThemePreference = 'light' | 'dark' | 'system'

/** 本机设置，存 localStorage：API Key、语言、主题、位置、朗读音色、自定义提示词、记忆开关、深度思考与智能搜索开关、侧边栏收起状态 */
type Settings = {
  apiKey: string | null
  locale: Locale
  themePreference: ThemePreference
  location: UserLocation | null
  ttsVoice: TtsVoice
  systemPrompt: string
  memoryEnabled: boolean
  memoryEnabledAt: number | null
  thinking: boolean
  search: boolean
  siderCollapsed: boolean
}

const KEYS = {
  apiKey: 'chat-demo:api-key',
  locale: 'chat-demo:locale',
  location: 'chat-demo:location',
  themePreference: 'chat-demo:theme-preference',
  ttsVoice: 'chat-demo:tts-voice',
  systemPrompt: 'chat-demo:system-prompt',
  memoryEnabled: 'chat-demo:memory-enabled',
  memoryEnabledAt: 'chat-demo:memory-enabled-at',
  thinking: 'chat-demo:thinking',
  search: 'chat-demo:search',
  siderCollapsed: 'chat-demo:sider-collapsed',
} as const

const read = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string | null) => {
  try {
    if (value === null) {
      localStorage.removeItem(key)
    } else {
      localStorage.setItem(key, value)
    }
  } catch {
    // 存储不可用时只在内存中生效
  }
}

/** 位置选择模式跟随浏览器语言，与应用内选择的界面语言无关。 */
export const isChineseBrowser = (): boolean =>
  (typeof navigator === 'undefined' ? 'zh' : navigator.language).toLowerCase().startsWith('zh')

const initialLocale = (): Locale => {
  const saved = read(KEYS.locale)
  if (saved === 'zh-CN' || saved === 'en-US') {
    return saved
  }
  return isChineseBrowser() ? 'zh-CN' : 'en-US'
}

const initialLocation = (): UserLocation | null => {
  try {
    const location = normalizeLocation(JSON.parse(read(KEYS.location) ?? 'null'))
    if (!location) {
      return null
    }
    return isChineseBrowser()
      ? location.region === 'CN' && location.province
        ? location
        : null
      : { region: location.region }
  } catch {
    return null
  }
}

/** 未保存过时跟随系统 */
const initialThemePreference = (): ThemePreference => {
  const saved = read(KEYS.themePreference)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

/** 未保存过时使用服务端默认音色 stella（海星） */
const initialTtsVoice = (): TtsVoice => (read(KEYS.ttsVoice) === 'tide' ? 'tide' : 'stella')

/** 历史内容可能超过上限，读取时统一截断，避免旧数据绕过限制。 */
const initialSystemPrompt = (): string => clampSystemPrompt(read(KEYS.systemPrompt) ?? '')

const initialMemoryEnabled = (): boolean => read(KEYS.memoryEnabled) === 'true'

/** 开启记忆时必须有一个启用时间；旧数据缺少时间时按当前时间处理，避免误处理旧历史。 */
const initialMemoryEnabledAt = (): number | null => {
  const value = Number(read(KEYS.memoryEnabledAt))
  return Number.isFinite(value) && value > 0 ? value : null
}

export const useSettings = create<Settings>(() => {
  const memoryEnabled = initialMemoryEnabled()
  return {
    apiKey: read(KEYS.apiKey),
    locale: initialLocale(),
    location: initialLocation(),
    themePreference: initialThemePreference(),
    ttsVoice: initialTtsVoice(),
    systemPrompt: initialSystemPrompt(),
    memoryEnabled,
    memoryEnabledAt: memoryEnabled ? (initialMemoryEnabledAt() ?? Date.now()) : null,
    thinking: read(KEYS.thinking) === 'true',
    search: read(KEYS.search) === 'true',
    siderCollapsed: read(KEYS.siderCollapsed) === 'true',
  }
})

export const setLocale = (locale: Locale) => {
  write(KEYS.locale, locale)
  useSettings.setState({ locale })
}

export const setLocation = (value: UserLocation | null) => {
  const location = normalizeLocation(value)
  write(KEYS.location, location ? JSON.stringify(location) : null)
  useSettings.setState({ location })
}

export const setThemePreference = (themePreference: ThemePreference) => {
  write(KEYS.themePreference, themePreference)
  useSettings.setState({ themePreference })
}

export const setTtsVoice = (ttsVoice: TtsVoice) => {
  write(KEYS.ttsVoice, ttsVoice)
  useSettings.setState({ ttsVoice })
}

/** 空内容视为清除：移除存储键，后续请求只发送内置身份说明。 */
export const setSystemPrompt = (value: string) => {
  const systemPrompt = clampSystemPrompt(value)
  write(KEYS.systemPrompt, systemPrompt || null)
  useSettings.setState({ systemPrompt })
}

/** 开启时重置启用时间：关闭期间产生的消息不进入记忆；已有条目继续保留。 */
export const setMemoryEnabled = (memoryEnabled: boolean) => {
  const memoryEnabledAt = memoryEnabled ? Date.now() : useSettings.getState().memoryEnabledAt
  write(KEYS.memoryEnabled, String(memoryEnabled))
  if (memoryEnabled) {
    write(KEYS.memoryEnabledAt, String(memoryEnabledAt))
  }
  useSettings.setState({ memoryEnabled, memoryEnabledAt })
}

export const setApiKey = (apiKey: string | null) => {
  write(KEYS.apiKey, apiKey)
  useSettings.setState({ apiKey })
}

export const setThinking = (thinking: boolean) => {
  write(KEYS.thinking, String(thinking))
  useSettings.setState({ thinking })
}

export const setSearch = (search: boolean) => {
  write(KEYS.search, String(search))
  useSettings.setState({ search })
}

export const setSiderCollapsed = (siderCollapsed: boolean) => {
  write(KEYS.siderCollapsed, String(siderCollapsed))
  useSettings.setState({ siderCollapsed })
}
