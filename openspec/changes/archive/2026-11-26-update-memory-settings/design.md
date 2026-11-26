# Design

## Context

现有记忆能力见 `openspec/specs/memory/spec.md` 与 `openspec/changes/archive/2026-11-24-add-cross-session-memory/design.md`。当前实现的关键约束：

- 画像、checkpoint 存在 `localStorage`（`chat-demo:memory-profile`、`chat-demo:memory-checkpoints`），设置在 `src/services/settings.ts`。
- 提取在 `src/services/memory/extract.ts`：30 秒防抖、50 条/12000 字窗口、`deepseek-flash` + 严格 JSON；`prompt.ts` 写死 1200/2000 字；`store.ts` 维护 `revisions/userEdited/overflow`。
- 界面在 `src/components/settings/MemoryField.tsx`；注入文本由 `src/services/chat/systemPrompt.ts` 组合。
- 项目没有测试框架，验证依赖 `pnpm type`、`pnpm lint`、`pnpm build`、临时 Node 脚本与无头浏览器端到端检查。

需求见 `specs/memory/spec.md`，动机见 `proposal.md`。

## Goals / Non-Goals

**Goals:**

- 最大记忆长度可配置（2000–20000，默认 7000），画像写入、编辑、压缩都使用同一上限。
- 记忆要求可编辑，默认六类；提取与压缩提示词都按当前要求取舍内容。
- 更新永远自动收敛：超限先压缩，压缩失败自动重试；不再出现“暂停等待手动恢复”。
- 编辑改为保存/取消，保存后自动更新继续；移除撤销与版本栈。
- 升级不丢已有画像与 checkpoint。

**Non-Goals:**

- 不做逐条记忆、检索、跨设备同步、历史版本恢复。
- 不改 IndexedDB、会话 schema、历史导出格式与 API 协议。
- 不改变 30 秒防抖与窗口切分策略。
- 记忆要求不注入聊天请求的 system。

## Decisions

### 1. 设置扩展与常量归属

`src/services/settings.ts` 新增：

- `memoryMaxLength: number`，默认 `7000`，读取时夹在 `2000..20000`；键 `chat-demo:memory-max-length`。
- `memoryRequirements: string`，默认六类文本；键 `chat-demo:memory-requirements`；保存时 trim，空串视为恢复默认。

默认值与上下限常量放 `src/services/memory/prompt.ts`（`MEMORY_MAX_LENGTH_DEFAULT`、`MEMORY_MAX_LENGTH_MIN`、`MEMORY_MAX_LENGTH_LIMIT`、`DEFAULT_MEMORY_REQUIREMENTS`），settings 从那里引入。理由：长度计数、默认要求与提示词在同一模块，避免两处漂移；`memory/prompt.ts` 只依赖 `types.ts`，不会与 settings 形成环。

备选：把默认要求放 settings。否决，因为它是记忆语义的一部分，且提取提示词需要它。

### 2. 画像模型瘦身与迁移

`MemoryProfile` 只保留 `summary`、`updatedAt`、`lastSessionId`、`lastSessionTitle`。删除 `revisions`、`userEdited`、`overflow`，同步删除 `undoProfile`、`resumeAutoUpdate`、`markProfileOverflow`、`pushRevision`、`MEMORY_REVISION_LIMIT`。

`parseProfile` 继续容忍旧字段：读到旧画像时丢弃三项、保留正文与来源；检测到旧字段时用清理后的对象覆盖写回一次。理由：旧版本升级后不会因为多出字段报错；回滚到旧版本时旧代码按缺省值处理（`revisions` 为空、两个布尔为 false），不会打不开。

### 3. 提示词按设置生成

`buildExtractionPrompt(summary, window, settings)` 的 system 增加：

- 当前记忆要求原文（取配置，空则默认）。
- 当前最大长度与“先淘汰低优先级旧内容、保留新内容”的规则。
- 明确的淘汰顺序：已完成/一次性项目与目标 → 环境与工具链中的过时细节 → 长期偏好中可推断的低价值项 → 身份与角色非核心细节；`约束与禁忌` 永不自动删除；用户已确认的修正优先于旧值。
- 继续要求：保留未被推翻的事实、时间敏感信息按当前日期推进、严格 JSON、同语言。

`buildCompressionPrompt(summary, settings)` 同样带上记忆要求、最大长度和淘汰顺序。理由：压缩阶段最容易丢约束；只靠提取阶段约束不够。

画像不再有 1200 字软目标；提示词里的“尽量 1200 字”改为“不超过当前上限，尽量保留高价值内容”。界面在达到上限 90% 时提示接近上限。

### 4. 超限收敛与失败重试

`processSession` 的返回处理：

