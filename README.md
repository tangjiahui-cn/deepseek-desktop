# DeepSeek Desktop

English | [简体中文](README.zh-CN.md)

A chat app powered by the DeepSeek API, available as a static web app and as a native desktop app for macOS, Windows, and Linux. No application backend is required: the client connects directly to the configured API service.

Download an installer from [Releases](https://github.com/tangjiahui-cn/deepseek-desktop/releases), or [try the web version](https://tangjiahui-cn.github.io/deepseek-desktop/). Enter your API key in Settings before your first chat.

## Getting started

Install Node.js 22.12+ and pnpm, then run:

```sh
git clone https://github.com/tangjiahui-cn/deepseek-desktop.git
cd deepseek-desktop
pnpm install
pnpm dev
```

`pnpm dev` starts the rspack dev server and opens the Electron desktop shell. To work in a browser only, run `pnpm dev:web` and open http://localhost:8090.

To build the static web site:

```sh
pnpm build
```

The output is written to `dist/`. Deploy it to a static web server or open `dist/index.html` directly. Opening the file directly requires browser support for storage on `file://` pages and an API service that permits their cross-origin requests.

## Desktop app

The desktop build wraps the same renderer in Electron. It loads from a fixed `app://deepseek` origin so localStorage and IndexedDB stay stable across launches.

### Install

Download the artifact for your platform from [Releases](https://github.com/tangjiahui-cn/deepseek-desktop/releases):

| Platform | Artifact |
| --- | --- |
| macOS (Apple silicon / Intel) | `.dmg` or `.zip` |
| Windows x64 | NSIS `.exe` |
| Linux x64 | `.AppImage` or `.deb` |

The current builds are **not code-signed**:

- On macOS, the first launch is blocked by Gatekeeper. Open **System Settings → Privacy & Security**, then click **Open Anyway**. If the app is still blocked, run `xattr -dr com.apple.quarantine "/Applications/DeepSeek Desktop.app"`.
- On Windows, SmartScreen may warn about an unknown publisher. Choose **More info → Run anyway**.

### Updates

Updates are explicit: nothing is downloaded or installed until you choose to do so.

- When a newer stable release is available, a dismissible tag appears near the sidebar settings entry. Closing it hides that version until a newer one appears or you run **Check for Updates** from the menu.
- Windows and Linux AppImage: click **Update**, then **Restart and Install** when the download finishes. The app stops active replies, waits for local data to be written, then restarts into the new version.
- macOS and Linux deb: the tag opens the release page instead of installing in-app.
- Quitting while a download is in progress cancels it. Quitting with a downloaded update asks whether to install and quit or quit without installing.
- Release notes and version numbers come from the GitHub Release. Only stable, published releases are offered.

## Features

- Multiple conversations with automatic titles, renaming, and deletion; edit prompts, regenerate replies, and switch between message branches.
- Streaming replies, deep thinking, smart search, link reading, and source citations; stop generation or continue eligible replies.
- Upload, paste, or drag and drop attachments; use voice input and read replies aloud. A live audio spectrum appears in the first row of the input area while recording on mobile.
- Markdown, syntax highlighting, KaTeX math, and Mermaid diagrams.
- Simplified Chinese and English, light and dark themes, mobile layouts, location settings, and chat history import and export.

## Data and storage

Your API key and settings are stored in localStorage. Conversations and original attachments are stored in IndexedDB. Local data is isolated by browser profile and site origin. Sending messages, uploading attachments, and using speech features sends the relevant content to the configured API service.

Desktop data lives in the platform application-data directory:

| Platform | Directory |
| --- | --- |
| macOS | `~/Library/Application Support/DeepSeek Desktop` |
| Windows | `%APPDATA%\DeepSeek Desktop` |
| Linux | `~/.config/DeepSeek Desktop` |

A development build uses a separate `DeepSeek Desktop (dev)` directory. The web version and the desktop app have different origins, so they keep separate histories; use Settings → Data → Export/Import to move history between them with a ZIP archive.

History import and export in Settings use ZIP archives. After confirmation and successful validation, importing replaces all local conversations and attachments. Exports include conversations and locally available original images, but exclude API keys, settings, and original non-image attachments. See the [history import/export documentation (Chinese)](src/services/chat/history/README.md) for the archive format and preservation details.

Settings → Data → Delete all chats clears all local conversations, original attachments, and unsent drafts after confirmation. It stops ongoing replies and returns to a new chat. Your API key and settings are preserved; files already uploaded to the API service are not deleted.

## Development

| Command               | Description |
| --------------------- | ----------- |
| `pnpm dev`            | Build the Electron main process, start rspack, and open the desktop app |
| `pnpm dev:web`        | Start the rspack dev server only (http://localhost:8090) |
| `pnpm build`          | Build the web renderer into `dist/` |
| `pnpm build:electron` | Build `electron/main.ts` and `electron/preload.ts` into `electron/dist/` |
| `pnpm build:desktop`  | Build both the renderer and the Electron main process |
| `pnpm type`           | Run TypeScript checks for the renderer and Electron code |
| `pnpm lint`           | Lint with oxlint |
| `pnpm format`         | Format with oxfmt |
| `pnpm dist:dir`       | Package an unpacked app for the current platform |
| `pnpm dist:mac`       | Build macOS dmg + zip for x64 and arm64 |
| `pnpm dist:win`       | Build the Windows x64 NSIS installer |
| `pnpm dist:linux`     | Build the Linux x64 AppImage and deb |

Packaging writes to `release/`. The Windows and Linux targets are normally built in CI on their native runners.

[rspack.config.ts](rspack.config.ts) uses `https://api.deepseek.com` by default. Use `createConfig({ apiOrigin, devServer })` to customize the API origin and development server proxy. The Electron main process gets the same origin at build time from `API_ORIGIN`.

Chat uses `deepseek-flash` by default through Anthropic-compatible Messages / Files APIs. Speech features use ASR / TTS endpoints. Requests include extensions for search, link reading, titles, and `latest_reminder`, so the configured service must support the corresponding capabilities. Supported attachment formats are determined by server-side validation.

```text
electron/
  main.ts              App lifecycle, single instance, window creation
  protocol.ts          app://deepseek static file protocol and CSP
  security.ts          Permissions, navigation, window.open, downloads
  preview.ts           Isolated attachment preview window
  windowState.ts       Window size/position persistence
  menu.ts              Application menu
  updater.ts           Explicit download/install update state machine
  preload.ts           Minimal contextBridge API
build/                 App icon and macOS entitlements
scripts/               Electron build and development launchers
src/
  app/                 Application layout, themes, and global styles
  components/          Chat, settings, Markdown, and other UI components
  i18n/                English and Chinese translations
  services/
    api/               API requests, SSE, and protocol types
    chat/              Conversations, message branches, storage, and history import/export
    desktop/           Desktop update bridge and types
    markdown/          Markdown parsing, syntax highlighting, and diagrams
    speech/            Audio recording and read-aloud playback
  utils/               Shared utilities
```

### Releasing

The desktop release workflow lives at [.github/workflows/release.yml](.github/workflows/release.yml). It runs on tags matching `v*` and can also be started manually with an existing tag.

```sh
# 1. Bump the version in package.json and commit the change
# 2. Create and push the tag
git tag v0.2.0
git push origin main --tags
```

The workflow checks that the tag matches `package.json`, builds macOS (x64 + arm64 dmg/zip), Windows x64 NSIS, and Linux x64 AppImage/deb in parallel, then publishes one GitHub Release with the installers and `latest*.yml` update metadata. Test tags containing `-` (for example `v0.2.0-test.1`) are marked as prereleases and are ignored by the updater.

Signing is optional. Without secrets the workflow publishes unsigned installers; with secrets it signs and notarizes automatically:

| Secret | Purpose |
| --- | --- |
| `MAC_CERT_P12` | Base64-encoded Developer ID Application certificate |
| `MAC_CERT_PASSWORD` | Password for the macOS certificate |
| `APPLE_ID` | Apple ID used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Apple Developer team ID |
| `WIN_CERT_P12` | Base64-encoded Windows code-signing certificate |
| `WIN_CERT_PASSWORD` | Password for the Windows certificate |

Never delete a published release that installed clients may use for updates; publish a fixed version instead.

## License

[MIT](LICENSE). The build copies the license into the app and `dist/LICENSE`; include it when distributing the app. Third-party dependencies are subject to their own licenses.
