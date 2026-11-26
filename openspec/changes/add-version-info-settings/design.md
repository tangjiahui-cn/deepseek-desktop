# Design

## Context

设置弹窗由 `src/components/settings/SettingsDialog.tsx` 渲染，分组类型在 `settingsDialogState.ts`（`general | personalization | memory | data | version`），左侧 tabs 在 `sections` 数组中定义。版本与更新相关现状：

- `HtmlRspackPlugin` 在构建时写入 `<meta name="application-version" content="...">`，Web 与桌面端都有。
- 桌面端 `window.desktop` 暴露 `platform`、`versions`（Electron / Chromium / Node）与 `update` 桥接；Web 构建没有该对象。
- `App` 挂载时调用 `initDesktopUpdates`，把主进程状态写入 `useDesktopUpdate`；服务层已有 `checkDesktopUpdate`、`downloadDesktopUpdate`、`openDesktopRelease`。
- 主进程的手动检查会重置 dismissed、显示 toast（无更新/失败/开发模式提示），开发模式直接返回且不发起请求。

项目没有测试框架，验证依赖 `pnpm type`、`pnpm lint`、`pnpm build` 与无头浏览器检查。

需求见 `specs/version-info/spec.md` 与 `specs/desktop-updates/spec.md`，动机见 `proposal.md`。

## Goals / Non-Goals

**Goals:**

- 设置左侧 tabs 末尾新增「版本信息」，展示应用版本、平台与桌面运行时版本。
- 进入分组时自动查询一次新版本，结果显示为「已是最新」或「发现新版本 vX」，失败可刷新。
- 更新区域采用行内式布局，按钮只有「刷新 / 查询中 / 更新」三种状态。
- Web 端展示版本信息、禁用刷新并说明原因。
- 复用现有更新状态、动作与确认流程，不新增轮询或自动下载/安装。

**Non-Goals:**

- 不显示 changelog / 发布说明，不增加构建提交号或构建时间。
- 不在版本分组内显示下载进度条、取消下载或安装；这些继续由侧栏更新提示承接。
- 不改变启动自动检查、下载确认、安装确认与平台差异策略。
- 不新增持久化数据。

## Decisions

### 1. 新分组与组件

`SettingsSection` 增加 `'version'`；`sections` 数组末尾追加 `{ value: 'version', label: 'settingDialogAsideVersionOptionLabel', icon: <IconInfoOutline16 /> }`，并新增 16×16 信息图标。分组内容拆到 `src/components/settings/VersionField.tsx`，采用行内式布局，沿用现有设置样式（`versionRow`、`label`、`description`）。理由：`SettingsDialog` 已经较大，版本信息有独立的更新状态逻辑，单独组件便于测试与复用。

### 2. 版本与运行环境来源

- 应用版本：桌面端优先读 `useDesktopUpdate` 的 `currentVersion`，状态未就绪或 Web 版读 `meta[name="application-version"]`；都缺失时显示「未知」。
- 平台：`desktopApi()?.platform` 映射为 macOS / Windows / Linux；无桌面桥接时显示「Web」。
- 运行时：仅在桌面端显示 Electron / Chromium / Node 三行，来源 `desktopApi().versions`；Web 不显示运行时行。

理由：meta 在 Web 与桌面构建中都存在，桌面桥接能提供与更新状态一致的版本；两层回退避免空白。

### 3. 进入分组时自动查询

- `VersionField` 每次挂载时触发一次查询；停留在分组内不重复，离开后再次进入会重新挂载并再查一次。
- 进入时若 `phase` 已是 `downloading`、`downloaded` 或 `installing`，跳过自动查询，直接展示当前状态，避免打断进行中的更新。
- 查询复用 `checkDesktopUpdate`。由于桥接没有独立的非手动检查入口，进入分组的查询按手动检查处理（会重置 dismissed）。
- 检查阶段通过 `useDesktopUpdate.subscribe` 观察：IPC 可能在检查结束后才返回，不能只看返回后的状态。观察到 `checking` 后再回到 `idle` 才显示「已是最新」；开发模式不进入 `checking`，保持未查询状态并沿用现有 toast。
- 使用 ref 防止同一次挂载内重复触发。

