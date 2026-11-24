import { streamMessage } from '../api/client.js'
import { getVisibleMessages, normalizeSession } from '../chat/branches.js'
import * as db from '../chat/db.js'
import type { Message } from '../chat/types.js'
import { useSettings } from '../settings.js'
import { formatDate } from '../../utils/format.js'
import {
  MEMORY_PROFILE_MAX,
  getMemoryInjection,
  normalizeProfileSummary,
  profileLength,
} from './prompt.js'
import {
  applyAutoProfile,
  getMemoryCheckpoint,
  markProfileOverflow,
  setMemoryCheckpoint,
  useMemoryStore,
} from './store.js'

/** 回复完成后等多久再更新画像；新提问会重置。 */
const MEMORY_IDLE_DELAY = 30 * 1000
/** 单个窗口最多包含的消息与字符数。 */
const WINDOW_MESSAGES = 50
const WINDOW_CHARS = 12000
/** 提取请求超时。 */
const REQUEST_TIMEOUT = 60 * 1000
/** 连续失败后的最多重试次数。 */
const MAX_ATTEMPTS = 3
const RETRY_DELAYS = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000]

const messageText = (message: Message): string =>
  message.role === 'user'
    ? message.content
    : message.blocks.map((block) => (block.type === 'text' ? block.text : '')).join('')

export type MemoryWindow = {
  context: Message[]
  messages: Message[]
  lastMessageId: string | null
  hasMore: boolean
  charCount: number
}

/**
 * 从当前可见路径中取 checkpoint 之后的一个窗口。
 * checkpoint 不在路径上（切换分支、编辑消息）时从路径中第一条开启后的消息重新开始；
 * 前文只用于让模型理解指代，不参与画像更新。
 */
export const getMemoryWindow = (
  messages: readonly Message[],
  checkpointId: string,
  enabledAt: number
): MemoryWindow => {
  let start = 0
  if (checkpointId) {
    const index = messages.findIndex((message) => message.id === checkpointId)
    start = index >= 0 ? index + 1 : 0
  }
  if (start === 0) {
    const first = messages.findIndex((message) => message.createdAt >= enabledAt)
    start = first >= 0 ? first : messages.length
  } else {
    while (start < messages.length && messages[start].createdAt < enabledAt) {
      start += 1
    }
  }

  const context = messages.slice(Math.max(0, start - 2), start)
  const selected: Message[] = []
  let charCount = 0
  for (let index = start; index < messages.length; index += 1) {
    if (selected.length >= WINDOW_MESSAGES) {
      break
    }
    const length = Array.from(messageText(messages[index])).length
    if (selected.length > 0 && charCount + length > WINDOW_CHARS) {
      break
    }
    selected.push(messages[index])
    charCount += length
  }
  return {
    context,
    messages: selected,
    lastMessageId: selected.at(-1)?.id ?? null,
    hasMore: start + selected.length < messages.length,
    charCount,
  }
}

const formatMessage = (message: Message): string => {
  const text = messageText(message).trim()
  return `${message.role === 'user' ? '用户' : '助手'}：${text || '（无文本）'}`
}

const formatTranscript = (window: MemoryWindow): string => {
  const parts: string[] = []
  if (window.context.length > 0) {
    parts.push('[前文]', ...window.context.map(formatMessage))
  }
  parts.push('[待整理的新对话]', ...window.messages.map(formatMessage))
  return parts.join('\n')
}

const buildExtractionPrompt = (summary: string, window: MemoryWindow, now = new Date()) => ({
  system: [
    '你是用户长期记忆画像的整理器。',
    '输入包括当前画像和一段新对话。请输出更新后的完整画像。',
    '规则：',
    '- 保留所有未被新对话推翻的旧事实；只合并、修订冲突或新增内容。',
    '- 可以记录：用户身份与环境、长期偏好、项目与目标、约束与禁忌。',
    '- 不要记录：一次性任务、临时状态、助手推测、网页或工具内容、密钥/密码/令牌、身份证件、金融账户、精确住址或电话、健康/宗教/政治等敏感信息。',
    '- 时间敏感的信息要用当前日期判断：计划可以变成已完成，过时的内容应更新。',
    '- 删除重复、已经完成且不再相关的一次性项目；不要删除仍然有效的长期事实。',
    '- 一段话，按“身份/环境、偏好、项目/目标、约束”的顺序组织，尽量控制在 1200 字以内，硬上限 2000 字。',
    '- 使用与用户对话相同的语言，不要编造。',
    `当前日期：${formatDate(now) ?? ''}`,
    '没有值得更新的内容时，原样返回当前画像。',
    '输出严格 JSON，不要 Markdown、不要解释：',
    '{"summary":"更新后的完整画像"}',
  ].join('\n'),
  user: ['[当前画像]', summary || '（空）', '', formatTranscript(window)].join('\n'),
})

