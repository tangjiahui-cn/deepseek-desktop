const path = require('node:path')
const pkg = require('./package.json')

const repository =
  typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository?.url ?? '')
const match = /github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?/.exec(repository)
if (!match) {
  throw new Error(`package.json repository must point at a GitHub repository: ${repository}`)
}
const [, owner, repo] = match

const hasMacCertificate = Boolean(process.env.CSC_LINK || process.env.CSC_NAME)
const hasNotarization = Boolean(
  process.env.APPLE_ID &&
    process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.APPLE_TEAM_ID
)

module.exports = {
  appId: pkg.appId,
  productName: pkg.productName,
  copyright: `Copyright © ${new Date().getFullYear()} ${pkg.productName}`,
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: [
    'dist/**/*',
    'electron/dist/**/*',
    'package.json',
    'LICENSE',
    '!node_modules/**/*',
    '!**/*.map',
  ],
  asar: true,
  npmRebuild: false,
  // 让 electron-builder 复用工作区内的 Electron 缓存，CI 与本地都不写用户缓存目录
  electronDownload: {
    cache: path.join(__dirname, '.cache/electron'),
    mirror: process.env.ELECTRON_MIRROR || undefined,
  },
  // Windows NSIS、Linux AppImage/deb 共用一个不含空格的产物名
  artifactName: 'deepseek-desktop-${version}-${arch}.${ext}',
  publish: [
    {
      provider: 'github',
      owner,
      repo,
      releaseType: 'release',
    },
  ],
  mac: {
    category: 'public.app-category.productivity',
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] },
      { target: 'zip', arch: ['x64', 'arm64'] },
    ],
    minimumSystemVersion: '12.0',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    extendInfo: {
      NSMicrophoneUsageDescription:
        'DeepSeek Desktop uses the microphone when you start voice input.',
    },
    // 没有 Developer ID 时也要 ad-hoc 重签整个 app bundle：
    // Electron 原始签名不覆盖后加入的 app.asar，Apple Silicon 会报「已损坏」
    identity: hasMacCertificate ? undefined : '-',
    notarize: hasNotarization,
    icon: 'build/icon.icns',
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'build/icon.ico',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
    shortcutName: pkg.productName,
  },
  linux: {
    executableName: 'deepseek-desktop',
    category: 'Utility',
    maintainer: 'tangjiahui-cn <tangjiahui-cn@users.noreply.github.com>',
    synopsis: 'DeepSeek chat desktop client',
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] },
    ],
    icon: 'build/icon.png',
  },
}
