<div align="center">

<img src="./build/icon.png" alt="DeepSeek Desktop 应用图标" width="96" />

# DeepSeek Desktop

**本地优先的 DeepSeek 聊天客户端，覆盖 Web 与桌面端。**

[![最新版本](https://img.shields.io/github/v/release/tangjiahui-cn/deepseek-desktop?style=flat-square&label=release&color=2f6fed)](https://github.com/tangjiahui-cn/deepseek-desktop/releases)
[![MIT 许可证](https://img.shields.io/badge/license-MIT-2f6fed?style=flat-square)](LICENSE)
[![Node.js 22.12+](https://img.shields.io/badge/Node.js-22.12%2B-3c873a?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![支持平台](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat-square)](#桌面版)

[Web 版](https://tangjiahui-cn.github.io/deepseek-desktop/) · [下载](https://github.com/tangjiahui-cn/deepseek-desktop/releases) · [功能](#功能) · [开发](#开发)

简体中文 | [English](README.en.md)

</div>

DeepSeek Desktop 是基于 DeepSeek API 的聊天应用，同时提供静态 Web 版和 macOS / Windows / Linux 桌面版。应用没有自己的后端，客户端直接连接你配置的 API 服务。

> [!TIP]
> 可以直接[使用 Web 版](https://tangjiahui-cn.github.io/deepseek-desktop/)，或[下载安装包](https://github.com/tangjiahui-cn/deepseek-desktop/releases)。首次聊天前，请在**设置**中填写 API Key。

## 概览

同一份 React renderer 同时运行在浏览器和 Electron 中，界面行为保持一致。桌面版从固定的 `app://deepseek` 源加载，localStorage 与 IndexedDB 在多次启动之间保持同一个 origin。

- **本地优先。** 设置保存在 localStorage，会话、草稿与附件原件保存在 IndexedDB；无需账号，也没有同步服务器。
- **更新不打扰。** 没有你的操作，桌面版不会下载或安装任何更新。
- **一套代码，三端打包。** rspack 构建 Web 产物，electron-builder 打包 macOS、Windows 与 Linux 安装包。

## 功能

**对话**

- 多会话、自动标题、重命名、删除与分组历史。
- 编辑提问、重新生成回复，并在消息分支之间切换。
- 会话内搜索，以及全部历史的 ZIP 导出与导入。

**回答**

- 流式回复，支持 **深度思考** 与 **智能搜索** 开关。
- 链接阅读与来源引用，可停止生成，也可继续符合条件的回复。
- 可选择音色的回复朗读。

**输入**

- 上传、粘贴或拖拽图片、PDF、Office 文件、文本与代码。
- 语音输入，移动端录音时显示实时频谱。
- macOS 下关闭窗口后，未发送的草稿与附件仍会保留。

**渲染**

- GFM Markdown、代码高亮、KaTeX 公式与 Mermaid 图表。
- 响应式布局，支持浅色、深色与跟随系统主题。
- 简体中文与英文界面。

**桌面端**

- 原生菜单、单实例运行，并恢复窗口尺寸与位置。
- 在隔离的子窗口中预览附件。
- Windows 与 Linux AppImage 提供显式更新流程。

## 运行

### 前置要求

- Node.js **22.12 或更高版本**（推荐 24 LTS）
- pnpm **11** — 执行一次 `corepack enable` 即可启用
- Git

### 本地运行

```sh
git clone https://github.com/tangjiahui-cn/deepseek-desktop.git
cd deepseek-desktop
pnpm install
pnpm dev
```

`pnpm dev` 会构建 Electron 主进程、启动端口 8090 的 rspack 开发服务器，并打开桌面窗口。

> [!NOTE]
> 首次安装会下载 Electron 二进制文件（100 MB 以上），可能需要几分钟。

### 仅 Web

```sh
pnpm dev:web   # 启动开发服务器 http://localhost:8090
pnpm build     # 构建静态站点到 dist/
```

`dist/` 可以部署到任意静态服务器，也可以直接打开 `dist/index.html`。在 `file://` 页面下，存储与跨域请求取决于浏览器和 API 的 CORS 策略；语音输入需要安全上下文，因此无法在 `file://` 下使用。

## 桌面版

### 安装

从 [Releases](https://github.com/tangjiahui-cn/deepseek-desktop/releases) 下载对应平台的产物：

| 平台 | 产物 |
| --- | --- |
| macOS（Apple 芯片 / Intel） | `.dmg` 或 `.zip` |
| Windows x64 | NSIS `.exe` |
| Linux x64 | `.AppImage` 或 `.deb` |

### 首次启动

> [!WARNING]
> 当前安装包**未做代码签名与公证**。
>
> - **macOS：** Gatekeeper 会拦截首次启动。打开**系统设置 → 隐私与安全性**，点击**仍要打开**。如果仍被拦截，可执行 `xattr -dr com.apple.quarantine "/Applications/DeepSeek Desktop.app"`。
> - **Windows：** SmartScreen 可能提示未知发布者，选择**更多信息 → 仍要运行**。
> - macOS 构建会做 ad-hoc 签名，Apple 芯片在系统里放行后即可运行。如果旧版本提示 **“DeepSeek Desktop”已损坏**，请下载最新版本。

> [!NOTE]
> macOS 下按 **⌘W** 或红色关闭按钮只会隐藏窗口，不会退出应用；会话、输入草稿与附件都会保留。需要完全退出请按 **⌘Q**。

### 更新

更新是显式的：没有你的操作，不会下载或安装任何更新。

- 发现更高的稳定版本时，侧栏设置入口附近会出现可关闭的更新标签。关闭后该版本不再提示，直到出现更高版本或在菜单中手动检查。
- **Windows 与 Linux AppImage：** 点击「更新」，下载完成后点击「重启并安装」。应用会先停止正在生成的回复、等待本地数据写入，再退出并安装。
- **macOS 与 Linux deb：** 标签按钮会打开 Releases 页面，不在应用内安装。
- 下载过程中退出会取消下载；已下载未安装时退出，会询问「安装并退出」还是「直接退出」。
- 版本号与发布说明来自 GitHub Release，只接受已发布的稳定版本。

## 数据与隐私

API Key 和设置保存在 localStorage，会话及附件原件保存在 IndexedDB，本地数据按浏览器用户配置和站点源（origin）隔离。发送对话、上传附件和使用语音功能时，相应内容会提交给配置的 API 服务。

桌面版数据位于平台的应用数据目录：

| 平台 | 目录 |
| --- | --- |
| macOS | `~/Library/Application Support/DeepSeek Desktop` |
| Windows | `%APPDATA%\DeepSeek Desktop` |
| Linux | `~/.config/DeepSeek Desktop` |

开发模式使用独立的 `DeepSeek Desktop (dev)` 目录。Web 版与桌面版 origin 不同，历史数据互相独立；需要搬运时，使用**设置 → 数据管理 → 导出/导入**以 ZIP 格式迁移。

> [!IMPORTANT]
> 导入 ZIP 会在校验成功后替换全部本地会话和附件。导出包含会话与本地可用的图片原件，不包含 API Key、设置或非图片附件原件。格式与保留范围见[历史导入导出](src/services/chat/history/README.md)。

**删除所有对话**会在确认后清空全部本地会话、附件原件和未发送的草稿，停止正在生成的回复并回到新对话。API Key 和其他设置保留，已上传到 API 服务的文件不受影响。

## 开发

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 构建 Electron 主进程、启动 rspack 并打开桌面应用 |
| `pnpm dev:web` | 只启动 Web 开发服务器（http://localhost:8090） |
| `pnpm build` | 构建 Web renderer 到 `dist/` |
| `pnpm build:electron` | 构建 `electron/main.ts` 与 `electron/preload.ts` 到 `electron/dist/` |
| `pnpm build:desktop` | 同时构建 renderer 与 Electron 主进程 |
| `pnpm type` | 检查 renderer 与 Electron 代码的 TypeScript 类型 |
| `pnpm lint` | oxlint 检查 |
| `pnpm format` | oxfmt 格式化 |
| `pnpm dist:dir` | 为当前平台打一个未压缩的应用目录 |
| `pnpm dist:mac` | 构建 macOS x64 / arm64 的 dmg 与 zip |
| `pnpm dist:win` | 构建 Windows x64 的 NSIS 安装程序 |
| `pnpm dist:linux` | 构建 Linux x64 的 AppImage 与 deb |

打包产物写入 `release/`。Windows 与 Linux 目标通常在 CI 的原生 runner 上构建；发版前的手动检查见[桌面端冒烟清单](docs/desktop-smoke-test.md)。

### 项目结构

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

### 配置

聊天默认使用 `deepseek-flash`，通过 Anthropic 兼容的 Messages / Files API 通信；语音使用 ASR / TTS 接口。请求使用搜索、链接阅读、标题和 `latest_reminder` 等扩展，接入服务需支持相应能力。附件实际支持的格式以服务端校验为准。

[rspack.config.ts](rspack.config.ts) 默认连接 `https://api.deepseek.com`。`createConfig({ apiOrigin, devServer })` 支持自定义 API 地址和开发服务器代理；Electron 主进程在构建时通过 `API_ORIGIN` 获取同一地址。

### 安全模型

- renderer 运行在沙箱中，开启 `contextIsolation`，关闭 `nodeIntegration`。
- Content Security Policy 仅允许连接应用源和配置的 API 源。
- 离开应用源的页面导航会被阻止，外部链接交由系统浏览器打开。
- 附件预览使用独立窗口，不暴露桌面端桥接。

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

> [!WARNING]
> 不要删除已发布且可能有客户端正在使用的 Release；请发布修复版本。

## 技术栈

- [React 18](https://react.dev)、TypeScript，使用 Zustand 管理状态
- [rspack](https://rspack.dev)、SWC 与 Lightning CSS 构建 renderer
- [Electron](https://www.electronjs.org) 45、electron-builder 与 electron-updater
- [KaTeX](https://katex.org)、[Mermaid](https://mermaid.js.org) 与 [Prism](https://prismjs.com)
- `idb` 与 `fflate` 负责本地存储和 ZIP 归档

## 致谢

本项目 fork 自 [DeepSeek 的 chat-demo](https://github.com/deepseek-ai/chat-demo)，并补充了 Electron 外壳、桌面发布流水线以及上文所述的功能。
