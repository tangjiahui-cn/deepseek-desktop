# Design

## Context

应用是一个自包含的静态 SPA：React 渲染、rspack 构建到 `dist/`、直接请求公开 API、数据存在 localStorage 与 IndexedDB。它没有后端、没有原生模块、也没有路由，这些约束让 Electron 封装可以保持 renderer 几乎零改动。参见 `proposal.md`。

关键事实：

- 公开 API 实测会对任意 `Origin`（包括 `app://...` 与 `null`）回显 CORS 头，因此不需要在主进程做 API 代理。
- 现有构建使用 `publicPath: 'auto'`，不依赖绝对路径，适合非 http 加载。
- 数据格式（IndexedDB v11、ZIP 导入导出）不需要改变，桌面端只是一个新的存储 origin。
- 仓库当前没有 tag / Release，发布链路从零建立；Pages 站点尚未上线，没有存量 Web 用户需要迁移。

## Goals / Non-Goals

**Goals:**

- 用最小改动把现有 renderer 装进 Electron，并保持 Web 构建与桌面构建共用同一份 `src/`。
- 固定一个长期稳定的应用 origin，保证本地数据跨版本、跨平台成立。
- 一次 tag 推送产出三端安装包与更新元数据，发布过程可重跑、可审计。
- 更新行为按平台能力降级，而不是假装三端一致。

**Non-Goals:**

- 不改造 renderer 的数据层，不迁移 IndexedDB schema，不引入 API 代理。
- 不做自定义无边框标题栏、系统托盘、全局快捷键、开机自启。
- 不接入 App Store / Microsoft Store，不做增量差分更新服务。
- 不在本次加入签名与公证，只在配置层预留开关。
- 不覆盖 iOS / Android。

## Decisions

### 1. Electron + 现有 rspack，不引入 electron-vite

renderer 继续用 `rspack.config.ts` 构建，主进程与 preload 用 esbuild 单独打成 CJS。`electron-vite` 会引入第二套构建约定，且它默认接管 renderer，和现有 rspack 配置冲突。

- 备选：electron-vite（构建统一但需要迁移 renderer 配置）、Tauri（体积小，但 WebView 差异与麦克风/音频行为需要重新验证）、纯 PWA（拿不到安装包与自动更新）。
- 主进程/preload 输出 `.cjs`：sandboxed preload 不支持 ESM；CJS 也避开 `"type": "module"` 下的打包边界问题。`electron` 始终标记为 external。

### 2. 用 `app://` 自定义协议提供固定 origin

`protocol.registerSchemesAsPrivileged` 在 app ready 之前注册 `app` 为 `standard + secure + supportFetchAPI + corsEnabled + stream`，再用 `protocol.handle` 从 `dist/` 读文件。origin 固定为 `app://deepseek`。

理由：

- `file://` 页面的 web storage 行为特殊，且所有 file 页面共享存储，不适合承载聊天记录。
- 本地 HTTP server 会引入端口冲突，端口变化等于换 origin，用户的会话会「消失」。
- `secure: true` 同时满足 `getUserMedia`、`crypto.subtle`、剪贴板等安全上下文要求。

实现要点：路径必须解析到 `dist/` 内并拒绝 `..` 穿越；未命中的路径回退到 `index.html`（当前没有路由，回退只为容错）；响应带正确 MIME 类型。origin 常量集中在一处，禁止在其他地方硬编码。

**这是不可逆决定**：一旦发版，origin 不能再变；文档与代码注释都要标明。

### 3. 目录与构建产物

```
electron/
  main.ts        应用生命周期、单实例、窗口创建
  protocol.ts    app:// 注册与静态文件服务
  windowState.ts 窗口尺寸/位置持久化与可见性校验
  security.ts    CSP、权限、导航、window.open 策略
  menu.ts        应用菜单（含 macOS 编辑菜单）
  updater.ts     更新检查与平台分支
  preload.ts     contextBridge 暴露最小 API（版本、平台、更新状态）
scripts/
  dev.mjs        启动 rspack dev server + electron
build/
  icon.png       1024x1024 占位图标
  entitlements.mac.plist
electron-builder.config.cjs
```

