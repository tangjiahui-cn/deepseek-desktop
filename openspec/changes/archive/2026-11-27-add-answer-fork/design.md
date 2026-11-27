# Design

## Context

- 会话模型（`src/services/chat/types.ts`）：`Session.messages` 保存**所有分支版本**，用 `parentId` / `selectedChildId` 组成树；`rootMessageId === undefined` 表示旧版线性数据。界面展示与请求上下文共用 `getVisibleMessages`（`branches.ts`）从根沿 `selectedChildId` 取出的单一路径。
- 会话详情按需加载进 `sessionCache`（最近 5 个，当前会话不淘汰），侧栏只读 `sessions` 摘要数组，按 `updatedAt` 降序。保存统一走 `persist` → `db.saveSession`（`sessions` + `sessionSummaries` + `files` 三表事务）；失败进入 `unsavedSessions` 并由 `sessionSaveErrors` + `retrySaveSessions` 提示与重试。
- 附件本地标识 `file.id` 是 IndexedDB `files` 表主键，原件全局共享；会话摘要记录 `fileIds`，删除会话时用多值索引确认没有其他会话引用后才删原件。
- 书签主键是 `messageId`（全局唯一），`openBookmark` 用 `sessionId + messageId` 定位。
- 记忆进度按 `sessionId` 存 `lastProcessedMessageId`（`memory/store.ts` 的 `setMemoryCheckpoint`），提取从 checkpoint 之后开始，并跳过早于开启时间的消息。
- 回答操作区（`AssistantMessage.tsx`）在非流式时渲染复制、朗读、书签、重新生成；按钮在 `busy` 时禁用。

## Goals / Non-Goals

**Goals:**

- 纯客户端实现，复用现有会话、摘要、附件存储与保存失败重试机制，不新增 IndexedDB 存储或版本。
- 分叉后立即可用：新会话进入内存缓存与摘要列表，同时异步落盘。
- 与既有交互一致：分叉与其他回答操作共用同一操作区、禁用规则与轻提示。

**Non-Goals:**

- 不做会话树、父子会话导航或「分叉自…」来源展示（不写入来源字段，避免影响历史归档格式）。
- 不做跨设备同步、不做分叉后的自动提问。
- 不复制书签、收藏状态、草稿；不改变历史导出/导入格式。
- 不提供「重新提取记忆」入口；记忆只处理分叉之后产生的内容这一取舍见 Risks。

## Decisions

### 1. 复制可见路径，而不是整个消息数组

用 `getVisibleMessages(session)` 取当前分支，再按被点击回答的位置截断。隐藏的旧版本不属于用户当前看到的上下文，复制它们会让新会话带着一条看不见的分支进入请求上下文，违背「基于此位置」。

备选：复制 `session.messages` 全部并用原 `selectedChildId` 重建树 —— 实现更简单，但会让新会话保留用户在当前会话里已经切换掉的历史版本，且新会话的分支选择器会显示用户没看过的版本，故放弃。

### 2. 复制到被点击回答为止（含该回答）

新会话最后一条消息就是该回答，因此：

- 复制过来的这一轮能作为历史轮次进入后续请求上下文（`getContextRounds` 只配对「提问 + 可用回答」）。
- 用户在新会话里直接提问，走现有 `sendMessage` → `appendBranch(session, 最后一条.id, [提问, 回答])`，无需特殊分支逻辑。

备选：只复制到该回答之前的提问 —— 新会话会以一个没有回答的问题结尾，视觉与上下文都别扭。

### 3. 消息 ID 全部重新生成，父子关系重建为单链

新消息 id 由 `createId()` 生成，`parentId` 指向复制出的上一条，最后一条 `selectedChildId` 为空，`rootMessageId` 为复制出的首条。原因：

- 书签按 `messageId` 全局唯一，沿用旧 id 会让分叉出的回答误显示为已加书签，且书签跳转会指向错误的会话；
- 记忆 checkpoint、搜索面板、消息跳转都以消息 id 为键，重复 id 会串台。

附件不换 id：`file.id` 指向共享原件，换 id 反而要复制 blob。

备选：保留原 id 并让书签按 `sessionId + messageId` 复合主键 —— 需要升级 IndexedDB 并迁移书签，超出本需求。

### 4. 新会话沿用原标题，`createdAt` / `updatedAt` 取分叉时刻

用户已确认沿用原标题（含空标题的情况）。`updatedAt = now` 让新会话排在侧栏最前；标题非空时，现有自动命名逻辑（只在标题为空时申请）不会覆盖它；标题为空时，新会话的第一条提问会自动生成标题，与新建会话一致。

备选：追加「（分支）」后缀或清空标题 —— 前者把本地化文案写进用户数据，后者丢失原对话的辨识线索，均放弃。

### 5. 逻辑分层：纯构造函数 + store 动作

