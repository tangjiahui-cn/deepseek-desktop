# Design

## Context

0.4.0 已实现会话收藏：`SessionSummary.favorite` 与 `Session.favorite` 随 IndexedDB 读写，`setSessionFavorite` 负责更新；侧边栏 `SessionItem` 的「更多」菜单已有收藏/取消收藏项；会话页桌面标题栏由 `SessionView` 渲染，移动端使用 `MobileHeader`。现有菜单星标使用实心/描边并继承文字色。

## Goals / Non-Goals

**Goals:**

- 收藏记录在侧边栏可见，且不引入空槽或与选中高亮冲突的标记。
- 当前会话可以在标题栏直接收藏/取消，反馈与其它入口一致。
- 菜单里的收藏项只表达“操作”，不表达“状态”。

**Non-Goals:**

- 不在移动端顶栏增加标题星标；不增加底部、行尾或固定栏星标。
- 不增加收藏数量、排序或其它收藏管理能力。

## Decisions

### 1. 侧边栏使用标题前内联星标，不预留槽位

已收藏会话在标题前渲染 12px `IconStarFill16`（CSS 缩放到 12px），颜色使用新 token `--dsw-specific-favorite-star: #CC8C27`；未收藏会话不渲染该节点，也不为它设置占位。标题仍是 flex 的 `flex: 1`，星标 `flex-shrink: 0`，所以收藏行标题右移约 16px，未收藏行不受影响；这正是“突出收藏记录”的预期。

备选：固定星标栏（标题对齐，但未收藏组会出现竖向空槽）和行尾星标（需要额外操作区宽度）都不采用。

### 2. 标题栏星标内联在标题行，32px 视觉间距

`SessionView` 的桌面标题栏改为“标题 + 星标按钮”的 flex 行。标题右内边距改为 0，星标按钮 28px 点击区域、`margin-left: 26px`，图标 16px 居中，所以标题文字到星标图标的视觉间距为 32px。按钮颜色使用同一 token；已收藏渲染 `IconStarFill16`，未收藏渲染新增的 `IconStarDashed16`（`stroke-dasharray` 描边）。

标题保持 `min-width: 0` 与省略号；按钮 `flex-shrink: 0`，长标题或侧边栏收起时星标仍可见。点击调用现有 `setSessionFavorite` 并复用 `showToast` 文案，无需新的 store/DB 逻辑。

移动端 `MobileHeader` 不动，避免压缩标题和新建按钮；收藏仍可通过侧边栏菜单完成。

### 3. 菜单收藏项改用无色空心星标

`SessionItem` 的收藏菜单项无论是否已收藏，都使用 `IconStarOutline16`，图标继承菜单文字色（无色）。不再是已收藏时用实心/彩色星标；菜单项文案仍然切换「收藏」/「取消收藏」。

### 4. 新增一个图标与一个主题 token

- `IconStarDashed16`：16px 星形虚线描边，供标题栏未收藏状态使用。
- `--dsw-specific-favorite-star: rgb(204, 140, 39)`：亮色/暗色共用的收藏星标色 `#CC8C27`，用于侧边栏与标题栏；菜单不使用该 token。

### 5. 可访问性

标题栏星标使用 `aria-label` 与 tooltip（复用「收藏」/「取消收藏」文案）；侧边栏星标是装饰性提示，`aria-hidden`，点击仍由整行打开会话。按钮提供 `focus-visible` 焦点环。

## Risks / Trade-offs

- [收藏行标题右移 16px，列表左边线不完全对齐] → 这是用星标突出收藏记录的预期效果；未收藏行不预留空槽，避免整组无收藏时出现空白列。
- [标题栏星标与菜单收藏项重复] → 标题栏服务当前会话的快速操作，菜单服务任意会话；两者共用 store，状态一致。
- [收起侧边栏时标题出现 149px 左边距，星标位置随标题移动] → 星标跟随标题，仍保持 32px 间距；按钮固定尺寸不会被压缩。
- [亮色主题下 `#CC8C27` 对比度] → 该色在中灰/深灰背景均可辨识，沿用同一值；如需可后续按主题单独调。

## Migration Plan

无数据迁移；仅渲染层与一个主题 token，回滚不影响已有收藏数据。

## Open Questions

无。
