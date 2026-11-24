# Tasks

## 1. 画像数据与注入

- [x] 1.1 重写 `src/services/memory/types.ts`、`store.ts`：单段 `MemoryProfile`、revisions、`userEdited/overflow`、checkpoint、localStorage 读写、旧条目迁移、编辑/撤销/清空/暂停恢复。验证：`pnpm type` 通过；Node 临时脚本断言损坏 JSON 回退、旧条目拼接迁移、revision 上限、撤销、checkpoint 清理。
- [x] 1.2 重写 `src/services/memory/prompt.ts`：1200 目标 / 2000 硬上限、码点计数、画像注入文本。验证：Node 临时脚本断言空画像、计数、注入块内容与上限。
- [x] 1.3 扩展 `src/services/chat/systemPrompt.ts` 的 `composeSystemPrompt`，在自定义提示词后追加画像块；空画像时输出与现有完全一致。验证：Node 临时脚本对比空画像与现有输出相等，有画像时顺序为身份说明、自定义提示词、画像。

## 2. 设置与画像界面

- [x] 2.1 `src/services/settings.ts` 增加 `memoryEnabled` 与 `memoryEnabledAt`；新增「记忆」分组类型、导航项、16×16 图标与中英文文案。验证：`pnpm type` 通过；设置弹窗显示四个分组，切换「记忆」时内容区正确。
- [x] 2.2 重写 `MemoryField`：总开关、画像编辑框、字数/上限提示、最近更新来源、编辑后暂停自动更新、恢复自动更新、撤销、清空确认。验证：无头浏览器检查默认关闭、编辑保存、暂停/恢复、撤销、清空、刷新后恢复、320px 无横向溢出。
- [x] 2.3 更新 `README.md` 与 `README.en.md`，说明长期画像是可选、自动更新的能力。验证：中英文文案与默认关闭、30 秒更新、2000 字上限一致。

## 3. 提取与调度

- [x] 3.1 保留窗口与 checkpoint 纯函数：基于 `getVisibleMessages`、`enabledAt`、最大 50 条/12000 字、2 条前文、分支失效重置。验证：Node 临时脚本断言窗口截断、只取新消息、120 条消息分 50/50/20、分支切换重置。
- [x] 3.2 新增画像提取与压缩：`deepseek-flash`、严格 JSON `{"summary"}`、保留旧事实、空画像不覆盖、超过 2000 字先压缩、压缩失败标记 overflow、不推进 checkpoint。验证：Node 临时脚本覆盖合法 JSON、损坏 JSON、空覆盖拒绝、超长压缩分支。
- [x] 3.3 新增 30 秒调度：新提问/新回复重置计时、新建/切换立即 flush、50 条/12000 字兜底、全局串行队列、超时与最多 3 次退避、关闭/编辑/清空时取消。验证：`pnpm type` 通过；Node 临时脚本断言退避序列；无头浏览器验证重置与 flush。

## 4. 生命周期与请求接入

- [x] 4.1 `streamReply` 开始时清理旧计时，构建请求时注入当前画像，结束后安排 30 秒更新；关闭或空画像时 system 保持原样。验证：无头浏览器 mock 消息接口，检查新会话/已有会话的 `system`。
- [x] 4.2 接入生命周期：新建对话/切换会话 flush、启动补跑、删除会话清理 checkpoint、导入后清空 checkpoint、用户编辑/清空时停止任务。验证：无头浏览器检查更新触发、checkpoint 推进、删除会话后画像保留、导入后旧进度不再使用。
- [x] 4.3 处理分支与多窗口串联：checkpoint 失效时从开启后起点重新处理；一个窗口完成后仍有剩余内容则继续排队直到追平或失败。验证：带分支会话的无头检查；长对话多窗口推进到最后一条。

## 5. 集成验证

- [x] 5.1 运行 `pnpm type`、`pnpm lint`、`pnpm build`，确认全部通过且无新增告警。
- [x] 5.2 无头 Chrome 端到端：开启记忆 → 单轮后 30 秒更新画像 → 新提问重置计时 → 新建对话立即更新 → 新会话 system 包含画像 → 编辑后暂停自动更新 → 撤销 → 重启恢复。
- [x] 5.3 无头 Chrome 验证超限：mock 返回超长画像 → 触发压缩 → 压缩仍超限时保留旧画像、暂停自动更新并显示提示；手动精简后可恢复。
- [x] 5.4 运行 `openspec validate add-cross-session-memory --strict`，确认规格与任务一致。

## Workflow follow-up

- 实现完成并满足项目评审要求后，按 `openspec-apply-change` 流程逐项完成任务。
- 归档前运行 `openspec validate add-cross-session-memory`，归档使用 `openspec-archive-change` 工作流并同步 `memory` 主 spec。
