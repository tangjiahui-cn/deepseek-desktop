# 发布桌面版

发布流水线位于 [.github/workflows/release.yml](../.github/workflows/release.yml)，由 `v*` tag 触发，也可以用已有 tag 手动触发。

## 发布步骤

```sh
# 1. 修改 package.json 中的版本号并提交
# 2. 创建并推送 tag
git tag v0.2.0
git push origin main --tags
```

流水线会校验 tag 与 `package.json` 一致，并行构建 macOS（x64 + arm64 的 dmg/zip）、Windows x64 NSIS、Linux x64 AppImage/deb，然后集中创建一个 GitHub Release，上传安装包与 `latest*.yml` 更新元数据。

带 `-` 的测试 tag（如 `v0.2.0-test.1`）会标记为预发布，客户端会忽略。

## 产物

| 平台 | 产物 |
| --- | --- |
| macOS | x64 / arm64 的 `.dmg` 与 `.zip` |
| Windows | x64 NSIS `.exe` |
| Linux | x64 `.AppImage` 与 `.deb` |

`latest.yml`、`latest-mac.yml` 和 `latest-linux.yml` 是客户端检查更新所需的元数据，必须与安装包一起发布。

## 本地打包

```sh
pnpm dist:dir
pnpm dist:mac
pnpm dist:win
pnpm dist:linux
```

产物写入 `release/`。macOS 与 Linux 目标建议在对应平台或 CI 上构建，Windows 目标通常在 Windows runner 上构建。

## 签名与公证

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

未提供证书时，macOS 构建会做 ad-hoc 签名，保证 Apple 芯片可以启动，但仍未公证。

## 注意事项

> [!WARNING]
> 不要删除已发布且可能有客户端正在使用的 Release；请发布修复版本。

- 只有已发布的稳定版本会被更新检查视为可用版本。
- macOS 发布前会校验外层 app 签名，避免出现 Electron 原始签名导致的“已损坏”问题。
- 本地打包前先运行 `pnpm type` 和 `pnpm lint`；CI 也会执行同样的检查。
