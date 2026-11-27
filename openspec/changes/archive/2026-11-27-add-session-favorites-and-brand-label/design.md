# Design

## Context

- 侧边栏展开态由 `Sider` 渲染，收起时整个组件卸载（`App` 中 `siderCollapsed ? null : <Sider />`），移动端抽屉打开时才挂载 `MobileSider`，因此标签页状态放在 `Sider` 内即可满足“默认全部、重新展开回到全部”。
- 会话列表来自 `useChatStore().sessions`（`SessionSummary[]`），按 `updatedAt` 倒序；时间分组由 `groupSessions` 统一处理。
- 会话详情按需从 IndexedDB 载入；`ensureSessionLoaded` 会用列表摘要覆盖同名字段，`sameSummary` 决定摘要是否变化。`saveSession` 由会话详情反推摘要写回。
- 历史导出格式（ZIP）只写出白名单字段，`pinned` 固定为 false；归档不是收藏状态的载体。
- 轻提示已有全局 `showToast`（`role="status"`，3 秒后消失）；菜单、图标与按钮样式已有可复用组件。
- 上一版本修复了“菜单展开后触发按钮消失导致浮层跳到左上角”的问题，新增的收藏项沿用同一个菜单。

## Goals / Non-Goals

**Goals:**

- 收藏状态与会话生命周期绑定：创建默认未收藏，删除一并清除，重启后保留。
- 收藏/取消收藏即时反映到「全部」「收藏夹」两个视图与菜单文案，且不扰动现有排序和当前打开的会话。
- 标签页与品牌名改动保持现有侧边栏尺寸、间距与暗色/亮色主题表现。

**Non-Goals:**

- 不把收藏写进历史导出/导入格式，也不迁移 `pinned` 语义。
- 不新增会话行内的收藏星标、收藏数量、拖拽排序或收藏夹独立排序。
- 不修改 Electron 窗口标题、系统菜单与「关于」中的应用名。
- 不持久化当前选中的标签页（收起或重启后回到「全部」）。

## Decisions

### 1. 收藏字段放在 `Session` 与 `SessionSummary`，不新增对象仓库

`Session` 增加可选 `favorite?: boolean`（缺省视为 false），`SessionSummary` 增加必填 `favorite: boolean`，`toSessionSummary` 归一化 `session.favorite === true`。`sameSummary` 加入 `favorite` 比较，使列表能响应收藏变化。

备选：单独建 `favorites` 对象仓库（需提升 DB 版本、维护会话删除联动）；或用 localStorage 存 id 集合（与 IndexedDB 生命周期分离，清空历史时容易残留）。选择字段方案是因为它随会话记录原子读写，无需迁移，旧数据缺省未收藏。

### 2. 读写路径：已载入会话走 `updateSession` + `persist`，未载入会话走专用 DB 事务

新增 store action `setSessionFavorite(id, favorite)`：

- 详情已在缓存中：`updateSession` 同步更新 `sessionCache` 与 `sessions` 摘要，再 `persist(id)` 复用现有保存与失败重试。
- 详情未载入：先乐观更新 `sessions` 摘要，再调用 `db.setSessionFavorite`，在同一个事务里更新 `sessions` 与 `sessionSummaries`，避免摘要与详情不一致。

DB 不升版本：只新增普通字段，不新增 store/index。`renameSession` 等已有路径通过 `storedSummary(session)` 天然带上 `favorite`。旧记录没有该字段时按 false 处理。

### 3. 收藏操作不修改 `updatedAt`

收藏只是元数据筛选，不改 `updatedAt`，也不触发重新排序。`updateSession` 因摘要变化会走一次 `sortSessions`，但排序键未变，稳定排序保持原顺序。

### 4. 标签页放在 `Sider` 内，复用 `groupSessions`

`Sider` 用 `useState<'all' | 'favorites'>('all')`；先按标签页过滤 `sessions`，再交给 `groupSessions` 分组，避免复制分组逻辑。两个标签页都保留时间分组表头；「收藏夹」为空时显示空状态文案。

视觉上采用紧凑胶囊：不铺满侧边栏、不设外轨道，两枚 28px 高、13px 字、4px 间距的圆角按钮左对齐。选中项用 `--dsw-specific-sidebar-nav-item-hover` 填充并改用主文字色，未选中用次级文字色，hover 用更浅的交互底色；移动端改为两枚等宽铺满、36px 高。标签行位于滚动区域之外，与「开启新对话」间隔约 12px、与列表间隔约 12px。

标签页使用 `role="tablist"` / `role="tab"` + `aria-selected`，与设置弹窗的标签页语义一致；列表容器作为 `role="tabpanel"`，`aria-controls` 指向它。

备选一：全宽浅色轨道 + 胶囊。视觉更重，紧接主按钮会像第二个主操作，放弃。
备选二：下划线标签。最轻，但应用内没有下划线选中模式，且与「今天」分组表头之间容易出现多余横线，放弃。
备选三：把标签页状态放到 settings store 持久化。未采用，因为需求只要求默认「全部」，且收起侧边栏会卸载 `Sider`，持久化反而会与“重新展开回到全部”的预期冲突。

### 5. 收藏项插在「重命名」与「删除」之间，文案与图标随状态切换

`SessionItem` 构造菜单选项时按 `session.favorite` 选择：

- 未收藏：「收藏」+ 星形描边图标；已收藏：「取消收藏」+ 星形实心图标。
- 点击调用 `setSessionFavorite`，并按目标状态调用 `showToast({ key: 'sessionFavorited' | 'sessionUnfavorited' })`。
- 删除按钮保持危险样式与原有确认弹窗。

轻提示放在组件层而不是 store，保持 store 不依赖 UI。

### 6. 品牌名只改 i18n 的 `appName`

中文与英文的 `appName` 都改为 `DeepSeek Desktop`，`Sider` 现有渲染逻辑不变；Electron 的 `DISPLAY_NAME`、菜单与关于信息不动。

### 7. 空状态只在「收藏夹」出现

当标签页为 `favorites` 且过滤后没有会话时，用现有列表容器渲染居中提示「暂无收藏的对话」；「全部」为空时维持现状，不额外造提示。

## Risks / Trade-offs

- [保存流程用会话详情反推摘要，可能覆盖收藏] → 收藏同时写 `sessions` 与 `sessionSummaries`；`sameSummary`、`toSessionSummary` 都带上该字段；载入详情时用摘要覆盖同名字段，保证两边一致。
- [旧会话记录没有 `favorite` 字段] → 读取与摘要归一化时按 false 处理，无需迁移。
- [历史导入/导出丢失收藏] → 已明确为非目标；导入后所有会话初始未收藏，界面不残留旧收藏。
- [收藏夹为空时看起来“列表坏了”] → 提供空状态文案；取消最后一个收藏时立即切换为空状态。
- [标签页状态在收起/移动端关闭后丢失] → 与“默认全部”一致，不视为缺陷。
- [品牌名变长挤压收起按钮] → 现有 `appName` 已有 `overflow: hidden` 与省略号，标题区仍可收缩；「DeepSeek Desktop」在 261px 侧边栏内可完整显示。

## Migration Plan

无数据迁移：字段可选、旧记录按未收藏处理。回滚只需撤销代码改动，新字段对旧版本是未知属性，不影响读取。

## Open Questions

无。
