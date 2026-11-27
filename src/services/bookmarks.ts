import { create } from 'zustand'
import * as db from './chat/db.js'
import type { AssistantMessage, Bookmark, TextPart } from './chat/types.js'

/** 书签摘要的最大字符数；侧栏最多展示两行，超出由 CSS 截断。 */
const EXCERPT_LIMIT = 240

type BookmarkState = {
  ready: boolean
  /** 按保存时间倒序 */
  items: Bookmark[]
  byMessageId: Record<string, Bookmark>
}

export const useBookmarks = create<BookmarkState>(() => ({
  ready: false,
  items: [],
  byMessageId: {},
}))

const sortBookmarks = (items: Bookmark[]): Bookmark[] =>
  [...items].sort((a, b) => b.createdAt - a.createdAt)

const toState = (items: Bookmark[]) => {
  const sorted = sortBookmarks(items)
  return {
    items: sorted,
    byMessageId: Object.fromEntries(sorted.map((item) => [item.messageId, item])),
  }
}

const setItems = (items: Bookmark[]) => {
  useBookmarks.setState(toState(items))
}

let initTask: Promise<void> | undefined
let loadEpoch = 0

/** 将 Markdown 回答压缩为单行纯文本，用于侧栏摘要。 */
export const toBookmarkExcerpt = (markdown: string): string => {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return [...text].slice(0, EXCERPT_LIMIT).join('')
}

/** 从回答块中提取正文摘要；模板提示不进入书签摘要。 */
export const replyToBookmarkExcerpt = (message: AssistantMessage): string =>
  toBookmarkExcerpt(
    message.blocks
      .filter((block): block is TextPart => block.type === 'text' && !block.isTemplate)
      .map((block) => block.text)
      .join('\n\n')
  )

/**
 * 读取书签并清理来源会话已不存在的记录。聊天初始化会等待该函数完成，
 * 保证会话 ready 时书签按钮状态已经稳定。
 */
export const initBookmarks = (validSessionIds?: ReadonlySet<string>): Promise<void> => {
  if (useBookmarks.getState().ready) {
    return Promise.resolve()
  }
  if (initTask) {
    return initTask
  }
  const epoch = loadEpoch
  initTask = (async () => {
    try {
      const stored = await db.loadBookmarks()
      if (epoch !== loadEpoch) {
        return
      }
      const invalid = validSessionIds
        ? stored.filter((bookmark) => !validSessionIds.has(bookmark.sessionId))
        : []
      const valid = validSessionIds
        ? stored.filter((bookmark) => validSessionIds.has(bookmark.sessionId))
        : stored
      useBookmarks.setState({ ready: true, ...toState(valid) })
      await Promise.all(
        invalid.map((bookmark) =>
          db.deleteBookmark(bookmark.messageId).catch(db.reportStorageError('prune bookmark'))
        )
      )
    } catch (error) {
      if (epoch === loadEpoch) {
        useBookmarks.setState({ ready: true, items: [], byMessageId: {} })
        db.reportStorageError('load bookmarks')(error)
      }
    } finally {
      if (epoch === loadEpoch) {
        initTask = undefined
      }
    }
  })()
  return initTask
}

const ensureReady = () => (useBookmarks.getState().ready ? Promise.resolve() : initBookmarks())

const addToState = (bookmark: Bookmark) => {
  const items = useBookmarks.getState().items
  setItems([...items.filter((item) => item.messageId !== bookmark.messageId), bookmark])
}

const removeFromState = (messageId: string) => {
  setItems(useBookmarks.getState().items.filter((item) => item.messageId !== messageId))
}

/**
 * 切换回答书签：先乐观更新内存，写库失败时恢复并抛错，由界面提示保存失败。
 * 返回 true 表示本次添加，false 表示本次移除。
 */
export const toggleBookmark = async (input: {
  messageId: string
  sessionId: string
  excerpt: string
}): Promise<boolean> => {
  await ensureReady()
  const current = useBookmarks.getState().byMessageId[input.messageId]
  if (current) {
    removeFromState(input.messageId)
    try {
      await db.deleteBookmark(input.messageId)
    } catch (error) {
      addToState(current)
      db.reportStorageError('delete bookmark')(error)
      throw error
    }
    return false
  }
  const bookmark: Bookmark = { ...input, createdAt: Date.now() }
  addToState(bookmark)
  try {
    await db.saveBookmark(bookmark)
  } catch (error) {
    removeFromState(bookmark.messageId)
    db.reportStorageError('save bookmark')(error)
    throw error
  }
  return true
}

/** 移除失效书签；失败只记录日志，不阻断跳转提示。 */
export const removeBookmark = async (messageId: string): Promise<void> => {
  await ensureReady()
  const current = useBookmarks.getState().byMessageId[messageId]
  if (!current) {
    return
  }
  removeFromState(messageId)
  try {
    await db.deleteBookmark(messageId)
  } catch (error) {
    addToState(current)
    db.reportStorageError('delete bookmark')(error)
    throw error
  }
}

/** 继续生成会改变同一条回答的正文，收尾时刷新侧栏摘要。 */
export const refreshBookmarkExcerpt = async (messageId: string, excerpt: string): Promise<void> => {
  const current = useBookmarks.getState().byMessageId[messageId]
  if (!current || current.excerpt === excerpt) {
    return
  }
  const next: Bookmark = { ...current, excerpt }
  setItems(
    useBookmarks.getState().items.map((item) => (item.messageId === messageId ? next : item))
  )
  try {
    await db.saveBookmark(next)
  } catch (error) {
    db.reportStorageError('refresh bookmark')(error)
  }
}

/** 删除会话成功后同步移除内存书签；IndexedDB 已在会话事务内清理。 */
export const removeBookmarksForSession = (sessionId: string) => {
  setItems(useBookmarks.getState().items.filter((item) => item.sessionId !== sessionId))
}

/** 历史替换成功后重置；IndexedDB 已在提交事务内清空。 */
export const resetBookmarkState = () => {
  loadEpoch += 1
  initTask = undefined
  useBookmarks.setState({ ready: true, items: [], byMessageId: {} })
}
