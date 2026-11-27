# Tasks

## 1. 文案与品牌名

- [x] 1.1 在 `src/i18n/zh.ts` 与 `src/i18n/en.ts` 中把 `appName` 改为 `DeepSeek Desktop`，并新增标签页（全部/收藏夹）、收藏菜单（收藏/取消收藏）、轻提示（已收藏/已取消）与收藏夹空状态文案，保持两个语言 key 完全一致；运行 `pnpm type` 确认 key 类型通过
- [x] 1.2 确认展开侧边栏左上角显示「DeepSeek Desktop」、收起状态仍只有按钮组；用 `pnpm build` 后启动页面检查中英文两种语言下文字一致

## 2. 收藏数据模型与持久化

- [x] 2.1 在 `src/services/chat/types.ts` 为 `Session` 增加可选 `favorite`、为 `SessionSummary` 增加必填 `favorite`，让 `toSessionSummary` 归一化缺省值；运行 `pnpm type` 确认所有调用点通过
- [x] 2.2 在 `src/services/chat/store.ts` 的 `sameSummary` 中加入 `favorite` 比较，确保收藏切换能更新列表摘要；运行 `pnpm type` 并检查 `updateSession` 相关逻辑无编译错误
- [x] 2.3 在 `src/services/chat/db.ts` 新增 `setSessionFavorite`，在同一个事务里同步更新 `sessions` 与 `sessionSummaries`，会话缺失时只更新摘要；运行 `pnpm type`
- [x] 2.4 在 `src/services/chat/store.ts` 新增 `setSessionFavorite` action：已载入会话走 `updateSession` + `persist`，未载入会话先更新列表摘要再写库；错误使用现有 `reportStorageError` 记录，运行 `pnpm type` 与 `pnpm lint`

## 3. 会话菜单与收藏反馈

- [x] 3.1 在 `src/components/base/icons.tsx` 增加 16px 星形描边与实心图标，沿用现有 `currentColor` 风格；运行 `pnpm type`
- [x] 3.2 在 `src/components/sider/SessionItem.tsx` 的「重命名」与「删除」之间插入收藏项：按 `session.favorite` 切换文案与图标，点击调用 `setSessionFavorite` 并 `showToast` 一次；运行 `pnpm type` 与 `pnpm lint`
- [x] 3.3 用无头 Chrome 验证收藏/取消收藏后菜单文案、图标、轻提示（「已收藏」/「已取消」）与列表状态同步，截图保存到 `tmp/evidence/`

## 4. 标签页与收藏夹视图

- [x] 4.1 在 `src/components/sider/Sider.tsx` 增加「全部 / 收藏夹」标签页：先按标签页过滤再复用 `groupSessions`，默认「全部」，采用左对齐紧凑胶囊，使用 `role="tablist"`/`role="tab"`/`aria-selected` 与列表 `role="tabpanel"`；运行 `pnpm type`
- [x] 4.2 在 `src/components/sider/Sider.module.css` 增加标签页与空状态样式：桌面 28px 紧凑胶囊、移动端等宽 36px，选中/hover/焦点态与空状态齐全，保证亮色/暗色主题与抽屉布局正常；运行 `pnpm build`
- [x] 4.3 实现「收藏夹」空状态：无收藏时显示「暂无收藏的对话」且不渲染分组标题；用无头 Chrome 截图验证空态与取消最后一个收藏后的即时切换
- [x] 4.4 用无头 Chrome 验证：切换标签页不关闭当前会话、收藏夹只显示收藏项、收藏/取消收藏不改变 `updatedAt` 与列表顺序、收起侧边栏不显示标签页、移动端抽屉显示标签页；截图保存到 `tmp/evidence/`

## 5. 集成验证

- [x] 5.1 运行 `pnpm type`、`pnpm lint`、`pnpm build`，三项全部通过
- [x] 5.2 用无头 Chrome 端到端验证收藏状态在页面刷新后保留、删除已收藏会话后收藏夹不再出现、历史导入/清空后收藏重置
- [x] 5.3 截取桌面展开态（全部/收藏夹/空态/菜单/轻提示）与移动端抽屉的关键状态截图，确认视觉与现有侧边栏风格一致，证据放在 `tmp/evidence/`

## Workflow follow-up

- 实现完成并通过用户验收后，使用 `openspec-archive-change` 归档本变更并同步 `sidebar-navigation` 主规格。
