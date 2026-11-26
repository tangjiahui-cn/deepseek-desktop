# Tasks

## 1. 版本信息分组

- [x] 1.1 `settingsDialogState.ts` 的 `SettingsSection` 增加 `'version'`；`SettingsDialog.tsx` 在左侧 tabs 末尾追加「版本信息」，并新增 `VersionField` 展示应用版本、平台与桌面运行时版本，Web 版显示版本与平台 Web，信息缺失显示「未知」。验证：`pnpm type` 通过；无头浏览器注入假的 `window.desktop` 检查桌面端三行运行时，不注入时检查 Web 版只显示版本与平台。
- [x] 1.2 `src/components/base/icons.tsx` 新增 16×16 信息图标；`src/i18n/zh.ts`、`en.ts` 补充分组名、版本/平台/运行时、未知等文案；`Settings.module.css` 补只读信息行样式。验证：`pnpm type` 与 `pnpm lint` 通过；中英文 key 一致；320px 宽度下设置内容无横向溢出。
- [x] 1.3 版本信息改为行内式布局：版本列表下方一行，左侧「检查更新」+ 状态文字，右侧小号描边按钮；按钮文案改为「刷新 / 查询中 / 更新」，移除旧的大按钮块与「重试」文案；补充对应中英文案与样式。验证：`pnpm type`、`pnpm lint` 通过；无头浏览器检查三态按钮文案与行内布局，320px 无横向溢出。

## 2. 自动查询与更新入口

- [x] 2.1 `VersionField` 每次进入分组时自动查询一次：通过 `checkDesktopUpdate()` 触发，订阅 `checking` 阶段判断结果；无更新显示「已是最新版本」，有更新显示「发现新版本 vX」，失败显示失败并让按钮回到「刷新」；查询中按钮显示「查询中」并禁用；停留分组内不重复查询，离开后重新进入会再次查询。验证：无头浏览器用可控 `update.getState`/`onState` 断言挂载即查询一次、停留不新增、重新进入再查询、checking → idle、error 与开发模式不误报最新。
- [x] 2.2 发现新版本时按钮为「更新」：`canDownload` 为真调用 `downloadDesktopUpdate()`，否则调用 `openDesktopRelease()`；`downloading` 显示进度文字，`downloaded` 提示在侧栏完成安装；下载中、已下载、安装中按钮保持「更新」并禁用，分组内不调用安装。验证：无头浏览器统计动作调用次数并断言各状态文案与按钮禁用。
- [x] 2.3 进入分组时若已有 `downloading`/`downloaded`/`installing` 状态，跳过自动查询并直接展示当前状态；启动自动检查、菜单检查与侧栏 `UpdateTag` 保持不变。验证：无头浏览器预置更新状态后进入分组，断言无新增查询调用且当前状态可见。

## 3. 集成验证

- [x] 3.1 运行 `pnpm type`、`pnpm lint`、`pnpm build`，确认通过且 `dist/index.html` 仍包含 `application-version` meta。
- [x] 3.2 无头 Chrome 端到端：进入分组自动查询 → 已是最新 → 重新进入再查 → 发现新版本（可下载/仅发布页）→ 失败后刷新 → 下载中/已下载提示 → Web 禁用且无请求 → 320px 布局。
- [x] 3.3 运行 `openspec validate add-version-info-settings --strict`，确认规格与任务一致。

## Workflow follow-up

- 实现并满足项目评审要求后，使用 `openspec-apply-change` 逐项完成任务。
- 归档使用 `openspec-archive-change`，同步 `version-info` 与 `desktop-updates` 主 spec。
