<div align="center">

<img src="./build/icon.png" alt="DeepSeek Desktop app icon" width="96" />

# DeepSeek Desktop

**A local-first DeepSeek chat client for the web and the desktop.**

[![Latest release](https://img.shields.io/github/v/release/tangjiahui-cn/deepseek-desktop?style=flat-square&label=release&color=2f6fed)](https://github.com/tangjiahui-cn/deepseek-desktop/releases)
[![MIT License](https://img.shields.io/badge/license-MIT-2f6fed?style=flat-square)](LICENSE)
[![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat-square)](#desktop-app)

[Web app](https://tangjiahui-cn.github.io/deepseek-desktop/) · [Download](https://github.com/tangjiahui-cn/deepseek-desktop/releases) · [Development docs](docs/development.md)

English | [简体中文](README.md)

</div>

DeepSeek Desktop is a chat app powered by the DeepSeek API, available as a static web app and as a native desktop app for macOS, Windows, and Linux. There is no application backend: the client connects directly to the API service you configure. Add your API key in **Settings** before your first chat.

- **Local-first:** Settings, conversations, drafts, and original attachments stay on your device; no account required.
- **Personalized:** Save a custom prompt in Settings to shape answers around the way you write.
- **Long-term memory:** Opt in to let the assistant distill durable facts and preferences from new chats; set a memory length (2,000–20,000 characters) and your own memory requirements, and editing never pauses automatic updates.
- **Consistent everywhere:** The same React interface runs in the browser and in Electron.
- **Updates on your terms:** The desktop app never downloads or installs an update without confirmation.

## Screenshot (Desktop)

![DeepSeek Desktop main window](docs/images/app.webp)

## Quick start

Requires Node.js 22.12+ (24 LTS recommended) and pnpm 11 (`corepack enable`).

```sh
git clone https://github.com/tangjiahui-cn/deepseek-desktop.git

cd deepseek-desktop

pnpm install

pnpm dev            # desktop development

pnpm dev:web        # web dev server only

pnpm build          # build the web app into dist/

pnpm dist:dir       # package for the current platform
```

> [!NOTE]
> The first install downloads the Electron binary and may take a few minutes.

See the [development docs](docs/development.md) for the full command list and configuration.

## Desktop app

Download from [Releases](https://github.com/tangjiahui-cn/deepseek-desktop/releases):

- **macOS**: `.dmg` / `.zip`
- **Windows x64**: `.exe`
- **Linux x64**: `.AppImage` / `.deb`

Installers are unsigned: on macOS, allow the app in System Settings; on Windows, pass the SmartScreen prompt.

## Data and privacy

API keys, settings, conversations, and attachments are stored locally. Content is sent to the configured API service only when you send a message, upload an attachment, or use voice input.

Desktop data directories:

| Platform | Directory |
| --- | --- |
| macOS | `~/Library/Application Support/DeepSeek Desktop` |
| Windows | `%APPDATA%\DeepSeek Desktop` |
| Linux | `~/.config/DeepSeek Desktop` |

---

More docs: [Development](docs/development.md) · [Releasing](docs/releasing.md) · [Smoke test](docs/desktop-smoke-test.md)

[MIT](LICENSE) © 2026 DeepSeek
