import { createId } from '../../utils/id.js'
import { getVisibleMessages } from './branches.js'
import type { Message, Session } from './types.js'

/**
 * 分叉：把当前可见分支上「首条消息到目标回答」复制成一个独立会话。
 * 消息重新生成标识并重建为以首条消息为根的单链，附件仍引用同一份本机原件；
 * 目标不在可见路径上或目标不是回答时返回 null，原会话不被修改。
 */
export const forkSessionAt = (
  session: Session,
  messageId: string,
  now = Date.now()
): Session | null => {
  const path = getVisibleMessages(session)
  const index = path.findIndex((message) => message.id === messageId)
  if (index < 0 || path[index].role !== 'assistant') {
    return null
  }
  const copied = path.slice(0, index + 1)
  const ids = copied.map(() => createId())
  const messages: Message[] = copied.map((message, position) => ({
    ...message,
    id: ids[position],
    parentId: position === 0 ? null : ids[position - 1],
    selectedChildId: ids[position + 1],
  }))
  return {
    id: createId(),
    title: session.title,
    createdAt: now,
    updatedAt: now,
    messages,
    rootMessageId: ids[0],
  }
}
