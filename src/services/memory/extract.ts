import { streamMessage } from '../api/client.js'
import { getVisibleMessages, normalizeSession } from '../chat/branches.js'
import * as db from '../chat/db.js'
import type { Message } from '../chat/types.js'
import { useSettings } from '../settings.js'
import { formatDate } from '../../utils/format.js'
import {
  getMemoryInjection,
  normalizeProfileSummary,
  profileLength,
} from './prompt.js'
import {
  applyAutoProfile,
  getMemoryCheckpoint,
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

export type MemorySettings = {
  requirements: string
  maxLength: number
}

type RequestModel = (
  apiKey: string,
  prompt: { system: string; user: string },
  signal: AbortSignal
) => Promise<string>

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

/** 淘汰顺序：先丢弃低价值旧内容，约束与禁忌最后保留。 */
const PRUNE_ORDER = [
  '已完成或一次性的项目与目标',
  '环境与工具链中已过时的细节',
  '长期偏好中可推断或低价值的条目',
  '身份与角色中的非核心细节',
].join(' → ')

export const buildExtractionPrompt = (
  summary: string,
  window: MemoryWindow,
  settings: MemorySettings,
  now = new Date()
) => ({
  system: [
    '你是用户长期记忆画像的整理器。',
    '输入包括当前画像、记忆要求和新对话。请输出更新后的完整画像。',
    '',
    '记忆要求（决定哪些内容可以写入）：',
    settings.requirements,
    '',
    '规则：',
    '- 只记录记忆要求覆盖的内容；用户没有明确表达或确认的、一次性的、临时的内容不写入。',
    '- 保留所有未被新对话推翻的旧事实；只合并、修订冲突或新增内容。',
    '- 新事实必须覆盖冲突的旧值，不得把新旧值并列保留。',
    '- 不要记录助手推测、网页或工具内容、密钥/密码/令牌、身份证件、金融账户、精确住址或电话、健康/宗教/政治等敏感信息。',
    `- 画像不得超过 ${settings.maxLength} 字（按字符计）。超过时按以下顺序删除旧内容：${PRUNE_ORDER}；「约束与禁忌」永不删除，用户已确认的修正优先于旧值。`,
    '- 时间敏感的信息用当前日期判断：计划可以变成已完成，过时的内容应更新。',
    '- 删除重复、已完成且不再相关的一次性项目；不要删除仍然有效的长期事实。',
    '- 输出一段话，按“身份/环境、偏好、项目/目标、约束”的顺序组织，尽量保留高价值内容。',
    '- 使用与用户对话相同的语言，不要编造。',
    `当前日期：${formatDate(now) ?? ''}`,
    '没有值得更新的内容时，原样返回当前画像。',
    '输出严格 JSON，不要 Markdown、不要解释：',
    '{"summary":"更新后的完整画像"}',
  ].join('\n'),
  user: ['[当前画像]', summary || '（空）', '', formatTranscript(window)].join('\n'),
})

export const buildCompressionPrompt = (summary: string, settings: MemorySettings) => ({
  system: [
    '你是用户长期记忆画像的压缩器。',
    `把下面的画像压缩成一段话，不超过 ${settings.maxLength} 字，尽量保留高价值内容。`,
    '',
    '记忆要求（决定哪些内容重要）：',
    settings.requirements,
    '',
    '保留：约束与禁忌、身份核心、用户已确认的最新事实修正。',
    `删除顺序：${PRUNE_ORDER}。`,
    '不得删除约束与禁忌；不要改变仍然有效的事实，不要编造。',
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
let compressing = false
let activeController: AbortController | null = null
let suspended = false

const enabled = () => useSettings.getState().memoryEnabled

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
  if (suspended || !enabled() || pending.has(sessionId)) {
    return
  }
  pending.add(sessionId)
  queue.push(sessionId)
  void drain()
}

/** 请求并压缩一次画像；失败返回 null，由调用方保留旧画像。 */
export const compressSummary = async (
  summary: string,
  settings: MemorySettings,
  apiKey: string,
  baseSummary: string,
  signal: AbortSignal,
  request: RequestModel = requestModel
): Promise<string | null> => {
  let current = summary
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (profileLength(current) <= settings.maxLength) {
      return current
    }
    const raw = await request(apiKey, buildCompressionPrompt(current, settings), signal)
    const parsed = parseProfileResponse(raw, baseSummary)
    if (parsed === null) {
      return null
    }
    current = parsed
  }
  return profileLength(current) <= settings.maxLength ? current : null
}

const processSession = async (sessionId: string) => {
  const { memoryEnabled, memoryMaxLength, memoryRequirements, apiKey } = useSettings.getState()
  const { profile } = useMemoryStore.getState()
  if (!memoryEnabled || !apiKey) {
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
    useSettings.getState().memoryEnabledAt ?? Date.now()
  )
  if (window.messages.length === 0 || !window.lastMessageId) {
    return
  }
  const settings: MemorySettings = {
    requirements: memoryRequirements,
    maxLength: memoryMaxLength,
  }
  const baseSummary = profile.summary
  const controller = new AbortController()
  activeController = controller
  try {
    const prompt = buildExtractionPrompt(baseSummary, window, settings)
    const raw = await requestModel(apiKey, prompt, controller.signal)
    let summary = parseProfileResponse(raw, baseSummary)
    if (summary === null) {
      throw new Error('invalid memory profile response')
    }
    if (profileLength(summary) > settings.maxLength) {
      const compressed = await compressSummary(
        summary,
        settings,
        apiKey,
        baseSummary,
        controller.signal
      )
      if (compressed === null) {
        throw new Error('memory profile remains too long')
      }
      summary = compressed
    }
    if (suspended || !enabled()) {
      return
    }
    if (useMemoryStore.getState().profile.summary !== baseSummary) {
      enqueue(sessionId)
      return
    }
    if (
      summary &&
      !applyAutoProfile(
        summary,
        { sessionId, sessionTitle: session.title },
        baseSummary
      )
    ) {
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
      if (!enabled()) {
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
  if (!enabled()) {
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
    if (!memoryEnabled) {
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

/** 应用启动或恢复自动更新时补跑开启后更新过的会话；不处理开启前的历史。 */
export const initMemory = () => {
  if (!enabled()) {
    stopMemory()
    return
  }
  suspended = false
  const { memoryEnabledAt } = useSettings.getState()
  const since = memoryEnabledAt ?? Date.now()
  void db
    .loadSessionSummaries()
    .then((summaries) => {
      if (!enabled()) {
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

/** 关闭记忆、清空记忆或替换历史时取消定时器、队列与进行中的提取。 */
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

/**
 * 调低最大长度后压缩现有画像；失败时保留旧画像，不推进 checkpoint。
 * 由设置界面在保存新上限后调用，下一次自动更新也会再尝试。
 */
export const compressProfileIfNeeded = async () => {
  const { memoryEnabled, memoryMaxLength, memoryRequirements, apiKey } = useSettings.getState()
  const { profile } = useMemoryStore.getState()
  const baseSummary = profile.summary
  if (
    !memoryEnabled ||
    !apiKey ||
    !baseSummary ||
    profileLength(baseSummary) <= memoryMaxLength ||
    compressing
  ) {
    return
  }
  compressing = true
  const controller = new AbortController()
  activeController = controller
  try {
    const summary = await compressSummary(
      baseSummary,
      { requirements: memoryRequirements, maxLength: memoryMaxLength },
      apiKey,
      baseSummary,
      controller.signal
    )
    if (summary === null || suspended || !enabled()) {
      return
    }
    if (useMemoryStore.getState().profile.summary !== baseSummary) {
      return
    }
    applyAutoProfile(
      summary,
      { sessionId: profile.lastSessionId, sessionTitle: profile.lastSessionTitle },
      baseSummary
    )
  } catch {
    // 保留旧画像；下一次自动更新还会尝试压缩。
  } finally {
    compressing = false
    if (activeController === controller) {
      activeController = null
    }
  }
}

/** 当前请求应追加的画像文本块；关闭或画像为空时为空串。 */
export const getMemoryBlock = (): string => {
  if (!enabled()) {
    return ''
  }
  return getMemoryInjection(useMemoryStore.getState().profile).block
}
