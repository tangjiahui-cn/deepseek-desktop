# AGENTS.md

本文件约束在此仓库工作的编码代理。开发细节见 `docs/development.md`；本文件与其冲突时，以本文件为准。

## 项目概览

DeepSeek Desktop 是基于 DeepSeek API 的聊天应用：同一套 React 界面运行在 Web 与 Electron，没有自建后端，客户端直连用户配置的 API。规格与变更由 OpenSpec 管理。

## 常用命令

| 目的 | 命令 |
| --- | --- |
| 安装依赖 | `pnpm install` |
| 类型检查 | `pnpm type` |
| Lint | `pnpm lint` |
| 格式化指定文件 | `pnpm exec oxfmt --write <files>` |
| Web 构建 | `pnpm build` |
| 桌面构建 | `pnpm build:desktop` |
| 本地 Web | `pnpm dev:web`（http://localhost:8090） |
| 本地桌面 | `pnpm dev` |

## 必须遵循

1. **规划与实现分离**：OpenSpec 的 propose / update 只写 `openspec/` 下的规划产物，不改代码；代码实现由 `openspec-apply-change` 执行。
2. **完成即验证**：代码改动至少通过 `pnpm type` 与 `pnpm lint`；涉及构建或 UI 时再运行 `pnpm build`。
3. **UI 变更必须提供图片证据**：`openspec-apply-change` 成功后，所有 UI 类修改都必须截图作为验收证据；按需覆盖桌面端、移动端与关键状态。
4. **证据与临时脚本不提交**：截图、验证脚本放在 `tmp/evidence/` 或 `tmp/` 下（`tmp/` 已被忽略），只供临时查看；禁止提交，禁止 `git add -f`。若要放到其他目录，先把该目录加入 `.gitignore`。
5. **不改无关文件**：只触碰任务相关代码；不顺手重构、不格式化全仓、不改生成物。
6. **不提交生成物**：`node_modules/`、`dist/`、`electron/dist/`、`release/`、`tmp/`、`.cache/` 均已在忽略列表。
7. **提交与推送需明确指令**：用户未要求时不要 `git commit` 或 `git push`；提交信息沿用仓库的 conventional commits 风格（如 `feat: ...`、`chore: ...`）。

## 版本与发布

- 版本号 SHALL 遵循 SemVer 2.0.0：不兼容变更升 MAJOR，向后兼容的新功能升 MINOR，向后兼容的修复升 PATCH。
- 当前处于 0.x：新功能与不兼容调整升 MINOR（如 `0.2.0 → 0.3.0`），修复升 PATCH（如 `0.2.0 → 0.2.1`）；升级到 1.0 后，不兼容变更才升 MAJOR。
- 发布时 `package.json` 的 `version` 必须与 Git tag 完全一致：tag 形如 `v<version>`，例如 `package.json` 为 `0.2.0` 时 tag 必须是 `v0.2.0`。
- 发布流程：更新 `package.json` → 提交 → 打 tag → 推送 `main` 与 tag；tag 会触发 release workflow，tag 与 `version` 不一致会导致校验失败。
- 已推送的版本 tag 不得移动、删除或复用；需要修正时发布新的补丁版本。

## 代码约定

- TypeScript ESM；相对导入带 `.js` 后缀（rspack 的 extensionAlias 会映射到 `.ts` / `.tsx`）。
- React 18 函数组件 + hooks；跨组件状态使用 zustand。
- 所有用户可见文案必须同时更新 `src/i18n/zh.ts` 与 `src/i18n/en.ts`，保持 key 一致。
- 使用 CSS Modules；新增类名时同步更新对应的 `.module.css.d.ts`。
- 注释沿用现有中文风格；不要引入与现有风格冲突的注释。
- 项目没有测试框架；需要验证交互时，在 `tmp/` 下写临时 Node / 无头 Chrome 脚本，验证完不要提交。

## OpenSpec

- 变更目录：`openspec/changes/<name>/`；主规格：`openspec/specs/<capability>/spec.md`。
- 规划完成后运行 `openspec validate <change> --strict`。
- 归档前确认任务全部完成，并使用 `openspec-archive-change` 把 delta 同步进主规格。
