# DeepSeek Desktop

[English](README.md) | 简体中文

基于 DeepSeek API 的聊天应用，同时提供静态 Web 版和 macOS / Windows / Linux 桌面版。无需应用后端，客户端直接请求配置的 API 服务。

可以从 [Releases](https://github.com/tangjiahui-cn/deepseek-desktop/releases) 下载安装包，或直接使用 [Web 版](https://tangjiahui-cn.github.io/deepseek-desktop/)。首次使用时，请在设置中填写 API Key。

## 运行

准备 Node.js 22.12+ 和 pnpm：

```sh
git clone https://github.com/tangjiahui-cn/deepseek-desktop.git
cd deepseek-desktop
pnpm install
pnpm dev
```

`pnpm dev` 会构建 Electron 主进程、启动 rspack 开发服务器并打开桌面窗口。只调试浏览器界面时，运行 `pnpm dev:web` 后打开 http://localhost:8090 。

生成静态 Web 产物：

```sh
pnpm build
```

产物位于 `dist/`，可部署到静态服务器，也可直接打开 `dist/index.html`。直接打开时，浏览器和 API 服务需允许 `file://` 页面的存储与跨域请求。

## 桌面版

桌面版用 Electron 包装同一份 renderer，并从固定的 `app://deepseek` 源加载，保证 localStorage 与 IndexedDB 在多次启动之间保持同一 origin。

### 安装

从 [Releases](https://github.com/tangjiahui-cn/deepseek-desktop/releases) 下载对应平台的产物：

| 平台 | 产物 |
| --- | --- |
| macOS（Apple 芯片 / Intel） | `.dmg` 或 `.zip` |
| Windows x64 | NSIS `.exe` |
| Linux x64 | `.AppImage` 或 `.deb` |

当前安装包**未做代码签名**：

- macOS 首次启动会被 Gatekeeper 拦截。打开 **系统设置 → 隐私与安全性**，点击 **仍要打开**。如果仍被拦截，可执行 `xattr -dr com.apple.quarantine "/Applications/DeepSeek Desktop.app"`。
- Windows 可能提示未知发布者。选择 **更多信息 → 仍要运行**。
- macOS 构建会做 ad-hoc 签名，Apple 芯片在系统里放行后可以运行，但没有公证。如果旧版本提示 **“DeepSeek Desktop”已损坏**，请下载最新版本的安装包。

### 更新

macOS 下按 **⌘W** 或红色关闭按钮只会隐藏窗口，不会退出应用；再次打开时会恢复原来的会话、输入草稿和附件。需要完全退出请按 **⌘Q**。

更新是显式的：没有你的操作，不会下载或安装任何更新。

- 发现更高的稳定版本时，侧栏设置入口附近会出现可关闭的更新标签。关闭后该版本不再提示，直到出现更高版本或在菜单中手动检查。
- Windows 与 Linux AppImage：点击「更新」，下载完成后点击「重启并安装」。应用会先停止正在生成的回复、等待本地数据写入，再退出并安装。
- macOS 与 Linux deb：标签按钮是「前往下载」，打开 Releases 页面，不在应用内安装。
- 下载过程中退出会取消下载；已下载未安装时退出，会询问「安装并退出」还是「直接退出」。
- 版本号与发布说明来自 GitHub Release，只接受已发布的稳定版本。

## 功能

- 多会话、自动标题、重命名与删除；编辑提问、重新生成和切换消息分支。
- 流式回答、深度思考、智能搜索、链接阅读与来源引用；支持停止和符合条件的继续生成。
- 附件上传、粘贴与拖拽，语音输入和回复朗读；移动端录音时输入框首行显示实时频谱。
- Markdown、代码高亮、KaTeX 公式和 Mermaid 图表。
- 简体中文与英文、浅色与深色主题、移动端布局、位置设置、历史导入导出。

## 数据

API Key 和设置保存在 localStorage，会话及附件原件保存在 IndexedDB，本地数据按浏览器用户配置和站点源（origin）隔离。发送对话、上传附件和使用语音功能时，相应内容会提交给配置的 API 服务。

桌面版数据位于平台的应用数据目录：

| 平台 | 目录 |
| --- | --- |
| macOS | `~/Library/Application Support/DeepSeek Desktop` |
| Windows | `%APPDATA%\DeepSeek Desktop` |
| Linux | `~/.config/DeepSeek Desktop` |

开发模式使用独立的 `DeepSeek Desktop (dev)` 目录。Web 版与桌面版 origin 不同，历史数据互相独立；需要搬运时，使用设置中的 ZIP 导出/导入。

设置中的历史导入导出使用 ZIP 格式。导入会在确认并校验成功后替换全部本地会话和附件；导出包含会话与本地可用的图片原件，不包含 API Key、设置或非图片附件原件。格式与保留范围见[历史导入导出](src/services/chat/history/README.md)。

设置 → 数据管理 → 删除所有对话，会在确认后清空全部本地会话、附件原件和未发送的草稿，停止正在生成的回复并回到新对话。API Key 和其他设置保留，已上传到 API 服务的文件不受影响。

## 开发

| 命令                  | 用途 |
| --------------------- | ---- |
| `pnpm dev`            | 构建 Electron 主进程、启动 rspack 并打开桌面应用 |
| `pnpm dev:web`        | 只启动 Web 开发服务器（http://localhost:8090） |
| `pnpm build`          | 构建 Web renderer 到 `dist/` |
| `pnpm build:electron` | 构建 `electron/main.ts` 与 `electron/preload.ts` 到 `electron/dist/` |
| `pnpm build:desktop`  | 同时构建 renderer 与 Electron 主进程 |
| `pnpm type`           | 检查 renderer 与 Electron 代码的 TypeScript 类型 |
| `pnpm lint`           | oxlint 检查 |
| `pnpm format`         | oxfmt 格式化 |
| `pnpm dist:dir`       | 为当前平台打一个未压缩的应用目录 |
| `pnpm dist:mac`       | 构建 macOS x64 / arm64 的 dmg 与 zip |
| `pnpm dist:win`       | 构建 Windows x64 的 NSIS 安装程序 |
| `pnpm dist:linux`     | 构建 Linux x64 的 AppImage 与 deb |

打包产物写入 `release/`。Windows 与 Linux 目标通常在 CI 的原生 runner 上构建。

[rspack.config.ts](rspack.config.ts) 默认连接 `https://api.deepseek.com`。`createConfig({ apiOrigin, devServer })` 支持自定义 API 地址和开发服务器代理；Electron 主进程在构建时通过 `API_ORIGIN` 获取同一地址。

聊天默认使用 `deepseek-flash`，通过 Anthropic 兼容的 Messages / Files API 通信；语音使用 ASR / TTS 接口。请求使用搜索、链接阅读、标题和 `latest_reminder` 等扩展，接入服务需支持相应能力。附件实际支持的格式以服务端校验为准。

```text
electron/
  main.ts              应用生命周期、单实例与窗口创建
  protocol.ts          app://deepseek 静态文件协议与 CSP
  security.ts          权限、导航、window.open 与下载策略
  preview.ts           隔离子窗口的附件预览
  windowState.ts       窗口尺寸与位置持久化
  menu.ts              应用菜单
  updater.ts           显式下载/安装的更新状态机
  preload.ts           最小化的 contextBridge API
build/                 应用图标与 macOS entitlements
scripts/               Electron 构建与开发启动脚本
src/
  app/                 应用布局、主题与全局样式
  components/          聊天、设置、Markdown 等界面组件
  i18n/                中英文文案
  services/
    api/               API 请求、SSE 与协议类型
    chat/              会话、消息分支、本地存储与历史导入导出
    desktop/           桌面端更新桥接与类型
    markdown/          Markdown 解析、代码高亮与图表
    speech/            录音与朗读
  utils/               通用工具
```

### 发布

桌面发布流水线位于 [.github/workflows/release.yml](.github/workflows/release.yml)，由 `v*` tag 触发，也可以用已有 tag 手动触发。

```sh
# 1. 修改 package.json 中的版本号并提交
# 2. 创建并推送 tag
git tag v0.2.0
git push origin main --tags
```

流水线会校验 tag 与 `package.json` 一致，并行构建 macOS（x64 + arm64 的 dmg/zip）、Windows x64 NSIS、Linux x64 AppImage/deb，然后集中创建一个 GitHub Release，上传安装包与 `latest*.yml` 更新元数据。带 `-` 的测试 tag（如 `v0.2.0-test.1`）会标记为预发布，客户端会忽略。

签名是可选的：没有 secrets 时照常发布未签名安装包；提供 secrets 后自动签名与公证：

| Secret | 用途 |
| --- | --- |
| `MAC_CERT_P12` | Base64 编码的 Developer ID Application 证书 |
| `MAC_CERT_PASSWORD` | macOS 证书密码 |
| `APPLE_ID` | 公证使用的 Apple ID |
| `APPLE_APP_SPECIFIC_PASSWORD` | 公证使用的 App 专用密码 |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `WIN_CERT_P12` | Base64 编码的 Windows 代码签名证书 |
| `WIN_CERT_PASSWORD` | Windows 证书密码 |

不要删除已发布且可能有客户端正在使用的 Release；请发布修复版本。

## 许可证

[MIT](LICENSE)。构建会将许可证复制到应用内和 `dist/LICENSE`，分发时请一并保留；第三方依赖遵循各自的许可证。