- `src/services/chat/fork.ts`：`forkSessionAt(session, messageId, now): Session | null`，纯函数，负责取可见路径、截断、重建 id 与父子关系、生成新 `Session`。便于用临时脚本直接验证边界（中间回答、分支版本、附件）。
- `src/services/chat/store.ts`：新增 `forkSession(sessionId, messageId): boolean`，负责守卫（导入中、删除中、生成中）、取源会话、调用构造、写入 `sessions`/`sessionCache`/`activeId`、`persist`、`trimSessionCache`，并在切换后触发原会话的记忆 flush（与 `selectSession` 一致）。

备选：在组件里组装新会话并直接调 `db.saveSession` —— 会绕过缓存淘汰、保存失败重试与记忆进度，故放弃。

### 6. 新会话插入列表并设为当前会话

直接复用 `sendMessage` 新建会话时的写法：`sortSessions([toSessionSummary(forked), ...sessions])`，同时把详情放进 `sessionCache` 并置 `activeId`，再 `persist(forked.id)`。因为详情已在缓存，`selectSession` 的 `ensureSessionLoaded` 是 no-op；这里不调用 `selectSession`，避免它对 `sessions` 的前置校验和额外的加载分支。

切换前调用 `flushMemoryForSession(previousActiveId)`，与 `selectSession` / `newChat` 的既有行为保持一致。

### 7. 附件共享原件，必要时先补写原件

新会话摘要的 `fileIds` 会包含复制过来的附件，删除任一方时靠现有索引判断原件是否仍被引用，因此分叉不需要复制 blob。唯一风险窗口：源会话还有未落盘的 `pendingFiles`（保存失败时），新会话会引用尚未写入 `files` 表的原件。处理方式：分叉时若存在 `pendingFiles.get(sessionId)`，先 `db.saveFiles(...)` 把这些原件写库（写失败走 `reportStorageError`），再保存新会话；写库是幂等的，源会话的重试保存不会受影响。

备选：让 `persist` 支持额外文件参数 —— 需要改动共享保存路径的相等性判断，收益不足。

### 8. 记忆 checkpoint 定位到复制终点

新会话没有 checkpoint 时，提取会从路径开头重新扫描并重复合并已处理内容。分叉时用 `setMemoryCheckpoint({ sessionId: 新 id, lastProcessedMessageId: 复制出的最后一条消息 id, lastProcessedAt: now, status: 'idle', attempts: 0 })`，后续只处理新消息。

备选：继承原会话 checkpoint —— 它可能位于当前会话的另一条分支上，`getMemoryWindow` 找不到时会退回到路径开头，仍会重复提取。备选：不处理 —— 长期画像会被同一段对话反复合并，放弃。

### 9. 入口放在操作区，与其他操作共用显隐与禁用规则

- 位置：书签按钮之后、重新生成之前；语义分组是「基于这条回答再做事」，重新生成是「重做这条回答」，放最后。
- 显隐：复用朗读按钮的条件（有正文且未被安全拒绝），与「有正文的已完成回答」一致；流式期间操作区整体不渲染，`busy` 时按钮禁用（与重新生成一致）。
- 交互：点击先 `stopReadAloud()`（与重新生成一致），再 `forkSession(...)`；成功后 `showToast({ key: 'forkedToNewChat' })`，让用户在内容与原对话相同的情况下确认已经换到新对话。
- 视觉：新增 `IconBranchOutline16`（16px、1.5 描边、主干下接一个分向右上的分支节点，与 `icons.tsx` 现有图标同规格；已与用户确认采用该形态），不新增 CSS Module 类名，沿用 `.actions` 的间距与悬停显隐。
- 文案：`forkToNewChat`（按钮提示/无障碍名称）、`forkedToNewChat`（轻提示），中英文同时补齐。

## Risks / Trade-offs

- [分叉与生成并发] 源会话仍在生成时复制到的路径可能含未完成回答 → `forkSession` 在存在 stream controller 时直接拒绝，按钮同时禁用。
- [同名会话难区分] 沿用原标题会出现两个同名会话 → 已与用户确认；新会话置顶且立即切换，配合轻提示给出反馈，用户可自行重命名。后续若需要来源标识，作为独立变更加字段与 UI。
- [记忆取舍] checkpoint 设在复制终点后，原会话在分叉点之后、尚未被处理的消息不会经由新会话补提取 → 记录为已知取舍；画像仍可由原会话后续的消息更新。
- [复制成本] 深拷贝整条可见路径并重建 id 是 O(n)，纯内存操作，长对话也在毫秒级；不做结构共享。
- [附件生命周期] 依赖现有 `fileIds` 引用计数在删除会话时保留共享原件 → 任务中加入「分叉后删除原会话，附件仍可见」的验证。
- [保存失败] 新会话走现有 `persist` 重试；若失败，界面已有全局保存失败提示，不会静默丢数据。

## Migration Plan

无数据迁移：不新增存储、不改 `DB_VERSION`、不改历史归档结构。上线后旧会话与旧归档照常读取；不想要分叉的会话可直接删除，与其他会话一致。
