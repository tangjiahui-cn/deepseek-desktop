/** 一次画像更新前保留的旧版本，用于撤销。 */
export type MemoryRevision = {
  summary: string
  updatedAt: number
  sessionId: string
  sessionTitle: string
}

/**
 * 跨对话的用户画像。summary 是唯一注入源，不再保存逐条记忆。
 * userEdited 为 true 时自动更新暂停，避免覆盖用户手动修改。
 */
export type MemoryProfile = {
  summary: string
  updatedAt: number
  lastSessionId: string
  lastSessionTitle: string
  userEdited: boolean
  /** 自动更新因超过 2000 字且无法压缩而暂停。 */
  overflow: boolean
  revisions: MemoryRevision[]
}

/** 提取会话已处理到的位置；没有摘要，只有进度。 */
export type MemoryCheckpoint = {
  sessionId: string
  lastProcessedMessageId: string
  lastProcessedAt: number
  status: 'idle' | 'error'
  /** 连续失败次数，成功或换窗口后归零。 */
  attempts: number
}
