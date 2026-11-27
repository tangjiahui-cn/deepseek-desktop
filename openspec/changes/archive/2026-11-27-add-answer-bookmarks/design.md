# Design

## Context

- 侧边栏标签页由 `Sider` 内的本地状态控制，目前为「全部 / 收藏夹」；会话列表来自 `useChatStore().sessions`，时间分组复用 `groupSessions`。
- 会话详情按需从 IndexedDB 载入，`sessionCache` 最多保留 5 个会话；书签列表如果从会话消息中扫描，需要加载全部会话，代价过高。
- 会话消息带 `parentId` / `selectedChildId`，当前可见路径由 `getVisibleMessages` 从 `rootMessageId` 沿 `selectedChildId` 走出；旧回答可能位于未选中的分支。
- IndexedDB 当前版本 11，包含 `sessions`、`sessionSummaries`、`files` 与导入暂存；历史导出只写 DeepSeek 兼容格式，不包含本地收藏/书签字段。
- 回答操作区在 `AssistantMessage` 的 `.bottom` 中，现有按钮为复制、朗读、重新生成；操作区默认悬停显示，最后一条回答常显，移动端沿用该规则。

## Goals / Non-Goals

**Goals:**

- 书签列表的读取不依赖会话详情加载，打开「书签」标签页的代价与书签数量相关，而不是与全部历史消息相关。
- 书签状态、会话生命周期与历史替换保持一致：删除会话级联删除书签，导入/清空历史清空书签，读取失败不误删。
- 从书签定位时能展开隐藏分支，定位到回答开头，且不引入高亮或选中态。
- 桌面与移动端共用同一套数据与跳转逻辑，移动端只额外关闭抽屉。

**Non-Goals:**

- 不把书签写入历史导出/导入格式。
- 不改变删除确认弹窗文案。
- 不改变移动端旧回答操作区的显隐规则，也不新增书签备注、排序、拖拽或云端同步。
- 不对旧版本数据库做书签回填；升级后书签初始为空。

## Decisions

### 1. 新增独立 `bookmarks` 对象仓库，而不是在消息上加字段

数据库版本从 11 升到 12，新增：

- `bookmarks`：keyPath 为 `messageId`，value 为 `{ messageId, sessionId, excerpt, createdAt }`；
- `sessionId` 索引，用于删除会话时按来源批量清理。

选择独立仓库的原因：

- 书签列表需要跨会话读取摘要；会话详情有 5 个的缓存上限，扫描全部会话会把大量消息读进内存。
- 书签不参与请求上下文、分支或标题生成，放在独立仓库不会影响现有保存流程。
- 删除会话时在同一个事务里按 `sessionId` 删除，导入/清空历史时在提交事务里清空，生命周期可控。

备选：在 `AssistantMessage` 上加 `bookmarkedAt`。实现更短且随会话原子保存，但书签列表必须加载全部会话，长历史下打开标签页会明显变慢，因此不采用。

### 2. 书签状态用独立 zustand store，启动时初始化

新增 `useBookmarks`，保存 `items`（按 `createdAt` 倒序）与 `byMessageId` 映射；`initBookmarks` 在 `initChat` 读取摘要后调用，并把不在当前会话摘要中的记录清理掉。初始化完成后才把 chat store 标记为 ready，避免书签按钮先显示空心再跳变。

- 添加/移除使用乐观更新：先改内存，写库失败再回滚并抛出错误，由组件提示保存失败。
- 同一回答的切换以 `byMessageId` 为准，先移除后添加都走同一入口，保证最多一条记录。
- 历史替换成功后重置内存 store；初始化期间的并发替换用代次标记避免旧加载覆盖新状态。

### 3. 回答操作区按钮与摘要

`AssistantMessage` 在朗读与重新生成之间插入书签按钮：

- 仅当 `answer?.text` 非空且当前消息不在流式中时渲染；无正文的拒绝/失败回答不显示。
- 空心使用新增的 `IconBookmarkOutline16`，已保存使用 `IconBookmarkFill16`；实心颜色使用 `--dsw-alias-brand-primary`，与金色会话收藏星标区分。
- 使用 `IconButton` 的 `tooltip` 与 `aria-pressed`，点击后 toast「已添加书签」/「已移除书签」；写入期间禁用按钮，避免连点竞态。
- 摘要从回答 Markdown 提取纯文本、压缩空白并限制长度；存储摘要而不是每次从会话重新解析。继续生成会改变同一条消息正文，因此在该回答收尾时若已有书签，刷新摘要与保存时间以外的内容（保存时间不重置）。

