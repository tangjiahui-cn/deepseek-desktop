# Design

## Context

当前设置由一个 Zustand store 统一管理，每个设置项使用独立的 `localStorage` 键，setter 先写入存储再更新内存状态（`src/services/settings.ts`）。设置弹窗在 `SettingsDialog.tsx` 中用固定的 `sections` 数组生成导航，`SettingsSection` 目前只有 `general` 与 `data` 两种，内容区用二元条件渲染。窄屏下导航改为横向标签，样式集中在 `Settings.module.css`，组件类型声明需同步维护在 `Settings.module.css.d.ts`。

聊天请求只有一条构建路径：`src/services/chat/store.ts` 的 `streamReply` 统一处理发送、重新生成与续写，请求的 `system` 字段目前固定为常量 `SYSTEM_PROMPT`。自动标题复用同一个流式请求（通过 `title: { enabled: true }`），没有独立的请求分支。会话历史只保存消息，不保存请求参数。

需求见 `specs/personalization/spec.md`，动机见 `proposal.md`。

## Goals / Non-Goals

**Goals:**

- 在不改变现有请求协议与历史数据结构的前提下，让自定义提示词进入每条生成请求。
- 让长度限制、计数与拼接规则只有一处定义，避免设置界面与请求层各自实现后不一致。
- 保持与现有设置一致的交互：进入即见、编辑即保存、无需确认。

**Non-Goals:**

- 不实现多套提示词、按会话覆盖、启用开关或提示词模板变量。
- 不把提示词写入会话、标题或历史导出，也不提供提示词自身的导入导出。
- 不改变内置身份说明、安全审核、工具声明等既有请求行为。

## Decisions

### 1. 新增独立设置字段与存储键

在 `Settings` 中增加 `systemPrompt: string`，使用 `chat-demo:system-prompt` 键，并新增 `setSystemPrompt(value)`。初始化时读取该键，读取失败或不存在时为空串；读取到的内容用统一的截断函数限制到 2000 字。

理由：项目现有设置均采用「一项一键」模式，沿用后无需迁移整个设置对象，也不会影响其他键的默认值。备选方案是把所有设置序列化进一个 JSON 键，但这会引入旧数据迁移与部分写入问题，收益不足。

### 2. 抽出纯函数模块统一上限与拼接

新增 `src/services/chat/systemPrompt.ts`，承载：

- `SYSTEM_PROMPT_BASE`：原 `SYSTEM_PROMPT` 文案，保持不变；
- `SYSTEM_PROMPT_LIMIT = 2000`；
- `clampSystemPrompt(value)`：按 Unicode 码点计数并截断；
- `composeSystemPrompt(custom)`：`custom.trim()` 非空时返回 `BASE + "\n\n" + trimmed`，否则只返回 `BASE`。

设置 store、设置界面与 `streamReply` 都从这里引用上限和拼接函数。理由：长度限制与拼接规则是同一契约的两端，分散实现容易在修改上限时漏改一处。备选方案是保留 store 中的常量、在组件里直接写 `2000`，但会产生魔法数字和重复的 trim 逻辑。

### 3. 请求时读取，不写入会话快照

`streamReply` 在构建 `CreateMessageRequest` 时调用 `composeSystemPrompt(useSettings.getState().systemPrompt)`，替换当前的固定 `system` 值。提示词在每条新请求发出时读取，因此已有会话的下一条消息、重新生成与续写都会使用最新内容；进行中的请求不受编辑影响。

理由：用户期望改完设置后立刻生效，而按会话保存快照需要修改会话 schema、历史导入导出格式，并引出「旧会话要不要升级」的问题。提示词属于本机偏好而非对话内容，放在请求时读取最符合边界。

### 4. 设置弹窗增加第三个分组与受控多行输入

`SettingsSection` 扩展为 `'general' | 'personalization' | 'data'`，`sections` 数组在通用与数据之间插入「个性化」，复用现有导航按钮、`role="tab"` 与选中态样式。内容区从二元条件改为按分组的显式分支，新增 `PersonalizationSetting`：

