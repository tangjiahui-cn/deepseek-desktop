import { create } from 'zustand'
import { useSettings } from '../settings.js'
import { normalizeProfileSummary, profileLength } from './prompt.js'
import type { MemoryCheckpoint, MemoryProfile } from './types.js'

const PROFILE_KEY = 'chat-demo:memory-profile'
const CHECKPOINTS_KEY = 'chat-demo:memory-checkpoints'
const LEGACY_ITEMS_KEY = 'chat-demo:memory-items'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')
const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const readJson = (key: string): unknown => {
  try {
    if (typeof localStorage === 'undefined') {
      return null
    }
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const writeJson = (key: string, value: unknown) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch {
    // 存储不可用时只在当前运行期生效，不阻塞聊天。
  }
}

const removeKey = (key: string) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key)
    }
  } catch {
    // 忽略清理失败。
  }
}

export const emptyProfile = (): MemoryProfile => ({
  summary: '',
  updatedAt: 0,
  lastSessionId: '',
  lastSessionTitle: '',
})

/** 校验画像；损坏字段回退为空，不在读取时静默截断超长内容。 */
export const parseProfile = (value: unknown): MemoryProfile => {
  if (!isRecord(value)) {
    return emptyProfile()
  }
  return {
    summary: normalizeProfileSummary(asString(value.summary)),
    updatedAt: asNumber(value.updatedAt),
    lastSessionId: asString(value.lastSessionId),
    lastSessionTitle: asString(value.lastSessionTitle),
  }
}

/** 旧画像还带撤销版本或暂停标记；读取后清掉，避免继续占用存储。 */
const hasLegacyProfileFields = (value: unknown): boolean =>
  isRecord(value) &&
  ('revisions' in value || 'userEdited' in value || 'overflow' in value)

/** 旧版条目迁移成一段画像；只在新 key 不存在时执行一次。 */
const readInitialProfile = (): MemoryProfile => {
  const stored = readJson(PROFILE_KEY)
  if (stored !== null) {
    const profile = parseProfile(stored)
    if (hasLegacyProfileFields(stored)) {
      writeJson(PROFILE_KEY, profile)
    }
    return profile
  }
  const legacy = readJson(LEGACY_ITEMS_KEY)
  if (Array.isArray(legacy)) {
    const texts = legacy
      .map((entry) => (isRecord(entry) ? normalizeProfileSummary(asString(entry.text)) : ''))
      .filter(Boolean)
    if (texts.length > 0) {
      const profile = { ...emptyProfile(), summary: texts.join('；') }
      writeJson(PROFILE_KEY, profile)
      removeKey(LEGACY_ITEMS_KEY)
      return profile
    }
  }
  return emptyProfile()
}

/** 读取并校验处理进度；只保留结构完整的条目。 */
export const parseMemoryCheckpoints = (value: unknown): Record<string, MemoryCheckpoint> => {
  if (!isRecord(value)) {
    return {}
  }
  const checkpoints: Record<string, MemoryCheckpoint> = {}
  for (const [sessionId, entry] of Object.entries(value)) {
    if (!sessionId || !isRecord(entry)) {
      continue
    }
    checkpoints[sessionId] = {
      sessionId,
      lastProcessedMessageId: asString(entry.lastProcessedMessageId),
      lastProcessedAt: asNumber(entry.lastProcessedAt),
      status: entry.status === 'error' ? 'error' : 'idle',
      attempts: Math.max(0, Math.floor(asNumber(entry.attempts))),
    }
  }
  return checkpoints
}

type MemoryState = {
  profile: MemoryProfile
  checkpoints: Record<string, MemoryCheckpoint>
}

export const useMemoryStore = create<MemoryState>(() => ({
  profile: readInitialProfile(),
  checkpoints: parseMemoryCheckpoints(readJson(CHECKPOINTS_KEY)),
}))

const saveProfile = (profile: MemoryProfile) => {
  writeJson(PROFILE_KEY, profile)
  useMemoryStore.setState({ profile })
}

const saveCheckpoints = (checkpoints: Record<string, MemoryCheckpoint>) => {
  writeJson(CHECKPOINTS_KEY, checkpoints)
  useMemoryStore.setState({ checkpoints })
}

const currentMaxLength = (): number => useSettings.getState().memoryMaxLength

/**
 * 自动更新写入。baseSummary 是发起请求时的画像；期间用户编辑或别的更新先落盘时拒绝，
 * 由调用方决定是否重新排队。
 */
export const applyAutoProfile = (
  summary: string,
  source: { sessionId: string; sessionTitle: string },
  baseSummary: string,
  now = Date.now()
): boolean => {
  const text = normalizeProfileSummary(summary)
  const { profile } = useMemoryStore.getState()
  if (!text || profile.summary !== baseSummary || profileLength(text) > currentMaxLength()) {
    return false
  }
  saveProfile({
    ...profile,
    summary: text,
    updatedAt: now,
    lastSessionId: source.sessionId,
    lastSessionTitle: source.sessionTitle,
  })
  return true
}

/** 用户手动编辑：直接成为后续自动合并的基线，不暂停自动更新。 */
export const editProfile = (summary: string, now = Date.now()): boolean => {
  const text = normalizeProfileSummary(summary)
  if (!text || profileLength(text) > currentMaxLength()) {
    return false
  }
  const { profile } = useMemoryStore.getState()
  saveProfile({ ...profile, summary: text, updatedAt: now })
  return true
}

/** 清空画像但保留 checkpoint：已处理过的对话不会重新生成。 */
export const clearProfile = () => {
  saveProfile(emptyProfile())
}

export const setMemoryCheckpoint = (checkpoint: MemoryCheckpoint) => {
  saveCheckpoints({ ...useMemoryStore.getState().checkpoints, [checkpoint.sessionId]: checkpoint })
}

export const forgetMemoryCheckpoint = (sessionId: string) => {
  const { checkpoints } = useMemoryStore.getState()
  if (!Object.hasOwn(checkpoints, sessionId)) {
    return
  }
  saveCheckpoints(
    Object.fromEntries(Object.entries(checkpoints).filter(([id]) => id !== sessionId))
  )
}

export const clearMemoryCheckpoints = () => {
  saveCheckpoints({})
}

export const getMemoryCheckpoint = (sessionId: string): MemoryCheckpoint | undefined =>
  useMemoryStore.getState().checkpoints[sessionId]