const buildCompressionPrompt = (summary: string) => ({
  system: [
    '你是用户长期记忆画像的压缩器。',
    '把下面的画像压缩成一段话，尽量控制在 1200 字以内，硬上限 2000 字。',
    '保留：身份/环境、长期偏好、正在进行的项目/目标、明确约束与禁忌。',
    '删除：重复、过时、已完成且不再相关的一次性内容、模糊或推测性内容。',
    '不要编造，不要改变仍然有效的事实。',
    '输出严格 JSON，不要 Markdown、不要解释：',
    '{"summary":"压缩后的画像"}',
  ].join('\n'),
  user: summary,
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/** 解析画像 JSON；旧画像非空而新结果为空时拒绝，避免清空。 */
export const parseProfileResponse = (text: string, previousSummary = ''): string | null => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
  if (!isRecord(parsed) || typeof parsed.summary !== 'string') {
    return null
  }
  const summary = normalizeProfileSummary(parsed.summary)
  if (!summary) {
    return previousSummary.trim() ? null : ''
  }
  return summary
}

const requestModel = async (
  apiKey: string,
  prompt: { system: string; user: string },
  signal: AbortSignal
): Promise<string> => {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal.aborted) {
    controller.abort()
  } else {
    signal.addEventListener('abort', abort, { once: true })
  }
  const timer = setTimeout(abort, REQUEST_TIMEOUT)
  try {
    const events = streamMessage(
      apiKey,
      {
        model: 'deepseek-flash',
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
        thinking: { type: 'disabled' },
        tools: [],
        safety_check: { level: 'high' },
      },
      controller.signal
    )
    let text = ''
    for await (const event of events) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        text += event.delta.text
      }
    }
    if (!text.trim()) {
      throw new Error('empty memory response')
    }
    return text
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', abort)
  }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()
const queue: string[] = []
const pending = new Set<string>()
const inspectVersions = new Map<string, number>()
let running = false
let activeController: AbortController | null = null
let suspended = false

const enabled = () => useSettings.getState().memoryEnabled
const autoPaused = () => {
  const { profile } = useMemoryStore.getState()
  return profile.userEdited || profile.overflow
}

const clearTimer = (sessionId: string) => {
  const timer = timers.get(sessionId)
  if (timer !== undefined) {
    clearTimeout(timer)
    timers.delete(sessionId)
  }
}

export const getMemoryRetryDelay = (attempt: number): number =>
  RETRY_DELAYS[Math.min(Math.max(attempt, 1), RETRY_DELAYS.length) - 1]

const enqueue = (sessionId: string) => {
  if (suspended || !enabled() || autoPaused() || pending.has(sessionId)) {
    return
  }
  pending.add(sessionId)
  queue.push(sessionId)
  void drain()
}

const processSession = async (sessionId: string) => {
  const { memoryEnabled, memoryEnabledAt, apiKey } = useSettings.getState()
  const { profile } = useMemoryStore.getState()
  if (!memoryEnabled || !apiKey || profile.userEdited || profile.overflow) {
    return
  }
  const stored = await db.loadSession(sessionId)
  if (!stored) {
    return
  }
  const session = normalizeSession(stored)
  const checkpoint = getMemoryCheckpoint(sessionId)
  const window = getMemoryWindow(
    getVisibleMessages(session),
    checkpoint?.lastProcessedMessageId ?? '',
    memoryEnabledAt ?? Date.now()
  )
  if (window.messages.length === 0 || !window.lastMessageId) {
    return
  }
  const controller = new AbortController()
  activeController = controller
  try {
    const prompt = buildExtractionPrompt(profile.summary, window)
    const raw = await requestModel(apiKey, prompt, controller.signal)
    let summary = parseProfileResponse(raw, profile.summary)
    if (summary === null) {
      throw new Error('invalid memory profile response')
    }
    if (profileLength(summary) > MEMORY_PROFILE_MAX) {
      const compressed = await requestModel(
        apiKey,
        buildCompressionPrompt(summary),
        controller.signal
      )
      summary = parseProfileResponse(compressed, profile.summary)
      if (summary === null || profileLength(summary) > MEMORY_PROFILE_MAX) {
        markProfileOverflow()
        return
      }
    }
    if (suspended || !enabled()) {
      return
    }
    if (summary && !applyAutoProfile(summary, { sessionId, sessionTitle: session.title })) {
      return
    }
    setMemoryCheckpoint({
      sessionId,
      lastProcessedMessageId: window.lastMessageId,
      lastProcessedAt: Date.now(),
      status: 'idle',
      attempts: 0,
    })
    if (window.hasMore) {
      setTimeout(() => enqueue(sessionId), 300)
    }
  } catch {
    if (controller.signal.aborted || !enabled()) {
      return
    }
    const attempts = (checkpoint?.attempts ?? 0) + 1
    setMemoryCheckpoint({
      sessionId,
      lastProcessedMessageId: checkpoint?.lastProcessedMessageId ?? '',
      lastProcessedAt: Date.now(),
      status: 'error',
      attempts,
    })
    if (attempts <= MAX_ATTEMPTS) {
      clearTimer(sessionId)
      const timer = setTimeout(() => {
        timers.delete(sessionId)
        enqueue(sessionId)
      }, getMemoryRetryDelay(attempts))
      timers.set(sessionId, timer)
    }
  } finally {
    if (activeController === controller) {
      activeController = null
    }
  }
}