- 主进程构建到 `electron/dist/main.cjs`、`electron/dist/preload.cjs`。
- `pnpm dev`：并行启动 `rspack serve`，等 8090 端口可用后以 `ELECTRON_RENDERER_URL=http://localhost:8090` 启动 Electron；主进程改动通过 watch 重建 + 重启（开发期可接受手动重启）。
- 开发模式加载 dev server，因此开发与正式包使用不同 origin；这是可接受的，但意味着开发数据不会带进正式包。正式包的存储只由正式的 `app://` origin 产生。

### 4. 窗口状态与开发数据隔离

窗口默认 1200×800，最小 960×640；关闭时把尺寸、位置写入 `userData/window-state.json`，启动时用 `screen.getAllDisplays()` 校验，落在屏幕外则回退到居中默认尺寸。

未打包时把 `userData` 指到 `.../DeepSeek Desktop (dev)`，避免开发数据污染正式安装。`productName` 决定正式目录名，发版后不再修改。

### 5. 安全基线

- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`、`webSecurity: true`。
- 生产模式通过 `onHeadersReceived` 注入 CSP：脚本仅允许应用自身，样式允许 inline（KaTeX/Mermaid 需要），图片允许 `data: blob: https:`，连接仅允许 API origin，媒体允许 `blob:`，禁止 `object-src`。CSP 中的 API origin 从构建期注入值生成，避免手写漂移。
- 权限：只对 `app://deepseek` 的 `media` 请求放行；其余权限一律拒绝。macOS 在请求前调用 `systemPreferences.askForMediaAccess('microphone')`。
- `setWindowOpenHandler`：
  - `http/https` → `shell.openExternal`，拒绝；
  - `blob:` → 允许创建隔离预览窗口（见下）；
  - 其他 → 拒绝。
- `will-navigate`：只允许 `app://deepseek` 内的导航，其余阻止；`will-attach-webview` 一律阻止。
- 预览窗口：`sandbox: true`、`contextIsolation: true`、无 preload、禁用新窗口与外部导航；只用于显示 blob 附件，不暴露应用 API。
- 外链与预览都放在主进程统一处理，renderer 里的 `target="_blank"` 与 `window.open` 不需要改。

**备选**：附件预览改为「写临时文件 + `shell.openPath`」，更贴近系统习惯，但会留下临时文件且预览体验与 Web 不一致；先用隔离窗口，若 blob 窗口在跨平台验证中不稳定，再降级为临时文件方案。

### 6. 下载走系统保存对话框

在 `session.defaultSession` 上监听 `will-download`，弹 `dialog.showSaveDialog`，默认目录为「下载」并带上原文件名；用户取消则 `item.cancel()`。这样历史导出 ZIP 和附件下载都能落到用户选择的位置，而不必改 renderer 里的 `<a download>`。

**备选**：静默存到「下载」目录（无打扰但用户不知道文件在哪）、renderer 改走 IPC 保存（需要改 UI 代码且 Web/桌面分叉）。选择主进程拦截以保持 renderer 单一实现。

### 7. 更新模型：显式下载 + 显式安装

使用 `electron-updater` + GitHub provider，但关闭自动下载与自动安装：`autoDownload = false`、`autoInstallOnAppQuit = false`、`allowPrerelease = false`、`allowDowngrade = false`。更新状态机由主进程持有，通过 preload 推给 renderer 展示：

```
idle -> checking -> available -> downloading -> downloaded -> installing
                       |             |              |
                   dismissed     cancelled        failed
```

| 平台 | 更新动作 | 下载 | 安装 |
| --- | --- | --- | --- |
| Windows | 应用内标签 | 应用内 | 应用内，重启生效 |
| Linux AppImage | 应用内标签 | 应用内 | 应用内，重启生效 |
| Linux deb | 打开下载页 | 否 | 否（避免 sudo/pkexec 密码窗） |
| macOS | 打开下载页 | 否 | 否（未签名不能自装） |

实现要点：