### 4. 三态按钮与状态文字

版本列表下方是一行：左侧「检查更新」+ 状态文字（12px 次要色），右侧一个小号描边按钮。按钮只有三种文案：

| 条件 | 按钮 | 可点击 |
|---|---|---|
| Web 版 | 刷新 | 否 |
| 本地 `checking` 或 `phase === 'checking'` | 查询中 | 否 |
| `phase === 'available'` | 更新 | 是 |
| `phase` 为 `downloading` / `downloaded` / `installing` | 更新 | 否 |
| 其余（初始、`idle`、`error`、已是最新） | 刷新 | 是 |

状态文字：

- 查询中：`versionUpdateChecking`（正在查询…）
- 已是最新：`versionUpdateLatest`
- 发现新版本：`versionUpdateAvailable`（含版本号）
- 失败：`versionUpdateFailed`
- 下载中：`versionUpdateDownloading`（含进度）
- 已下载：`versionUpdateDownloaded`
- 安装中：`versionUpdateInstalling`
- Web：`versionUpdateWebDisabled`
- 初始/开发模式：不显示状态文字

### 5. 更新动作

- `available` 且 `canDownload`（Windows / Linux AppImage）：点击「更新」调用 `downloadDesktopUpdate()`；状态转 `downloading` 后显示进度，按钮保持「更新」并禁用。
- `available` 且 `!canDownload`（macOS / Linux deb）：点击「更新」调用 `openDesktopRelease()` 打开发布页。
- `downloaded`：显示「已下载，请在侧栏完成安装」，分组内不提供安装按钮，保持现有安装确认与收尾逻辑唯一。

### 6. Web 与开发模式

- Web：`desktopApi()` 为 null，按钮禁用并显示「刷新」，状态说明「自动更新仅桌面版可用」；不调用任何更新服务。
- 未打包开发模式：自动查询会触发主进程「开发模式不检查更新」toast；不进入 `checking`，状态文字保持为空，按钮为「刷新」。

### 7. 文案与样式

新增/调整中英文 key：分组名、版本/平台/运行时标签、检查更新、刷新、查询中、更新、已是最新、发现新版本、下载中、已下载、安装中、失败、仅桌面说明、未知。图标加在 `src/components/base/icons.tsx`；行内布局用 `versionInfo`/`versionRow` 与新的 `versionAction` 行样式。窄屏沿用设置弹窗现有滚动布局。

### 8. 验证方式

- `pnpm type`、`pnpm lint`、`pnpm build`。
- 无头浏览器注入假的 `window.desktop`：进入分组自动查询 → 查询中 → 已是最新；再次进入重新查询；发现新版本 → 按钮变「更新」；失败 → 按钮回「刷新」；下载中/已下载按钮禁用且文案保持「更新」；Web 禁用「刷新」且无请求。
- 校验 `dist/index.html` 中存在 `application-version` meta。

## Risks / Trade-offs

- **每次进入分组都查询**：增加一次额外的更新检查调用。→ 只在进入时查询一次，停留不重复；进行中的下载/已下载状态跳过查询。
- **手动检查语义**：进入分组会重置 dismissed，可能让侧栏更新提示重新出现。→ 仅在用户主动打开版本信息时发生，可接受并在设计中记录。
- **IPC 返回晚于状态变化**：只看返回值会把「已是最新」误判为未检查。→ 订阅 `checking` 阶段后再判断。
- **按钮常驻仍可能抢注意力**：采用行内布局，按钮为小号描边，状态文字用次要色，且只在有结果时出现。
- **meta 版本与 `app.getVersion()` 不一致**：桌面端优先用更新状态里的 `currentVersion`，Web 用 meta。
- **更新状态未初始化**：版本仍可从 meta 读取，按钮可点击；`initDesktopUpdates` 在 App 挂载时已启动。

## Migration Plan

无数据迁移。新增分组与文案随版本发布；旧版本忽略新增代码，不影响设置存储。

## Open Questions

无。
