import type { Message, Session } from './types.js'

/** 将线性消息列表规范化为单分支，保留消息 ID、内容及时间。 */
export const normalizeSession = (session: Session): Session =>
  session.rootMessageId !== undefined
    ? session
    : {
        ...session,
        rootMessageId: session.messages[0]?.id ?? null,
        messages: session.messages.map((message, index, messages) => ({
          ...message,
          parentId: messages[index - 1]?.id ?? null,
          selectedChildId: messages[index + 1]?.id,
        })),
      }

/** 展示内容与请求上下文共用当前选中的分支路径。 */
export const getVisibleMessages = (session: Session): Message[] => {
  if (session.rootMessageId === undefined) {
    return session.messages
  }
  const byId = new Map(session.messages.map((message) => [message.id, message]))
  const path: Message[] = []
  let id = session.rootMessageId
  while (id) {
    const message = byId.get(id)
    if (!message) {
      break
    }
    path.push(message)
    byId.delete(id)
    id = message.selectedChildId ?? null
  }
  return path
}

export type MessageVersions = { ids: string[]; index: number }

/** 一次遍历收集兄弟版本；版本列表未变化时复用旧对象与索引，避免流式正文更新重绘历史消息。 */
export const buildMessageVersions = (
  session: Session,
  previous: ReadonlyMap<string, MessageVersions>
): ReadonlyMap<string, MessageVersions> => {
  const groups = new Map<string | null | undefined, string[]>()
  for (const message of session.messages) {
    const key = session.rootMessageId === undefined ? message.id : message.parentId
    const ids = groups.get(key)
    if (ids) {
      ids.push(message.id)
    } else {
      groups.set(key, [message.id])
    }
  }

  const versions = new Map<string, MessageVersions>()
  let unchanged = previous.size === session.messages.length
  for (const ids of groups.values()) {
    const cachedIds = previous.get(ids[0])?.ids
    const stableIds =
      cachedIds?.length === ids.length && ids.every((id, index) => id === cachedIds[index])
        ? cachedIds
        : ids
    ids.forEach((id, index) => {
      const cached = previous.get(id)
      const version =
        cached?.ids === stableIds && cached.index === index ? cached : { ids: stableIds, index }
      versions.set(id, version)
      if (version !== cached) {
        unchanged = false
      }
    })
  }
  return unchanged ? previous : versions
}

/** 新消息挂在指定父节点下，并选择新分支；原节点与其后续对话保持不变。 */
export const appendBranch = (
  original: Session,
  parentId: string | null,
  messages: Message[]
): Session => {
  const session = normalizeSession(original)
  const first = messages[0]
  if (!first) {
    return session
  }
  return {
    ...session,
    rootMessageId: parentId === null ? first.id : session.rootMessageId,
    messages: [
      ...session.messages.map((message) =>
        message.id === parentId ? { ...message, selectedChildId: first.id } : message
      ),
      ...messages.map((message, index) => ({
        ...message,
        parentId: messages[index - 1]?.id ?? parentId,
        selectedChildId: messages[index + 1]?.id,
      })),
    ],
  }
}

/** 展开从根到目标消息的分支；目标不可见时逐级修正祖先的 selectedChildId。 */
export const revealMessage = (original: Session, messageId: string): Session => {
  const session = normalizeSession(original)
  const byId = new Map(session.messages.map((message) => [message.id, message]))
  const target = byId.get(messageId)
  if (!target) {
    return original
  }
  const chain: Message[] = []
  let current: Message | undefined = target
  while (current) {
    chain.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  // 目标不在以根节点开始的树上，无法通过选择分支展示。
  if (chain[0].parentId !== null) {
    return original
  }
  if (getVisibleMessages(session).some((message) => message.id === messageId)) {
    return original
  }
  let messages = session.messages
  for (let index = 0; index < chain.length - 1; index += 1) {
    const parent = chain[index]
    const child = chain[index + 1]
    if (parent.selectedChildId === child.id) {
      continue
    }
    messages = messages.map((message) =>
      message.id === parent.id ? { ...message, selectedChildId: child.id } : message
    )
  }
  return messages === session.messages ? original : { ...session, messages }
}

/** 仅允许切换当前路径上某一节点的兄弟版本，恢复该版本已选中的后续分支。 */
export const selectVersion = (original: Session, messageId: string): Session => {
  const session = normalizeSession(original)
  const message = session.messages.find((item) => item.id === messageId)
  if (!message || !getVisibleMessages(session).some((item) => item.parentId === message.parentId)) {
    return original
  }
  return {
    ...session,
    rootMessageId: message.parentId === null ? message.id : session.rootMessageId,
    messages: session.messages.map((item) =>
      item.id === message.parentId ? { ...item, selectedChildId: message.id } : item
    ),
  }
}