- 只在 `app.isPackaged` 时检查；启动完成首屏后延迟约 10 秒检查一次，菜单另提供「检查更新」。
- 提示是应用内可关闭标签，放在侧栏设置入口附近；侧栏收起时在设置图标上显示圆点。关闭状态按版本记录在主进程 userData（`dismissedUpdateVersion`），出现更高版本会重新提示，手动检查会清除当前版本的 dismiss。系统通知只作为补充：窗口未聚焦且下载完成时发一条。
- 下载调用 `downloadUpdate(cancellationToken)`，进度通过 `download-progress` 事件转发到标签；取消时 `token.cancel()` 并清理 pending 半包。
- 安装前握手：主进程向 renderer 发 `update:prepare`，renderer 停止生成中的回复、停止朗读、等待持久化后回 ack，主进程再调用 `quitAndInstall`；设 2 秒超时兜底。若正在生成回复，renderer 先弹确认。
- `before-quit` 按状态拦截：下载中取消 token 后放行；已下载但未安装时弹原生对话框「安装并退出 / 直接退出 / 取消」；安装流程已启动时不再拦截。
- 安装标记：调用 `quitAndInstall` 前写 `installing-update` 标记。启动时若标记存在且版本未变，提示上次更新未完成并允许重新下载；版本已变则静默清除。
- 启动时清理 pending 目录中的陈旧半包，避免上次强杀留下不可用文件。
- Windows 在 ready 前设置 AppUserModelID，否则通知与任务栏归组可能异常。
- macOS 的更新动作打开 `https://github.com/<owner>/<repo>/releases/tag/v<version>`；仓库地址来自打包配置注入的常量，不散落在代码里。将来签名就绪后只需把 macOS 切回应用内下载/安装，状态机不变。

**备选**：`update-electron-app`（Squirrel）无法做到「用户点了才下载、点了才安装」，且 macOS 强制走 Squirrel.Mac 自动安装；选 electron-updater。

### 8. electron-builder 配置用 JS 文件

`electron-builder.config.cjs` 而不是 YAML，因为签名/公证需要按环境变量条件化：有 `CSC_LINK` 才签名，有 `APPLE_ID`/`APPLE_TEAM_ID`/`APPLE_APP_SPECIFIC_PASSWORD` 才 `notarize`。YAML 表达不了这种条件。

打包规格：

| 平台 | target | 架构 | 备注 |
| --- | --- | --- | --- |
| macOS | dmg + zip | x64、arm64 | 同一次调用构建两个架构；zip 是未来自动更新的必需产物 |
| Windows | NSIS | x64 | 可选安装目录，非 per-machine |
| Linux | AppImage + deb | x64 | AppImage 在应用内更新，deb 跳下载页 |

- `productName: DeepSeek Desktop`，`appId: com.tangjiahui.deepseekdesktop`，输出目录 `release/`。
- `files` 只包含 `dist/**`、`electron/dist/**`、`package.json`、`LICENSE`；`asar: true`。
- 产物命名统一为 `deepseek-desktop-<version>-<os>-<arch>.<ext>`，避免产品名里的空格进入 URL 与更新元数据。
- macOS `extendInfo.NSMicrophoneUsageDescription` 与 entitlements 中的 `device.audio-input` 必须项；hardened runtime 打开以便未来公证。
- 图标先放占位 `build/icon.png`，electron-builder 自动派生 icns/ico。

### 9. 发布流水线：矩阵构建 + 集中发布

```
tag v* / workflow_dispatch(tag)
        │
        ├─ build (matrix)
        │    macos-latest    --mac --x64 --arm64
        │    windows-latest  --win --x64
        │    ubuntu-latest   --linux --x64
        │    每个 job：type -> lint -> renderer build -> main build
        │             -> electron-builder --publish never
        │             -> upload-artifact release/（含 latest*.yml）
        v
   release (ubuntu)
        校验 tag == package.json version
        下载全部 artifact
        断言 latest*.yml 存在且覆盖对应架构
        gh release create（已存在则 upload --clobber，保持发布态）
```

