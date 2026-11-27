# Tasks

## 1. 文案与图标

- [x] 1.1 在 `src/i18n/zh.ts` 与 `src/i18n/en.ts` 新增「书签」标签页、书签空状态与引导文案、添加/移除书签提示、保存失败提示、失效/跳转失败/生成中跳转提示、相对时间文案，保持中英文 key 完全一致；运行 `pnpm type`
- [x] 1.2 在 `src/components/base/icons.tsx` 新增 16px 空心与实心书签图标，沿用现有 `currentColor`、1.2px 描边风格；运行 `pnpm type`

## 2. 书签数据层

- [x] 2.1 在 `src/services/chat/types.ts` 增加书签记录类型；在 `src/services/chat/db.ts` 将数据库版本升到 12，新增 `bookmarks` 对象仓库与 `sessionId` 索引，提供按 `messageId` 读写删、按 `sessionId` 批量删、清空与全量读取接口；运行 `pnpm type`
- [x] 2.2 新增书签 zustand store 与摘要提取工具：内存按保存时间倒序维护 `items` 与 `byMessageId`，支持初始化、乐观添加/移除（失败回滚并抛错）、失效会话清理、继续生成后刷新摘要；运行 `pnpm type` 与 `pnpm lint`
- [x] 2.3 在 `src/services/chat/store.ts` 的 `initChat` 中初始化书签并等待完成，保证会话 ready 时按钮状态稳定；运行 `pnpm type`
- [x] 2.4 在 `db.deleteSession` 事务中加入按 `sessionId` 删除书签；在 `db.commitStaging` 事务中清空书签；删除成功后同步移除内存书签，历史替换成功后重置书签状态，失败保留；确认删除确认弹窗文案未被修改；运行 `pnpm type` 与 `pnpm lint`

## 3. 回答操作区

- [x] 3.1 在 `AssistantMessage` 的朗读与重新生成之间加入书签按钮：仅对非流式且有正文的回答显示，空心/实心切换，使用 `aria-pressed`、提示与品牌色样式；在消息根节点加 `data-message-id`；运行 `pnpm type`
- [x] 3.2 接入添加/移除、toast、写入期间禁用与保存失败回滚提示；运行 `pnpm type` 与 `pnpm lint`
- [x] 3.3 用无头 Chrome 验证：空心点击后变实心、再点恢复空心；流式消息和无正文消息不显示按钮；截图保存到 `tmp/evidence/`

## 4. 侧栏书签标签页

- [x] 4.1 在 `Sider` 中扩展「全部 / 收藏夹 / 书签」三个标签页，书签页读取书签列表、无图标展示、空态与实时更新；切换标签不关闭当前会话；运行 `pnpm type`
- [x] 4.2 新增书签列表项组件与 CSS Module（含 `.d.ts`）：摘要最多两行、来源标题与保存时间、无前置图标、仅 hover/focus 反馈、无选中态；移动端字号与间距适配；运行 `pnpm type` 与 `pnpm build`
- [x] 4.3 实现相对时间显示与标签页激活时的每分钟刷新；重命名来源会话后标题立即更新；运行 `pnpm lint`
- [x] 4.4 用无头 Chrome 验证空态、添加第一条、移除最后一条、多条排序、无图标、来源重命名与移动端抽屉；截图保存到 `tmp/evidence/`

## 5. 分支定位与跳转

- [x] 5.1 在 `branches.ts` 新增 `revealMessage`：沿 `parentId` 回溯并逐级设置 `selectedChildId`，目标已在可见路径或链不完整时返回原对象；运行 `pnpm type`
- [x] 5.2 新增一次性跳转请求 store，并在 `chat/store.ts` 实现 `openBookmark`：切会话、等待详情、校验目标、隐藏分支生成中拦截、展开旧分支并保存、发起定位请求；运行 `pnpm type` 与 `pnpm lint`
- [x] 5.3 在 `MessageList` 消费定位请求：滚动到目标回答开头并保留 16px 间距，关闭 sticky，不添加高亮或选中态；移动端关闭抽屉；运行 `pnpm type`
- [x] 5.4 用无头 Chrome 验证同会话、跨会话、展开旧分支、目标缺失清理、生成中隐藏分支拦截，以及定位后无高亮/无选中；截图保存到 `tmp/evidence/`

## 6. 集成验证

- [x] 6.1 运行 `pnpm type`、`pnpm lint`、`pnpm build`，全部通过
- [x] 6.2 用无头 Chrome 验证书签刷新后保留、删除会话级联清理、其他会话书签不受影响、导入/清空历史清空书签、导出内容不包含书签、同一回答只保留一条记录；将关键截图与验证记录放到 `tmp/evidence/`
- [x] 6.3 截取桌面端书签列表、空心/实心按钮、定位结果、空态、移动端抽屉与暗色主题，确认视觉与现有界面一致

## Workflow follow-up

- 用户验收后使用 `openspec-archive-change` 归档并同步 `answer-bookmarks` 与 `sidebar-navigation` 主规格。
- 归档完成后按项目要求询问是否提交并发布，未确认前不提交、不推送、不发布。
