# Tasks

## 1. 设置与默认常量

- [x] 1.1 在 `src/services/memory/prompt.ts` 增加 `MEMORY_MAX_LENGTH_DEFAULT = 7000`、`MEMORY_MAX_LENGTH_MIN = 2000`、`MEMORY_MAX_LENGTH_LIMIT = 20000`、`DEFAULT_MEMORY_REQUIREMENTS`（六类默认文本），把 `profileLength` 与注入逻辑改为不依赖固定 2000 字。验证：`pnpm type` 通过；Node 临时脚本断言默认要求包含六类、长度按 Unicode 码点计数、空画像注入为空串。
- [x] 1.2 `src/services/settings.ts` 增加 `memoryMaxLength`（读取夹在 2000–20000，缺省 7000）与 `memoryRequirements`（缺省六类，保存时 trim，空串恢复默认），新增对应 localStorage key 与 setter；为 `compressProfileIfNeeded()` 提供当前上限与画像，调低上限后由界面触发压缩。验证：`pnpm type` 通过；Node 临时脚本断言缺省值、非法数字回退、空要求恢复默认。

## 2. 画像模型、存储与提取

- [x] 2.1 重写 `src/services/memory/types.ts`、`store.ts`：移除 `revisions/userEdited/overflow` 及撤销/恢复/暂停函数；`parseProfile` 兼容旧画像并写回清理结果；`applyAutoProfile` 增加 `baseSummary` 基线校验，`editProfile` 只校验非空与当前上限、不再锁定自动更新。验证：`pnpm type` 通过；Node 临时脚本断言旧 JSON 清理、`baseSummary` 不匹配时拒绝写入、编辑后画像可继续被自动更新覆盖。
- [x] 2.2 重写 `src/services/memory/extract.ts` 的提示词与写入流程：提取/压缩都读取当前记忆要求与最大长度；超限先压缩两次，仍超限按失败处理（保留旧画像、checkpoint 不前进、沿用 5/15/60 分钟退避自动重试），不设置暂停状态；导出 `compressProfileIfNeeded()` 供调低上限时调用。验证：Node 临时脚本断言提示词包含要求与上限、两次压缩后失败不写画像、成功时写入并推进 checkpoint、超限不返回 `overflow`。
- [x] 2.3 移除调度中的 `userEdited/overflow` 拦截：编辑保存后不调用 `stopMemory()`，进行中的提取用基线校验丢弃过期结果并重新入队；关闭记忆、清空、替换历史仍取消定时器与进行中请求。验证：`pnpm type` 通过；Node 临时脚本断言保存后仍会调度、基线变化时结果被丢弃且重新入队。

## 3. 记忆设置界面

- [x] 3.1 重写 `MemoryField`：增加最大记忆长度输入（2000–20000，失焦校验、非法回退）、记忆要求编辑框（保存/取消、空串恢复默认）、当前记忆保存/取消；移除撤销、恢复自动更新与暂停提示；编辑中自动更新只提示不覆盖草稿；达到上限 90% 提示、超限阻止保存并显示压缩状态。验证：无头浏览器检查六类默认值、修改长度、编辑要求、保存/取消、超限提示、编辑期间自动更新不覆盖草稿。
- [x] 3.2 更新 `Settings.module.css` 与 `src/i18n/zh.ts`、`en.ts`：新增最大长度、记忆要求、并发提示、压缩中、90% 提示文案；删除 `settingsMemoryUserEdited`、`settingsMemoryResumeAuto`、`settingsMemoryUndo` 与固定 2000 字文案。验证：中英文案无遗留旧 key；320px 无横向溢出。
- [x] 3.3 更新 `README.md` 与 `README.en.md`：说明最大记忆长度可配（默认 7000，范围 2000–20000）、记忆要求可编辑、约束与禁忌不会被自动删除、编辑不再暂停自动更新。验证：文案与新行为一致。

## 4. 集成验证

- [x] 4.1 运行 `pnpm type`、`pnpm lint`、`pnpm build`，确认全部通过且无新增告警。
- [x] 4.2 无头 Chrome 端到端：开启记忆 → 修改记忆要求 → 单轮后自动更新按新要求整理 → 修改上限为 3000 → 超限时自动压缩且不暂停 → 编辑保存后继续自动更新 → 压缩失败后自动重试 → 重启后长度/要求/画像/checkpoint 恢复。
- [x] 4.3 运行 `openspec validate update-memory-settings --strict`，确认规格与任务一致。

## Workflow follow-up

- 实现并满足项目评审要求后，使用 `openspec-apply-change` 逐项完成任务。
- 归档使用 `openspec-archive-change`，把 `memory` delta 同步进主 spec。