- **每 OS 一个 job、job 内多架构**：拆成每架构一个 job 会让多个 `latest*.yml` 互相覆盖（[electron-builder#5592](https://github.com/electron-userland/electron-builder/issues/5592)）。
- **集中上传而不是 `--publish always`**：三个 job 同时创建同一个 Release 会竞态；集中到 release job 可幂等重跑。
- 任一构建失败则 release job 不执行，避免半套资产被客户端读到。
- `workflow_dispatch` 接受 tag 输入并 checkout 该 ref，用于重发；同一 tag 重跑走 `--clobber`。
- 权限 `contents: write`；actions 按现有 `pages.yml` 的风格固定到 commit SHA。
- 版本校验在 build 之前做一次、release 之前再做一次，防止 tag 与构建产物版本错位。

**待验证**：`--publish never` 是否仍生成 `latest*.yml`。配置了 `publish` 时通常会生成；实现阶段先在本地完整打一次包确认。若不生成，回退方案是 build job 用 `--publish never` 但显式调用 `electron-builder` 的 update-info 生成，或改为 `--publish always` 指向 draft release，再由 release job 发布。

### 10. 保留 Web 发布，双 workflow 分离

`pages.yml` 保持只响应 `main`，新增的 `release.yml` 只响应 tag / 手动触发。桌面构建不修改 `dist/` 的产物语义，Web 仍可直接部署或下载。

### 11. 版本与发布流程

`package.json` 是版本唯一来源；发版流程为：改版本 → 提交 → 打 `vX.Y.Z` tag → 推送 tag。CI 校验 tag 与 `package.json` 一致。发布说明由 GitHub 自动生成，并在 Release 标题中带上版本号。

## Risks / Trade-offs

- **[未签名 macOS 安装体验差]** → README 明确写「系统设置 → 隐私与安全性 → 仍要打开」与 `xattr` 兜底；签名作为 secrets 开关，证书到位后无需改代码。
- **[Windows SmartScreen / 杀软误报]** → 首版接受；后续用代码签名证书缓解。
- **[`app://` origin 被误改导致数据「消失」]** → origin 常量集中、注释标红、spec 明确要求固定；上线后不再调整。
- **[`--publish never` 不生成 `latest*.yml`]** → 实现第一步本地验证；准备 `--publish always` + draft 的回退方案。
- **[多架构更新元数据被覆盖]** → 同 OS 同 job 内一次构建多架构；release 前断言 yml 覆盖所需架构。
- **[blob 预览窗口在部分平台行为不一致]** → 冒烟测试覆盖；不稳定则降级为临时文件 + 系统打开。
- **[用户长期忽略更新提示]** → 侧栏圆点 + 菜单入口；关闭只对当前版本生效，出现更高版本会重新提示。
- **[下载中断或强杀留下半包]** → 取消时清理；启动时扫描 pending 目录并删除陈旧文件，状态回到 available。
- **[安装中用户再次启动应用]** → 写 `installing-update` 标记，启动时检测并提示，避免与安装程序抢文件。
- **[安装前握手超时]** → renderer 在 2 秒内未 ack 时仍继续安装，但先停止流与朗读；不因 UI 卡住而无法更新。
- **[保存对话框每次下载都弹，可能打扰]** → 桌面端首次可用；若反馈强烈，再加「记住位置」。
- **[无自动化 E2E]** → 维护一份手工冒烟清单：冷启动、重启后会话仍在、流式回复、停止生成、上传/预览、语音输入与拒绝权限、朗读、导出 ZIP、外部链接、更新标签/关闭/下载/取消/退出/安装（仅打包版）。
- **[GitHub macOS runner 成本与时长]** → 只在 tag 发布时跑，日常 PR 不做三端打包。

## Migration Plan

1. **Spike（先验证再铺代码）**：最小 Electron 壳 + `app://` 加载现有 `dist/`，验证 IndexedDB 写入跨重启存在、`getUserMedia` 可用、blob 预览窗口可打开；本地打一次未签名 mac 包确认能启动；本地 `--publish never` 确认生成 `latest.yml`。
2. **外壳**：主进程、窗口状态、安全策略、菜单、preload、开发启动脚本。
3. **打包**：electron-builder 配置、图标、entitlements、三端本地打包。
4. **更新**：显式下载/安装状态机、应用内标签、退出拦截与安装标记。
5. **CI**：`release.yml`、版本校验、集中发布；在测试 tag 上跑通。
6. **文档**：README 安装说明、macOS 未签名提示、开发命令、发版流程。

回滚：

- 桌面发布可整体停用（移除 `release.yml` 的 tag 触发），Web 完全不受影响。
- 已发布版本可通过 GitHub Release 撤回资产，但已安装客户端不会降级；必要时发一个修复版本。
- 一旦 `app://` 版本发出去，不能退回 `file://`，否则桌面端本地数据不可见，只能通过 ZIP 导入导出搬运。

## Open Questions

- 图标视觉：先用占位图标打通打包，正式图标后续替换，不影响架构。
- Apple Developer 账号与 Windows 证书的到位时间：只影响 secrets 与 `notarize` 开关，不阻塞首版。
- 是否需要 beta 更新通道：当前只读取稳定 Release，后续如需再加 channel，不影响现有 spec。
