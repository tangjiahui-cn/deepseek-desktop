/** 所有生成请求统一携带的助手身份说明。 */
export const SYSTEM_PROMPT_BASE = '该助手为DeepSeek，由深度求索公司创造。'

/** 自定义提示词的最大长度，按 Unicode 码点计数。 */
export const SYSTEM_PROMPT_LIMIT = 2000

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
 * 把用户提示词追加到内置身份说明之后，两者以一个空行分隔。
 * 空内容或仅含空白字符时只返回身份说明，保持与未启用该功能时一致。
 */
export const composeSystemPrompt = (custom: string): string => {
  const prompt = custom.trim()
  return prompt ? `${SYSTEM_PROMPT_BASE}\n\n${prompt}` : SYSTEM_PROMPT_BASE
}
