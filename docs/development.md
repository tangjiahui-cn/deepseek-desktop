# 开发指南

安装与使用说明见 [README](../README.md)。本文面向需要修改或打包项目的开发者。

## 环境要求

- Node.js 22.12 或更高版本（推荐 24 LTS）
- pnpm 11 — 执行一次 `corepack enable` 即可启用
- Git

## 常用命令

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

打包产物写入 `release/`。Windows 与 Linux 目标通常在 CI 的原生 runner 上构建；发布流程见 [发布文档](./releasing.md)。

## 项目结构

```text
electron/
  main.ts              应用生命周期、单实例与窗口创建
  protocol.ts          app://deepseek 静态文件协议与 CSP
  security.ts          权限、导航、window.open 与下载策略
  preview.ts           隔离的子窗口附件预览
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
docs/                  开发、发布与冒烟文档
```

## 配置

聊天默认使用 `deepseek-flash`，通过 Anthropic 兼容的 Messages / Files API 通信；语音使用 ASR / TTS 接口。请求使用搜索、链接阅读、标题和 `latest_reminder` 等扩展，接入服务需支持相应能力。附件实际支持的格式以服务端校验为准。

[rspack.config.ts](../rspack.config.ts) 默认连接 `https://api.deepseek.com`。`createConfig({ apiOrigin, devServer })` 支持自定义 API 地址和开发服务器代理；Electron 主进程在构建时通过 `API_ORIGIN` 获取同一地址。

## 安全模型

- renderer 运行在沙箱中，开启 `contextIsolation`，关闭 `nodeIntegration`。
- Content Security Policy 仅允许连接应用源和配置的 API 源。
- 离开应用源的页面导航会被阻止，外部链接交由系统浏览器打开。
- 附件预览使用独立窗口，不暴露桌面端桥接。

## 手动检查

发布前，在真实安装包上执行[桌面端冒烟清单](./desktop-smoke-test.md)。