const drain = async () => {
  if (running) {
    return
  }
  running = true
  try {
    while (queue.length > 0) {
      const sessionId = queue.shift()
      if (!sessionId) {
        break
      }
      pending.delete(sessionId)
      if (!enabled() || autoPaused()) {
        continue
      }
      await processSession(sessionId)
    }
  } finally {
    running = false
  }
  if (queue.length > 0) {
    void drain()
  }
}

/**
 * 回复完成后调用：没有新内容则不入队；积压到窗口阈值时立即更新，
 * 否则等待 30 秒空闲。新提问会通过 deferMemoryForSession 重置。
 */
export const scheduleMemoryExtraction = (sessionId: string) => {
  if (!enabled() || autoPaused()) {
    return
  }
  suspended = false
  const version = (inspectVersions.get(sessionId) ?? 0) + 1
  inspectVersions.set(sessionId, version)
  clearTimer(sessionId)
  void (async () => {
    const stored = await db.loadSession(sessionId)
    if (!stored || inspectVersions.get(sessionId) !== version) {
      return
    }
    const { memoryEnabled, memoryEnabledAt } = useSettings.getState()
    if (!memoryEnabled || autoPaused()) {
      return
    }
    const window = getMemoryWindow(
      getVisibleMessages(normalizeSession(stored)),
      getMemoryCheckpoint(sessionId)?.lastProcessedMessageId ?? '',
      memoryEnabledAt ?? Date.now()
    )
    if (window.messages.length === 0) {
      return
    }
    if (
      window.hasMore ||
      window.messages.length >= WINDOW_MESSAGES ||
      window.charCount >= WINDOW_CHARS
    ) {
      enqueue(sessionId)
      return
    }
    const timer = setTimeout(() => {
      timers.delete(sessionId)
      enqueue(sessionId)
    }, MEMORY_IDLE_DELAY)
    timers.set(sessionId, timer)
  })()
}

/** 新提问/新生成开始时调用：清掉 30 秒计时，等本轮回复结束再重新计时。 */
export const deferMemoryForSession = (sessionId: string) => {
  clearTimer(sessionId)
}

/** 新建对话、切换会话或恢复自动更新时调用：跳过 30 秒等待，立即入队。 */
export const flushMemoryForSession = (sessionId: string) => {
  suspended = false
  clearTimer(sessionId)
  enqueue(sessionId)
}

/** 应用启动或恢复自动更新时补跑开启后更新过的会话；不处理暂停或开启前的历史。 */
export const initMemory = () => {
  if (!enabled()) {
    stopMemory()
    return
  }
  if (autoPaused()) {
    return
  }
  suspended = false
  const { memoryEnabledAt } = useSettings.getState()
  const since = memoryEnabledAt ?? Date.now()
  void db
    .loadSessionSummaries()
    .then((summaries) => {
      if (!enabled() || autoPaused()) {
        return
      }
      for (const summary of summaries
        .filter((item) => item.updatedAt >= since)
        .sort((a, b) => b.updatedAt - a.updatedAt)) {
        const checkpoint = getMemoryCheckpoint(summary.id)
        if (checkpoint?.status === 'idle' && checkpoint.lastProcessedAt >= summary.updatedAt) {
          continue
        }
        enqueue(summary.id)
      }
    })
    .catch(() => {
      // 会话列表读取失败时保持空闲；聊天本身仍可继续。
    })
}

/** 关闭记忆、用户编辑画像或替换历史时取消定时器与进行中的提取。 */
export const stopMemory = () => {
  suspended = true
  for (const timer of timers.values()) {
    clearTimeout(timer)
  }
  timers.clear()
  queue.length = 0
  pending.clear()
  inspectVersions.clear()
  activeController?.abort()
  activeController = null
}

/** 当前请求应追加的画像文本块；关闭或画像为空时为空串。 */
export const getMemoryBlock = (): string => {
  if (!enabled()) {
    return ''
  }
  return getMemoryInjection(useMemoryStore.getState().profile).block
}
