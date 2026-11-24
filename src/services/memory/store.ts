import { create } from 'zustand'
import {
  MEMORY_PROFILE_MAX,
  MEMORY_REVISION_LIMIT,
  normalizeProfileSummary,
  profileLength,
} from './prompt.js'
import type { MemoryCheckpoint, MemoryProfile, MemoryRevision } from './types.js'

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
  userEdited: false,
  overflow: false,
  revisions: [],
})

const parseRevisions = (value: unknown): MemoryRevision[] => {
  if (!Array.isArray(value)) {
    return []
  }
  const revisions: MemoryRevision[] = []
  for (const entry of value) {
    if (!isRecord(entry)) {
      continue
    }
    const summary = normalizeProfileSummary(asString(entry.summary))
    if (!summary) {
      continue
    }
    revisions.push({
      summary,
      updatedAt: asNumber(entry.updatedAt),
      sessionId: asString(entry.sessionId),
      sessionTitle: asString(entry.sessionTitle),
    })
    if (revisions.length >= MEMORY_REVISION_LIMIT) {
      break
    }
  }
  return revisions
}

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
    userEdited: value.userEdited === true,
    overflow: value.overflow === true,
    revisions: parseRevisions(value.revisions),
  }
}

/** 旧版条目迁移成一段画像；只在新 key 不存在时执行一次。 */
const readInitialProfile = (): MemoryProfile => {
  const stored = readJson(PROFILE_KEY)
  if (stored !== null) {
    return parseProfile(stored)
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

const pushRevision = (profile: MemoryProfile): MemoryRevision[] => {
  if (!profile.summary) {
    return profile.revisions
  }
  return [
    {
      summary: profile.summary,
      updatedAt: profile.updatedAt,
      sessionId: profile.lastSessionId,
      sessionTitle: profile.lastSessionTitle,
    },
    ...profile.revisions,
  ].slice(0, MEMORY_REVISION_LIMIT)
}

/** 自动更新；用户编辑或已因超限暂停时拒绝，调用方应保留旧画像。 */
export const applyAutoProfile = (
  summary: string,
  source: { sessionId: string; sessionTitle: string },
  now = Date.now()
): boolean => {
  const text = normalizeProfileSummary(summary)
  const { profile } = useMemoryStore.getState()
  if (!text || profile.userEdited || profile.overflow || profileLength(text) > MEMORY_PROFILE_MAX) {
    return false
  }
  const changed = text !== profile.summary
  saveProfile({
    ...profile,
    summary: text,
    updatedAt: now,
    lastSessionId: source.sessionId,
    lastSessionTitle: source.sessionTitle,
    revisions: changed ? pushRevision(profile) : profile.revisions,
    overflow: false,
  })
  return true
}

/** 用户手动编辑：锁定画像，暂停自动更新，保留旧版本供撤销。 */
export const editProfile = (summary: string, now = Date.now()): boolean => {
  const text = normalizeProfileSummary(summary)
  if (!text || profileLength(text) > MEMORY_PROFILE_MAX) {
    return false
  }
  const { profile } = useMemoryStore.getState()
  saveProfile({
    ...profile,
    summary: text,
    updatedAt: now,
    userEdited: true,
    overflow: false,
    revisions: text !== profile.summary ? pushRevision(profile) : profile.revisions,
  })
  return true
}

export const resumeAutoUpdate = () => {
  const { profile } = useMemoryStore.getState()
  saveProfile({ ...profile, userEdited: false, overflow: false })
}

/** 自动更新超过硬上限且压缩失败时暂停，直到用户精简或恢复。 */
export const markProfileOverflow = () => {
  const { profile } = useMemoryStore.getState()
  saveProfile({ ...profile, overflow: true })
}

/** 撤销到上一次画像；撤销本身也算用户操作，暂停自动更新。 */
export const undoProfile = (): boolean => {
  const { profile } = useMemoryStore.getState()
  const [revision, ...rest] = profile.revisions
  if (!revision) {
    return false
  }
  saveProfile({
    ...profile,
    summary: revision.summary,
    updatedAt: Date.now(),
    lastSessionId: revision.sessionId,
    lastSessionTitle: revision.sessionTitle,
    userEdited: true,
    overflow: false,
    revisions: rest,
  })
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
