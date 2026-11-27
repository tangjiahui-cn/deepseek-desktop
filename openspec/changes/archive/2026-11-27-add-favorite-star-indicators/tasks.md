# Tasks

## 1. 星标颜色与图标

- [x] 1.1 在 `src/app/theme.css` 增加 `--dsw-specific-favorite-star: rgb(204, 140, 39)`（亮色/暗色共用）；运行 `pnpm type`
- [x] 1.2 在 `src/components/base/icons.tsx` 增加 16px 虚线星标 `IconStarDashed16`，沿用 currentColor；运行 `pnpm type`

## 2. 侧边栏内联星标与菜单图标

- [x] 2.1 在 `src/components/sider/SessionItem.tsx` 为已收藏会话在标题前渲染 12px 实心星标，未收藏不渲染；菜单收藏项统一改用无色空心星标；运行 `pnpm type` 与 `pnpm lint`
- [x] 2.2 在 `src/components/sider/SessionItem.module.css` 增加内联星标样式（12px、`--dsw-specific-favorite-star`、4px 间距），确认未收藏行标题起点不变；运行 `pnpm build`

## 3. 会话标题栏收藏切换

- [x] 3.1 在 `src/components/session/SessionView.tsx` 的桌面标题栏加入 16px 星标按钮，标题与图标视觉间距 32px，点击调用 `setSessionFavorite` 并 `showToast`；运行 `pnpm type` 与 `pnpm lint`
- [x] 3.2 在 `src/components/session/SessionView.module.css` 增加标题栏星标布局、hover 与 `focus-visible` 样式，保证长标题/收起侧边栏时星标可见；运行 `pnpm build`

## 4. 验证与证据

- [x] 4.1 运行 `pnpm type`、`pnpm lint`、`pnpm build`，三项全部通过
- [x] 4.2 用无头 Chrome 验证：侧边栏收藏行出现星标、未收藏行无空槽、「全部/收藏夹」一致、取消收藏后星标消失；截图保存到 `tmp/evidence/final-stars/`
- [x] 4.3 用无头 Chrome 验证标题栏星标：已收藏实心/未收藏虚线、32px 间距、点击收藏/取消弹出提示并与侧边栏同步、刷新后保持；截图保存
- [x] 4.4 截图验证菜单收藏项在两种状态下都是无色空心星标，且菜单顺序仍为「重命名/收藏（取消收藏）/删除」
- [x] 4.5 截取暗色、亮色与移动端抽屉关键状态，确认视觉与侧边栏风格一致，证据放在 `tmp/evidence/final-stars/`

## Workflow follow-up

- 实现完成并通过用户验收后，使用 `openspec-archive-change` 归档本变更并同步 `sidebar-navigation` 主规格。
