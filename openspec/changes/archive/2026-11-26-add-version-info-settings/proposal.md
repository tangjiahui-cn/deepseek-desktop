# Proposal

## Why

版本号和「检查更新」目前只藏在系统菜单与侧栏提示里，设置里没有任何版本信息入口：用户想知道当前版本、平台或手动检查更新时，得先找到菜单；Web 版则完全没有入口。需要在设置中提供一处稳定的版本信息与检查更新入口。

## What Changes

- 设置左侧 tabs 末尾新增「版本信息」分组（通用设置、个性化、记忆、数据管理之后），配独立的 16×16 图标。
- 分组内展示应用版本、运行平台；桌面端额外展示 Electron / Chromium / Node 版本。版本取自构建期写入的 `application-version`，平台与运行时取自现有 `window.desktop` 桥接。
- 进入「版本信息」分组时自动查询一次新版本；停留在分组内不重复查询，重新进入会再次查询。查询结果显示为「发现新版本 vX」或「已是最新版本」，失败则显示失败并允许刷新。
- 更新区域采用行内式布局：版本列表下方一行，左侧「检查更新」与状态文字，右侧一个按钮；按钮只有三种状态——「刷新」（默认、已是最新、失败）、「查询中」（查询进行中，loading，禁用）、「更新」（发现新版本）。
- 发现新版本点击「更新」：支持应用内下载的平台走现有下载流程，其余平台打开发布页；下载进度与安装继续由现有侧栏更新提示承接。
- Web 版保留「版本信息」分组和版本展示，但按钮禁用，并说明自动更新仅桌面版可用。
- 不新增更新机制：仍由 `electron-updater`、现有 IPC 与 `desktop-updates` 规范负责检查、下载、安装与失败处理。
- 修改 `desktop-updates` 的检查入口：从「菜单」扩展为「菜单或设置中的版本信息」，并允许进入分组时自动查询一次。
- 非目标：不显示发布说明或 changelog，不增加构建提交号，不增加后台轮询，不改变下载确认、安装确认或平台差异策略。

## Capabilities

### New Capabilities

- `version-info`: 设置中的版本信息分组。负责展示应用版本、平台与桌面运行时版本，并提供桌面端的检查更新入口、就地状态反馈与按平台的更新/下载动作；Web 版只展示信息并禁用检查。

### Modified Capabilities

- `desktop-updates`: 「更新检查」需求中的手动检查入口从菜单扩展为菜单或设置版本信息，复用同一检查流程与「手动检查」语义。

## Impact

- **修改代码**：`src/components/settings/SettingsDialog.tsx`、`settingsDialogState.ts`（新增分组类型与导航项）、`src/components/base/icons.tsx`（新增版本/信息图标）、`src/services/desktop/`（读取版本、平台与更新状态）、`src/i18n/zh.ts`、`src/i18n/en.ts`、`src/components/settings/Settings.module.css`。
- **复用**：`checkDesktopUpdate`、`downloadDesktopUpdate`、`openDesktopRelease`、`useDesktopUpdate` 与现有侧栏 `UpdateTag`。
- **构建**：沿用 `application-version` meta 与 `window.desktop.versions`，不改打包配置。
- **兼容性**：Web 构建下 `window.desktop` 不存在，只展示应用版本与平台 Web；现有菜单「检查更新…」与侧栏提示保持不变。
- **数据**：不新增持久化数据。
