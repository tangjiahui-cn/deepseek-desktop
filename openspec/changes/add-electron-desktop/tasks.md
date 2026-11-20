# Tasks

## 1. Spike 与技术验证

- [x] 1.1 搭一个最小 Electron 壳加载现有 `dist/`，用 `app://deepseek` 自定义协议提供页面；在 DevTools Application 面板确认 origin 为 `app://deepseek`，写入 localStorage 与 IndexedDB 后重启仍存在
- [x] 1.2 在 `app://deepseek` 页面验证安全上下文能力：`getUserMedia({audio:true})` 能拿到音轨、`AudioContext` 能播放、`navigator.clipboard` 可用；记录失败项与原因
- [x] 1.3 验证附件 blob 预览：点击 PDF 与图片附件时能打开独立窗口，窗口内 `window.desktop`、`require`、`process` 均不可用
- [ ] 1.4 用 `electron-builder --mac --arm64 --dir` 打出未签名 `.app`，从 Finder 启动确认能运行，记录 macOS Gatekeeper 的实际提示与放行路径
- [x] 1.5 本地完整打包一次后确认 `release/` 中存在 `latest-mac.yml`；若 `--publish never` 下缺失，按 design.md 第 9 条的回退方案调整并在任务备注中记录结论

## 2. 依赖与构建骨架

- [x] 2.1 添加 `electron`、`electron-builder`、`electron-updater`、`esbuild` 开发依赖；运行 `pnpm install` 后 `pnpm exec electron --version` 与 `pnpm exec electron-builder --version` 均可输出版本
- [x] 2.2 在 `package.json` 增加 `productName: DeepSeek Desktop`、`packageManager` 字段（与 CI 使用的 pnpm 版本一致），补齐 `build:electron`、`build:desktop`、`dist:mac`、`dist:win`、`dist:linux` 脚本；运行 `pnpm run` 可见全部脚本
- [x] 2.3 新增 `tsconfig.electron.json`（Node 环境、noEmit），并让 `pnpm type` 同时检查 renderer 与 electron 代码；运行 `pnpm type` 通过
- [x] 2.4 新增 esbuild 构建脚本，把 `electron/main.ts`、`electron/preload.ts` 打到 `electron/dist/main.cjs` 与 `electron/dist/preload.cjs`（`electron` external）；运行 `pnpm build:electron` 后两个文件存在且能被 Node 解析
- [ ] 2.5 新增 `scripts/dev.mjs`：启动 `rspack serve`，等 8090 可用后设置 `ELECTRON_RENDERER_URL` 启动 Electron，退出时清理子进程；运行 `pnpm dev` 能打开窗口并加载开发服务器页面
- [x] 2.6 更新 `.gitignore`，忽略 `electron/dist/`、`release/`、`*.blockmap`；`git status` 中不出现构建产物，并运行 `pnpm build:electron` 与 renderer 构建确认均不破坏仓库状态
- [x] 2.7 在 README 的 Development 表格中补充新脚本（`build:electron`、`build:desktop`、`dist:*`、`dev` 的新行为），按文档原样执行每条命令均成功

## 3. Electron 外壳

- [x] 3.1 实现主进程生命周期（ready、activate、window-all-closed）与单实例锁；启动应用后再执行一次启动命令，确认只聚焦已有窗口
- [x] 3.2 实现 `app://` 协议：注册为 standard/secure/supportFetchAPI/corsEnabled，服务 `dist/` 静态文件并拒绝路径穿越；DevTools 中访问 `app://deepseek/../package.json` 被拒绝，正常资源与刷新均可用
- [ ] 3.3 实现窗口尺寸/位置持久化与屏幕可见性校验；调整窗口后重启恢复位置，手动把 `window-state.json` 改到屏幕外坐标后重启，窗口仍出现在可见区域
- [x] 3.4 实现 sandboxed preload，用 `contextBridge` 只暴露版本、平台、更新状态等只读字段；DevTools 中 `window.desktop` 字段符合预期，`require`、`process` 为 undefined
- [ ] 3.5 实现应用菜单：macOS 含编辑菜单（撤销、复制、粘贴、全选），所有平台含退出、最小化、缩放、关于、检查更新；macOS 上 Cmd+C/V/A 在输入框生效
- [x] 3.6 实现安全策略：CSP、权限白名单（仅 `app://deepseek` 的 media）、`will-navigate` 限制、`will-attach-webview` 阻止、`setWindowOpenHandler` 策略；DevTools console 无 CSP 报错，尝试导航到外部地址被阻止
- [ ] 3.7 开发模式把 userData 指向独立目录；分别运行开发模式与打包版，确认数据目录分别为 `DeepSeek Desktop (dev)` 与 `DeepSeek Desktop`，互不读取对方会话