- 字段标签使用「提示词」，下方给出简短说明，说明内容会追加到系统提示词之后并对所有会话生效；
- 使用受控 `<textarea>`，值来自 `useSettings`，`onChange` 调用 `setSystemPrompt`，由 setter 统一截断并保存；
- 右下角实时显示 `{count}/2000`，通过 `aria-describedby` 关联说明与计数；
- 高度在桌面端约 148px、窄屏下 180px，内容超出时在输入框内滚动；设置内容区负责整体纵向滚动。

不使用原生 `maxLength`：它按 UTF-16 码元计数，会把一个 emoji 算作 2，和规格中的 Unicode 码点口径不一致，也会在 2000 码元处提前截断。受控截断还能覆盖拖放、输入法粘贴等路径。

每次 `onChange` 直接调用 setter 写存储。2000 字以内的同步写入开销可以忽略，且能保证用户改完立刻关闭窗口也不丢内容；不做防抖可以避免「刚输入完就关闭」时定时器未触发的丢失窗口。

新增一个 16×16 的个性化图标（轮廓风格，加入 `src/components/base/icons.tsx`），用于导航项；同时补充 `Settings.module.css` 与对应的 `.d.ts` 声明。

### 5. 文案与计数格式

在 `src/i18n/zh.ts` 增加分组名、字段名、说明、占位示例与计数模板，`src/i18n/en.ts` 补齐同键英文，利用 `satisfies Record<keyof typeof zh, string>` 在类型检查时发现遗漏。计数模板使用 `{count}/2000`，由现有 `useTranslate` 的占位符替换渲染。

### 6. 自动标题请求的处理

自动标题与首轮回复共用同一次请求，自定义提示词会随该请求一起发送，不额外增加「标题请求不带提示词」的分支。若要在同一请求内区分标题与正文的 system 提示，需要拆分请求或改变服务端调用方式，成本与收益不匹配；标题仍由服务端的 `title` 能力生成，提示词只影响语气与上下文。

## Risks / Trade-offs

- **每条请求增加最多 2000 字上下文**：会增加输入 token、成本与首字延迟。→ 上限固定为 2000，默认空内容；设置说明中提示内容会随请求发送。
- **自定义指令可能与内置说明冲突或降低回答质量**：这是用户主动配置的预期风险。→ 始终保留内置身份说明在前，安全审核与工具配置不受影响；说明文案明确其作用范围。
- **按码点截断可能拆开组合字符或 ZWJ emoji**：仅在正好触及 2000 上限时出现边界瑕疵。→ 与规格口径一致；如后续需要更精细的计数，可再引入 grapheme cluster 计数。
- **每次按键同步写 localStorage**：理论上存在少量主线程开销。→ 内容最多 2000 字，开销可忽略；换取关闭窗口时不丢内容。
- **旧版本回退后遗留设置键**：旧版本不读取该键，不会报错。→ 回退无需清理；如需彻底清除，可手动删除 `chat-demo:system-prompt`。
- **设置弹窗新增分组后窄屏标签变多**：三个标签在窄屏下仍可横向滚动，但每项最小宽度会压缩可用空间。→ 复用现有 `overflow-x: auto` 与 `flex: 1 0 auto`，在 320px 宽度下人工检查。

## Migration Plan

- 无数据迁移：首次升级后该键不存在，按空提示词处理，请求与旧版本完全一致。
- 发布步骤：随常规 Web / Electron 构建发布；无需服务端配合，无 API 变更。
- 回滚策略：回退应用版本即可；新键会被旧版本忽略，不影响会话与历史。
- 验证：执行 `pnpm type`、`pnpm lint`、`pnpm build`；再按任务清单做桌面端与窄屏的手工检查，包括刷新/重启后的恢复、2000 字截断与导出包不含提示词。

## Open Questions

无。