1. 解析失败/空覆盖非空 → 视为失败，不写、不推进 checkpoint。
2. 长度 ≤ 当前上限 → 直接写入。
3. 超限 → 压缩第一次；仍超限 → 压缩第二次；仍超限 → 视为失败。
4. 失败沿用现有退避（5/15/60 分钟，最多 3 次），checkpoint 记为 `error`、`attempts+1`；不设置 `overflow`，不暂停自动更新。
5. 成功后写画像、推进 checkpoint；`hasMore` 仍继续排队。

理由：复用现有失败退避即可做到“自动重试”，不需要新状态；两次压缩是费用与成功率的折中。备选“直接截断”会切掉约束（画像末尾常是约束），否决。

用户调低最大长度导致的现有画像超限：界面在保存更小的上限后调用 `compressProfileIfNeeded()`（`extract.ts` 导出）异步压缩；成功写入，失败保留原画像并让界面显示超限提示，下一次自动更新仍会再尝试。压缩期间注入原画像，不静默截断。

### 5. 编辑语义与并发保护

- `editProfile(summary)`：校验非空、长度 ≤ 当前上限，写入并更新 `updatedAt`；不再设置 `userEdited`，不暂停调度。
- 界面只在“保存”时调用 `editProfile`；“取消”恢复为当前画像。
- 保存时不再调用 `stopMemory()`；若提取请求还在进行，用基线校验丢弃过期结果：`applyAutoProfile(summary, source, baseSummary)` 在 `profile.summary !== baseSummary` 时返回 false，调用方不推进 checkpoint 并重新入队。
- 编辑中自动更新到达：`dirty` 为真时不覆盖草稿，只显示“画像已自动更新，保存将覆盖”提示；未编辑时同步新画像。
- 移除暂停/恢复 UI 与撤销按钮；清空保留（确认弹窗）并照旧保留 checkpoint。

备选：保存时取消进行中的请求再重排。否决，会让“保存后继续更新”出现空窗，且基线校验更精确。

### 6. 界面结构

`MemoryField` 从上到下：

1. 总开关与说明。
2. 最大记忆长度：数字输入（2000–20000），失焦/回车校验；非法值回退当前值并提示；保存后若画像超限，显示“正在压缩”提示并触发压缩。
3. 记忆要求：多行输入 + 字数/默认说明 + 保存/取消；保存空串恢复默认。
4. 当前记忆：多行输入、`{count}/{limit}`、达到 90% 提示、超限阻止保存；保存/取消；最近更新来源与日期；清空按钮。
5. 自动更新中/压缩中状态只在原位置提示，不新增弹窗。

样式复用 `Settings.module.css` 现有 memory 类，新增输入行、错误文本、提示文本类；窄屏沿用现有设置弹窗布局。中英文案同步更新，删除 `settingsMemoryUserEdited`、`settingsMemoryResumeAuto`、`settingsMemoryUndo`、旧的固定 2000 字提示，新增最大长度、记忆要求、并发提示等 key。

### 7. 隐私与注入

`getMemoryInjection` 不变，只注入画像正文；记忆要求与最大长度只参与本机整理，不进入聊天请求。画像仍不进入历史导出、删除会话不删除画像（沿用现有行为）。设置说明中注明“画像会随每次请求发送”，并提示上限越大请求成本越高。

## Risks / Trade-offs

- **压缩仍可能丢掉语义上重要的细节** → 提示词明确淘汰顺序与约束保护；失败时保留旧画像；用户可编辑纠正。
- **大上限（最高 20000 字）显著增加每次请求成本** → 界面说明成本；默认 7000 而非 20000；用户可随时调低。
- **两次压缩 + 失败重试带来额外模型调用** → 仅超限时触发；失败退避与现有失败处理共用；30 秒防抖不变。
- **并发写入**：自动更新与用户保存同时发生 → 基线校验丢弃过期结果，保存内容优先。
- **调低上限触发一次压缩调用** → 只在画像确实超限时触发；失败不阻塞聊天。
- **旧版本回滚**：新设置键旧版本忽略；画像缺少旧字段时旧解析器按默认值工作，可正常降级。

## Migration Plan

1. 读取旧画像：丢弃 `revisions/userEdited/overflow`，保留 `summary/updatedAt/lastSessionId/lastSessionTitle`，并写回一次清理后的 JSON。
2. checkpoint 格式不变，继续使用。
3. 新增设置键缺省时取默认（7000、六类要求）。
4. 回滚：旧版本忽略新键；画像仍可解析；不会升级 IndexedDB。
5. 验证：`pnpm type`、`pnpm lint`、`pnpm build`；Node 脚本覆盖旧画像迁移、长度夹取、默认要求回退；无头浏览器覆盖长度修改、要求编辑、超限压缩、编辑并发与重试。

## Open Questions

无。