### 4. 侧栏第三个标签页与无图标列表项

- `SessionTab` 扩展为 `all | favorites | bookmarks`；新增「书签」标签，沿用现有 28px 胶囊、移动端等宽 36px 的样式。
- 书签列表直接读 `useBookmarks().items`，用会话摘要映射来源标题；来源会话缺失的记录不渲染。
- 新增 `BookmarkItem` 组件：可点击按钮，无任何前置图标；摘要最多两行，第二行放来源标题与保存时间，时间右对齐。只保留 hover 与 `focus-visible` 反馈，不设置选中态。
- 空态显示「暂无书签」与引导文案；添加第一条或移除最后一条时立即切换列表/空态。
- 保存时间用相对时间（刚刚/分钟/小时/昨天/天），超过 7 天显示日期；标签页激活时每分钟刷新一次 `now`。

备选：把列表项放进 `Sider` 内部并用 `Sider.module.css`。单独组件更便于复用时间格式与移动端样式，最终选择独立组件与 CSS Module。

### 5. 分支展开与一次性定位请求

- 在 `branches.ts` 新增 `revealMessage(session, messageId)`：沿 `parentId` 回溯到根，逐级把祖先的 `selectedChildId` 指向目标分支；目标已在可见路径或链不完整时返回原对象。
- `openBookmark` 放在 chat store：校验会话存在 → `selectSession` → 等待详情加载 → 校验消息存在 → 若目标不可见且会话正在生成则返回 busy → `revealMessage` 并保存 → 写入一次性跳转请求。
- 跳转请求使用独立 zustand store（`sessionId + messageId + nonce`）；`MessageList` 用 `useLayoutEffect` 消费：找到 `[data-message-id]`，关闭 sticky，按“目标顶部距滚动容器顶部 16px”设置 `scrollTop`，随后清除请求。不添加高亮类，也不把书签项设为选中。
- 移动端 `scrollRef` 指向内部滚动层，同一定位逻辑可复用；书签点击时先关闭抽屉。
- 目标会话/回答不存在时移除书签并提示；读取失败时保留书签并提示跳转失败；隐藏分支 + 生成中不切换分支并提示。

备选：复用 `selectVersion`。它只切换当前可见路径上的兄弟版本，无法展开深层隐藏分支，不能满足书签定位。

### 6. 删除会话与历史替换的级联清理

- `deleteSession` 事务加入 `bookmarks` store，按 `sessionId` 索引删除；失败时事务整体回滚，内存 store 在删除成功回调后再移除对应项。
- `commitStaging` 事务加入 `bookmarks` 并清空；成功替换历史后重置内存 store，失败保留原状态。
- 删除确认弹窗与文案不做任何修改。

## Risks / Trade-offs

- [数据库版本升级] → 只在 upgrade 中创建缺失的 store/index，不迁移旧消息；失败时保留旧版本数据，后续可重试。
- [内存与 IndexedDB 不一致] → 操作乐观更新并在失败时回滚；删除/替换在事务成功后更新内存；启动时按有效会话清理孤儿记录。
- [摘要随继续生成变旧] → 在回答收尾时刷新已有书签的摘要；刷新失败只记录日志，不阻断回答。
- [展开旧分支改变当前会话路径] → 这是书签定位的预期行为，分支选择会按现有规则持久化；返回后用户仍在目标回答所在分支。
- [书签指向缺失消息] → 打开时移除并提示；列表渲染时过滤来源会话缺失的项。
- [移动端旧回答操作区不常显] → 沿用现有规则，不扩大本次范围；最后一条回答可直接添加书签。
- [相对时间显示不刷新] → 「书签」标签激活时每分钟更新一次 `now`；其他标签页不增加计时器。
- [导出/导入丢失书签] → 已明确为本地数据，不写入 DeepSeek 兼容归档。

## Migration Plan

1. 升级数据库版本到 12，创建 `bookmarks` store 与 `sessionId` 索引；旧会话、摘要、附件与收藏字段保持不变。
2. 首次启动时书签列表为空，不执行回填。
3. 回滚代码时旧版本会忽略新增 store；已写入的书签记录保留但不可见，不影响会话读取。

## Open Questions

无。