## 4. 桌面能力适配

- [ ] 4.1 实现 http/https 外链统一交给 `shell.openExternal`，其他协议拒绝；点击 Markdown 链接与来源链接后浏览器打开、应用窗口 URL 不变，`javascript:` 链接无反应
- [x] 4.2 实现附件预览子窗口（无 preload、sandbox、禁止新窗口与外部导航）；预览图片与 PDF 正常显示，窗口内无法调用应用 API
- [ ] 4.3 实现 `will-download` + 系统保存对话框，默认文件名与目录正确，取消不落盘；分别验证历史导出与附件下载，导出的 ZIP 能重新导入
- [ ] 4.4 实现麦克风权限链：主进程权限处理、macOS `askForMediaAccess`、`Info.plist` 用途说明、entitlements 音频输入；首次录音弹系统授权，允许后可录音，拒绝后提示且界面可用
- [ ] 4.5 在有内容的长会话中检查桌面布局：窗口最小尺寸下侧栏/输入框/代码块/公式正常，滚动与拖拽上传文件均可用，拖入文件不会导致页面跳转
- [ ] 4.6 验证桌面端数据闭环：创建多会话、上传附件、导入导出历史、删除全部会话后重启，IndexedDB 与 localStorage 行为与 Web 版一致
- [ ] 4.7 在 README 的数据与存储章节说明桌面端存储位置、桌面与 Web 数据相互隔离、跨端搬运使用 ZIP 导入导出；按文档描述能定位到实际数据目录

## 5. 显式更新

- [ ] 5.1 实现主进程 updater 状态机：仅在 `app.isPackaged` 检查，关闭 `autoDownload` 与 `autoInstallOnAppQuit`，只接受稳定版本，GitHub 仓库地址来自打包期注入常量；开发模式运行确认不发请求，状态日志按 idle/checking/available 变化
- [ ] 5.2 实现启动后延迟检查与菜单手动检查，无更新、网络失败时都有明确反馈；断网状态下手动检查，应用不崩溃且提示失败
- [ ] 5.3 通过 preload 暴露更新状态与操作，实现应用内可关闭标签（版本号、下载/重启安装、进度、取消）；标签出现在侧栏设置入口附近，收起侧栏时设置图标显示圆点，聊天界面不被遮挡
- [ ] 5.4 实现按版本记录关闭状态（主进程 userData）：关闭后当前版本不再提示，重启仍不提示，出现更高版本重新提示，手动检查清除当前版本的关闭状态；逐项验证四种行为
- [ ] 5.5 实现显式下载：未点击前确认只检查不下载；点击后显示进度，取消能中止并清理 pending 半包；取消后 `release` 与临时目录中无可安装文件
- [ ] 5.6 实现安装前握手：向 renderer 发送准备事件，停止生成中的回复、停止朗读、等待持久化后 ack，2 秒超时兜底；正在生成回复时先弹确认，取消确认则不安装
- [ ] 5.7 实现退出拦截：下载中取消并放行退出；已下载未安装时弹「安装并退出 / 直接退出 / 取消」；分别验证三种选择的实际行为
- [ ] 5.8 实现 `installing-update` 标记：安装启动前写入，安装中再次启动应用被提示并退出；模拟版本未变化的中断安装，确认下次启动提示未完成并允许重新下载
- [ ] 5.9 实现平台动作分流：Windows 与 AppImage 在应用内下载安装，macOS 与 deb 打开对应 tag 的发布页面且不调用 updater 下载；在 macOS 与 Linux 上分别验证
- [ ] 5.10 实现启动时清理 pending 目录中的陈旧半包；手动放置一个假半包后重启，确认被清理且状态回到可下载
- [ ] 5.11 处理检查、下载、安装失败：均以非阻塞方式提示，允许重试，当前版本继续可用且不影响会话；模拟断网与取消下载验证
- [ ] 5.12 Windows ready 前设置 AppUserModelID，窗口未聚焦且下载完成时发送通知；Windows 上确认通知显示与点击行为正确
- [x] 5.13 在 README 中说明显式更新模型：可关闭标签、不点不下载、不点不安装、退出时已下载会询问、macOS/deb 跳下载页；与实际表现一致

## 6. 打包

