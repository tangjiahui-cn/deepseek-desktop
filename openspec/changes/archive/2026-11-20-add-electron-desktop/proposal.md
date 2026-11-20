# Proposal

## Why

应用目前是纯静态 Web 版：用户只能在浏览器里访问，或下载后双击 `index.html`，没有安装、系统集成和版本更新通道。把它封装成 Electron 桌面应用，并建立 tag 触发的自动发布流水线，可以让用户获得正常的桌面软件安装体验，同时让每次发版自动产出 Windows / macOS / Linux 三端产物。

## What Changes

- 新增 Electron 主进程与 preload，加载现有 renderer；用自定义 `app://` 协议提供固定的安全 origin，使 localStorage / IndexedDB 正常工作。
- 补齐桌面端行为：单实例、窗口尺寸与位置恢复、菜单（含 macOS 编辑菜单）、外链交给系统浏览器、附件 blob 预览子窗口、下载落盘、麦克风权限。
- 集成 electron-updater：新版本以可关闭的应用内标签提示，用户显式下载、显式重启安装；Windows 与 Linux AppImage 在应用内完成，macOS 与 Linux deb 打开下载页面。
- 新增 electron-builder 打包配置：macOS `dmg + zip`（x64 / arm64）、Windows `NSIS`（x64）、Linux `AppImage + deb`（x64）。
- 新增 `.github/workflows/release.yml`：推送 `v*` tag（或手动触发）后按 OS 并行构建，集中创建发布态 GitHub Release 并上传安装包与 `latest*.yml`。
- 保留现有 GitHub Pages 部署；桌面发布与 Web 发布互不影响。
- **BREAKING**：无。Web 构建与数据格式保持不变，桌面端是新增分发渠道。

## Capabilities

### New Capabilities

- `desktop-shell`: 桌面外壳行为，包括应用加载方式与 origin、窗口生命周期、菜单与单实例、外部链接/附件预览/下载、麦克风权限与安全策略。
- `desktop-updates`: 更新检查与安装行为，按平台区分自动安装与「提示并跳转下载」。
- `desktop-release`: 版本号一致性、三端产物矩阵、签名开关、更新元数据与 GitHub Release 发布规则。

### Modified Capabilities

无。项目此前没有已归档的 spec。

## Impact

- **新增依赖**：`electron`、`electron-builder`、`electron-updater`、`esbuild`（仅构建主进程）。
- **新增代码**：`electron/`（main、preload、updater、protocol、security）、`build/`（图标与 entitlements）、`electron-builder.config.cjs`、开发启动脚本。
- **修改配置**：`package.json`（`productName`、`appId` 相关脚本、`packageManager`）、`tsconfig.json`、`README` 系列。
- **CI**：新增 `release.yml`；`pages.yml` 保留，二者触发条件分离。
- **不影响**：现有 `src/` 的 API 协议、IndexedDB schema、导入导出格式、Web 构建产物。
- **范围外**：iOS / Android；macOS 自动安装更新与签名公证（只预留开关）；API Key 的 `safeStorage` 改造；Web 端历史数据迁移（Pages 当前未上线，且现有 ZIP 导入导出可跨端使用）。
