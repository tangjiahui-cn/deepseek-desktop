# Tasks

## 1. 分叉构造逻辑

- [x] 1.1 新增 `src/services/chat/fork.ts`：实现 `forkSessionAt(session, messageId, now): Session | null`，用 `getVisibleMessages` 截取到目标回答为止的路径，重新生成消息 id 并重建 `parentId` / `selectedChildId` / `rootMessageId`，返回带新 id、沿用原标题的新 `Session`；验证：在 `tmp/` 下写临时 Node 脚本，覆盖「中间回答」「最后一条回答」「存在隐藏版本」「目标不是回答」四类输入，断言复制条数、根节点与单链关系正确
- [x] 1.2 校验复制内容不变、原会话不被修改；验证：同一临时脚本断言复制出的提问附件 id、`createdAt`、回答的 `model` / `thinking` / `search` / `latestReminder` / `status` 与原值一致，且传入的源 `Session` 深度比较前后无变化

## 2. 分叉动作与本机保存

- [x] 2.1 在 `src/services/chat/store.ts` 新增 `forkSession(sessionId, messageId)`：校验导入中、删除中与进行中的生成后拒绝执行；成功后把新会话摘要排到 `sessions` 最前、写入 `sessionCache`、设为 `activeId`、调用 `persist`，切换前对原会话执行 `flushMemoryForSession`；验证：`pnpm type` 通过，且脚本或手工路径能触发一次分叉并看到新会话出现在缓存与列表
- [x] 2.2 处理附件与记忆进度：分叉时若源会话存在 `pendingFiles`，先用 `db.saveFiles` 补写原件再保存新会话；用 `setMemoryCheckpoint` 为新会话写入以复制终点为 `lastProcessedMessageId` 的进度；验证：在 `tmp/` 临时页面脚本中断言 `localStorage` 的 `chat-demo:memory-checkpoints` 出现新会话 id 且指向复制终点，保存失败场景下新会话仍进入 `unsavedSessions` 并可由 `retrySaveSessions` 恢复

## 3. 回答操作区入口

- [x] 3.1 在 `src/components/base/icons.tsx` 新增 `IconBranch16`：16px、`fill="currentColor"` 的分叉图标，与相邻图标规格一致；验证：`pnpm type` 与页面渲染截图
- [x] 3.2 在 `src/components/messages/AssistantMessage.tsx` 的操作区、书签按钮之后与重新生成之前插入分叉按钮：仅在有正文且非安全拒绝的回答上显示，`busy` 时禁用；点击先 `stopReadAloud()`，`forkSession` 成功后 `showToast({ key: 'forkedToNewChat' })`；验证：`pnpm type`，并在开发页面点击确认新会话已打开、轻提示出现
- [x] 3.3 在 `src/i18n/zh.ts` 与 `src/i18n/en.ts` 同步新增 `forkToNewChat` 与 `forkedToNewChat`；验证：`pnpm type` 通过（key 类型一致），且切换界面语言后提示文案对应变化

## 4. 验收证据与回归

- [x] 4.1 截图验收：桌面端悬停展开操作区、点击分叉后侧栏置顶并切换、轻提示；移动端最后一条回答常显操作区与分叉入口；截图存到 `tmp/evidence/`，确认覆盖关键状态
- [x] 4.2 回归验证：分叉后原会话消息、分支选择、标题与侧栏位置不变；书签仍只指向原会话中的回答；收藏与草稿不随分叉继承；删除原会话后新会话附件仍可预览；验证：逐项在开发页面操作并截图记录
- [x] 4.3 质量检查：`pnpm type`、`pnpm lint`、`pnpm build` 全部通过；确认 `IndexedDB` 版本号与历史归档结构未改动（`git diff` 无 `DB_VERSION` 与 `history/schema.ts` 变更）

## Workflow follow-up

- 归档前运行 `openspec validate add-answer-fork --strict`，确认任务全部完成。
- 按 AGENTS.md 先询问用户是否提交并发布；用户确认后再归档、升 MINOR 版本（0.6.0 → 0.7.0）、提交、推送 `main` 并打 `v<version>` tag。
