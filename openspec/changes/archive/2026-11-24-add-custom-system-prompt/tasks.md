# Tasks

## 1. 提示词规则与请求接入

- [x] 1.1 新增 `src/services/chat/systemPrompt.ts`，导出 `SYSTEM_PROMPT_BASE`、`SYSTEM_PROMPT_LIMIT = 2000`、按 Unicode 码点截断的 `clampSystemPrompt`，以及 `composeSystemPrompt`（trim 后非空时用空行追加）。验证：`pnpm type` 通过；用 Node 24 的临时脚本导入该模块，断言空串、纯空白、普通文本、2001 个码点（含 emoji）四种输入的结果符合规格。
- [x] 1.2 在 `src/services/chat/store.ts` 用 `composeSystemPrompt(useSettings.getState().systemPrompt)` 替换固定 `system`，并删除旧的 `SYSTEM_PROMPT` 常量。验证：`pnpm type` 通过；检索确认请求里只有一个 `system` 赋值点，空提示词时仍为原来的身份说明字符串。

## 2. 设置存储与个性化界面

- [x] 2.1 `src/services/settings.ts` 增加 `systemPrompt` 字段、`chat-demo:system-prompt` 键、初始化时的 `clampSystemPrompt` 处理与 `setSystemPrompt` setter。验证：`pnpm type` 通过；键名与现有 `chat-demo:` 前缀一致，setter 同时写存储与 `useSettings` 状态。
- [x] 2.2 `src/i18n/zh.ts` 与 `src/i18n/en.ts` 增加分组名、字段名、说明、占位示例与 `{count}/2000` 计数文案。验证：`pnpm type` 通过（`en` 的 `satisfies Record<keyof typeof zh, string>` 会检查键完整）；切换中英文后界面无缺失文案。
- [x] 2.3 `settingsDialogState.ts` 的 `SettingsSection` 增加 `personalization`；`SettingsDialog.tsx` 在通用与数据之间加入导航项与内容分支，并在 `icons.tsx` 增加 16×16 个性化图标。验证：`pnpm type` 通过；桌面端与窄屏下均显示三个分组，点击与键盘切换时选中态和内容区同步。
- [x] 2.4 新增 `PersonalizationSetting` 受控 textarea（`onChange` 截断后自动保存、实时计数、`aria-describedby`），并在 `Settings.module.css` 与 `.d.ts` 增加样式和类名声明。验证：输入 12 字显示 12/2000；粘贴 2500 字只保留前 2000 字；清空后计数为 0/2000；关闭并重新打开设置、刷新页面后内容保留（同时覆盖 2.1 的读写）。
- [x] 2.5 更新 `README.md` 与 `README.en.md` 的功能说明，加入一条个性化提示词描述。验证：中英文两处文案与当前行为一致，没有遗漏或互相矛盾。

## 3. 集成与回归验证

- [x] 3.1 运行 `pnpm type`、`pnpm lint`、`pnpm build`，确认全部通过且没有新增告警。
- [x] 3.2 在开发环境发送消息并检查请求体：设置提示词后 `system` 为身份说明、一个空行与提示词；仅含空白或清空时只有身份说明；修改后已有会话的下一条消息、重新生成与续写都使用新内容。
- [x] 3.3 导出全部历史并检查 ZIP 内的会话数据不含提示词文本；重新导入后会话可正常打开。
- [x] 3.4 在桌面端约 320px 宽度检查三个标签可横向滚动、输入框与计数不溢出；重启桌面应用后提示词仍保留。

## Workflow follow-up

- 实现完成并满足项目评审要求后，按 `openspec-apply-change` 流程逐项完成任务。
- 归档前运行 `openspec validate add-custom-system-prompt`，归档使用 `openspec-archive-change` 工作流。
