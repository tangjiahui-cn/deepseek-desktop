/**
 * 跨对话的用户画像。summary 是唯一注入源，不保存逐条记忆或历史版本。
 * 自动更新与用户编辑都直接改写这一段内容。
 */
export type MemoryProfile = {
  summary: string
  updatedAt: number
  lastSessionId: string
  lastSessionTitle: string
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
