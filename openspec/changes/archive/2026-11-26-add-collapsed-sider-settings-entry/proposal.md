# Proposal

## Why

侧边栏收起后，左上角按钮组只有「打开边栏」和「新建对话」，想改设置必须先展开侧边栏、再到左下角点「设置」，多两步且打断当前操作。收起状态下也需要一个直达设置入口。

## What Changes

- 收起侧边栏左上角按钮组在「打开边栏」与「新建对话」之间新增「设置」图标按钮（16×16 齿轮图标）。
- 点击行为与展开侧边栏底部的「设置」一致：打开设置弹窗并选中「通用设置」分组，侧边栏保持收起。
- 复用现有 `IconButton`（m 号、primary 色调）与已有 tooltip 文案「设置」/「Settings」，胶囊按钮组顺序固定为：打开边栏、设置、新建对话，有更新提示时更新按钮仍在末尾。
- 胶囊宽度随第三个按钮自然增长（约 36px），同步调整收起状态会话标题的左边距，避免变宽的按钮组遮挡标题。
- 移动端不受影响：移动端使用抽屉，收起按钮组只在非移动端的收起状态渲染。
- 非目标：不改变展开侧边栏底部的设置入口与设置弹窗行为，不新增设置分组或文案 key，不重新设计胶囊样式，不改动有更新提示时按钮组的既有布局。

## Capabilities

### New Capabilities

- `sidebar-navigation`: 侧边栏收起与展开时的导航入口。负责收起状态按钮组的组成、顺序与各入口行为（打开边栏、设置、新建对话、更新提示），以及展开侧边栏底部设置入口的一致性。

### Modified Capabilities

- 无。现有 `personalization`、`version-info` 等能力只描述设置弹窗内部行为，本次不改变其需求。

## Impact

- **修改代码**：`src/components/sider/CollapsedSider.tsx` 引入 `IconSettingsOutline16` 与 `openSettings`，在「打开边栏」之后、「新建对话」之前插入设置按钮；`src/components/session/SessionView.module.css` 调整 `.withCollapsedSider` 的标题左边距。
- **复用**：`IconButton`、`Tooltip`、`settingsDialogState.openSettings('general')`、`Sider.module.css` 的 `collapsedGroup` 布局；i18n 复用现有 `settings` key，中英文无需新增。
- **兼容性**：Web 与桌面端行为一致；移动端布局不变；按钮组宽度增加约 36px，收起状态标题左边距随之加大，标题仍完整可见。
- **数据**：不新增持久化数据，不改变设置存储。
