/** 所有生成请求统一携带的助手身份说明。 */
export const SYSTEM_PROMPT_BASE = '该助手为DeepSeek，由深度求索公司创造。'

/** 自定义提示词的最大长度，按 Unicode 码点计数。 */
export const SYSTEM_PROMPT_LIMIT = 20000

/**
 * 把提示词限制在上限内：超出部分按 Unicode 码点截断，避免从中间拆开代理对。
 * 未超限时原样返回，保留用户输入的换行与缩进。
 */
export const clampSystemPrompt = (value: string): string => {
  const characters = Array.from(value)
  return characters.length > SYSTEM_PROMPT_LIMIT
    ? characters.slice(0, SYSTEM_PROMPT_LIMIT).join('')
    : value
}

/**
 * 把用户提示词与长期记忆追加到内置身份说明之后；各部分之间以一个空行分隔。
 * 提示词为空时跳过；记忆为空串时输出与未启用记忆完全一致。
 */
export const composeSystemPrompt = (custom: string, memoryBlock = ''): string => {
  const prompt = custom.trim()
  const memory = memoryBlock.trim()
  return [SYSTEM_PROMPT_BASE, prompt, memory].filter(Boolean).join('\n\n')
}
