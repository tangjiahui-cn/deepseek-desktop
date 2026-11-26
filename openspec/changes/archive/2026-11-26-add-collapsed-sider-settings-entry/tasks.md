# Tasks

## 1. 收起状态的设置按钮

- [x] 1.1 在 `src/components/sider/CollapsedSider.tsx` 导入 `IconSettingsOutline16` 与 `openSettings`，在「打开边栏」与「新建对话」之间插入设置按钮：`IconButton`（`size="m"`、`tone="primary"`、`tooltip={t('settings')}`、`onClick={() => openSettings('general')}`），并同步更新按钮组注释；复用现有 `settings` 文案，不新增 i18n key，不改 `Sider.module.css`。验证：`pnpm type` 与 `pnpm lint` 通过；代码中按钮顺序为打开边栏、设置、新建对话，更新按钮仍在末尾。
- [x] 1.2 调整 `src/components/session/SessionView.module.css` 中 `.withCollapsedSider` 的 `margin-left`（约 `149px`），使三按钮胶囊变宽后会话标题仍从按钮组右侧开始，保持改动前约 39px 的间隔。验证：桌面宽度收起侧边栏后测量按钮组右边缘与标题起点；长标题不被胶囊遮挡且仍按省略号截断；`pnpm type` 与 `pnpm lint` 通过。
- [x] 1.3 用 `pnpm dev:web` 在桌面宽度下截图并交互验证：收起侧边栏后按钮组显示三个图标，顺序正确、间距与尺寸不变；悬停设置按钮出现「设置」提示；点击打开设置弹窗且默认选中「通用设置」；关闭弹窗后侧边栏仍为收起状态、当前会话未重置；制造更新状态时更新按钮仍在末尾。截图放 `tmp/evidence/`。

## 2. 回归与集成验证

- [x] 2.1 验证展开/收起往返、桌面端未收起时设置仍只在侧边栏底部、移动端抽屉内设置入口与布局不变；运行 `pnpm build` 通过并在构建产物中复验收起状态按钮组。截图覆盖桌面收起态、设置弹窗打开态与移动端抽屉态，放 `tmp/evidence/`。
- [x] 2.2 运行 `openspec validate add-collapsed-sider-settings-entry --strict`，确认规格、任务与实现一致。

## Workflow follow-up

- 实现并满足项目评审要求后，使用 `openspec-apply-change` 逐项完成任务。
- 归档使用 `openspec-archive-change`，把 `sidebar-navigation` delta 同步进主 spec。
