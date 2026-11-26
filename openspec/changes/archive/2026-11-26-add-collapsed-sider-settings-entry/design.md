# Design

## Context

- 收起状态由 `src/components/sider/CollapsedSider.tsx` 渲染，仅在 `siderCollapsed && !isMobile` 时出现；容器为 `Sider.module.css` 的 `.collapsed`（绝对定位，左上 `12px 0 0 16px`）与 `.collapsedGroup`（`flex`、`gap: 2px`、`height: 40px`、`padding: 0 2px`、胶囊圆角）。
- 按钮统一用 `IconButton`：`size="m"` 为 34×34，`tooltip` 同时作为 `aria-label`。
- 展开侧边栏底部设置入口调用 `openSettings('general')`（`settingsDialogState.ts`），点击后设置弹窗固定选中「通用设置」。
- `SettingsDialog` 在 `App` 顶层渲染，关闭时卸载内容；`SettingsContent` 每次打开都按 store 中的 `section` 初始化，因此默认分组的语义天然成立。
- 展开态标题由 `SessionView.module.css` 的 `.withCollapsedSider { margin-left: 113px }` 避让收起按钮组：内容区 18px 内边距 + 113px 边距 = 131px 起点，与两按钮胶囊右边缘（约 92px）留出约 39px 间隔。

## Goals / Non-Goals

**Goals:**

- 收起按钮组按「打开边栏、设置、新建对话」排列，设置入口与展开侧边栏底部行为一致。
- 设置按钮复用现有组件、图标、文案与样式，不新增 i18n key 或 CSS 类。
- 胶囊变宽后会话标题仍完整可见、不被遮挡。

**Non-Goals:**

- 不重新设计胶囊外观、不改按钮尺寸与间距。
- 不新增设置分组、快捷键或新的设置打开方式。
- 不改变移动端抽屉与展开侧边栏的入口。
- 不调整有更新提示时按钮组的既有布局。

## Decisions

### 1. 设置按钮插在「打开边栏」与「新建对话」之间

`CollapsedSider` 的 `collapsedGroup` 内按「打开边栏 → 设置 → 新建对话」写死顺序；更新按钮仍在 `hasUpdate` 为真时追加到末尾。选择「新建对话左侧、打开边栏右侧」是因为用户确认该位置，且能保持「打开边栏」作为组内第一个图标的位置稳定。备选方案（放在胶囊最左侧、或胶囊外独立按钮）会改变已有按钮位置或引入新的布局容器，未采用。

### 2. 复用 `openSettings('general')`，不新增状态

设置按钮的 `onClick` 直接调用 `openSettings('general')`，与 `Sider.tsx` 底部入口相同。`SettingsContent` 在弹窗打开时挂载并从 store 读取分组，因此无需为收起入口引入额外状态；关闭弹窗后侧边栏的收起状态由既有 `siderCollapsed` 持久化，不受影响。

### 3. 复用 `IconSettingsOutline16` 与 `t('settings')`

图标与设置弹窗导航、侧边栏底部入口一致；tooltip 复用现有 `settings` key，中英文都已存在，`IconButton` 同时把它用作无障碍名称。因此本变更不需要改 `src/i18n/`。

### 4. 胶囊自然变宽，同步调整标题避让

`.collapsedGroup` 是自动宽度：两按钮约 76px（`2×2` padding + `2×34` + 1×2 gap + 2px 边框），三按钮约 112px，左边缘固定在 16px，右边缘从约 92px 移到约 128px。`.withCollapsedSider` 的 `margin-left` 从 `113px` 调整为 `149px`（18px 内边距 + 149px = 167px 起点，与 128px 右边缘保持改动前约 39px 的间隔）。备选方案（按运行时宽度计算动态内边距）需要主内容与绝对定位按钮组共享测量状态，收益不足以抵消复杂度。

### 5. 更新按钮与移动端不变

更新按钮仍由 `hasUpdate` 控制追加在组末尾；移动端使用 `MobileSider` 抽屉，`CollapsedSider` 不会渲染，无需新增分支。有更新提示时胶囊会再宽 36px，标题避让仍按常规三按钮计算：四按钮胶囊右边缘约 162px，标题起点 167px，间隔约 5px（改动前约 3px），两者不重叠但较紧；本次按非目标不为更新状态额外加宽边距。

## Risks / Trade-offs

- **硬编码标题边距与胶囊宽度耦合** → 在任务中量测按钮组右边缘与标题起点，确认间隔约 39px；后续再改按钮组时需同步调整。
- **有更新提示时标题与胶囊的间隔压缩到约 5px（改动前约 3px），看似贴边但不会重叠** → 保持改动前的处理方式，本次不按更新状态再调边距；若后续要统一间距，可改为按按钮组宽度动态避让。
- **悬停提示在窗口顶部被裁切** → 现有两个按钮已使用同样的默认 tooltip 定位，沿用现状，不引入新行为。
- **设置按钮误触打开弹窗打断对话** → 与底部入口行为一致，弹窗可随时关闭且不重置会话，风险可接受。

## Migration Plan

无数据迁移与兼容处理：纯前端渲染变更，随版本发布生效。

## Open Questions

无。