- [x] 6.1 编写 `electron-builder.config.cjs` 基础配置：productName、appId、输出目录、files、asar、artifactName（含版本与架构）；运行 `pnpm exec electron-builder --dir` 成功且 `app.asar` 内只含预期文件
- [x] 6.2 配置 macOS：dmg + zip、x64 与 arm64 同一次调用、hardened runtime、entitlements、麦克风用途说明；`pnpm dist:mac` 产出两个架构的 dmg/zip，`plutil` 或 `codesign -d --entitlements` 显示音频输入权限与用途说明
- [ ] 6.3 配置 Windows：NSIS x64、可选安装目录、非 per-machine；在 Windows 构建（本地或 CI）后安装、启动、卸载各一次，安装目录与卸载项正常
- [ ] 6.4 配置 Linux：AppImage + deb x64、category、maintainer；在 Linux 构建后分别运行 AppImage 与安装 deb，两者都能启动并创建会话
- [x] 6.5 提供 `build/icon.png`（1024×1024 占位图）并确认 electron-builder 生成 `.icns` 与 `.ico`，三端安装包与窗口显示该图标
- [ ] 6.6 在三端分别安装打包产物，完成一次最小冒烟：启动、输入 API Key、发一条消息、重启后会话仍在；记录平台与结果
- [x] 6.7 检查 `release/` 中 `latest.yml`、`latest-mac.yml`、`latest-linux.yml` 均存在，mac 元数据覆盖 x64 与 arm64，且引用的文件名与实际产物一致

## 7. CI 自动发布

- [x] 7.1 新增 `.github/workflows/release.yml`：`push` tags `v*` 与带 tag 输入的 `workflow_dispatch` 触发，`contents: write`，按 tag 设置 concurrency；推送普通提交不触发，推送 tag 触发
- [x] 7.2 实现 build matrix（macos-latest / windows-latest / ubuntu-latest），每 job 依次 type、lint、renderer build、main build、electron-builder `--publish never`，并上传 `release/` artifact；三 job 在测试 tag 上全部成功
- [ ] 7.3 实现签名条件开关：macOS 仅在提供证书与公证凭据时签名/公证，Windows 仅在提供证书时签名；无 secrets 时三端未签名构建仍成功，有凭据时按 design.md 的变量名生效
- [x] 7.4 实现 release job：校验 tag 与 `package.json` 版本一致、下载全部 artifact、断言所需 `latest*.yml` 存在、创建或复用 Release 并以 `--clobber` 上传；版本不一致时流水线失败且不产生资产
- [ ] 7.5 验证幂等与原子性：同一 tag 重跑不产生第二个 Release，资产被替换；人为让一个平台构建失败时 Release 不被更新
- [x] 7.6 确认 `pages.yml` 只响应 `main`，桌面 release 不影响 Web 部署；推送到 `main` 后 Pages 流程成功且 release 未触发
- [x] 7.7 用测试 tag（如 `v0.1.3-test.1`）端到端跑一次发布，核对 Release 资产清单、`latest*.yml`、自动生成的发布说明，以及 Release 为发布态
- [ ] 7.8 安装上一版本后发布新版本，验证三端更新路径：Windows/AppImage 在应用内下载并重启安装、macOS/deb 打开下载页；确认更新后会话数据保留
- [x] 7.9 在 README 中记录发布流程（改版本 → 提交 → tag → push）与所需 secrets（macOS 证书、公证、Windows 证书），并确认文档与实际 workflow 变量一致
- [ ] 7.10 删除测试 Release 与测试 tag，确认仓库只保留正式版本，且删除后应用检查更新行为正常

## 8. 集成验收

- [x] 8.1 新增桌面冒烟清单文档，覆盖冷启动、持久化、流式回复与停止、上传/预览、语音与拒绝权限、朗读、导出导入、外链、下载、更新标签/关闭/下载/取消/退出/安装；清单中每条均可执行
- [ ] 8.2 在干净环境按冒烟清单完整执行一遍（至少 macOS 本机 + CI 产出的 Windows/Linux 包），结果记录在清单文档中，失败项已修复或明确记录为已知限制
- [x] 8.3 运行 `pnpm type`、`pnpm lint`、`pnpm build`、`pnpm build:electron`、`openspec validate add-electron-desktop`，全部通过
- [ ] 8.4 回归 Web 产物：用 `pnpm build` 产物在静态服务器打开，确认聊天、上传、导出导入、语音等行为与改动前一致，未引入 Electron 专有依赖
- [x] 8.5 确认没有把 `app://` origin、productName 或 appId 硬编码在多个位置；全局搜索后仅存在单一常量/配置来源
- [ ] 8.6 复核 design.md 的风险项并更新结论：未签名 mac 提示、blob 预览、`--publish never` 元数据、多架构 yml、半包清理、安装中断标记，确认每条都有实测结果

## Workflow follow-up

- 按项目评审要求完成评审后，用 `openspec-archive-change` 归档本次 change。
- 归档后确认 `openspec/specs/desktop-shell`、`desktop-updates`、`desktop-release` 已生成，并抽查 scenario 是否完整。
