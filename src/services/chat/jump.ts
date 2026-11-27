import { create } from 'zustand'

/** 一次性定位请求：由书签点击发起，MessageList 消费后清除。 */
export type MessageJump = {
  sessionId: string
  messageId: string
  nonce: number
}

type MessageJumpState = {
  target: MessageJump | null
  request: (sessionId: string, messageId: string) => void
  clear: (nonce: number) => void
}

let sequence = 0

export const useMessageJump = create<MessageJumpState>((set) => ({
  target: null,
  request: (sessionId, messageId) => {
    sequence += 1
    set({ target: { sessionId, messageId, nonce: sequence } })
  },
  clear: (nonce) => {
    set((state) => (state.target?.nonce === nonce ? { target: null } : {}))
  },
}))
