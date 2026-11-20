/**
 * 桌面端身份与固定地址。
 *
 * APP_ORIGIN 一经发布不可修改：localStorage 与 IndexedDB 都按 origin 隔离，
 * 改动它等同于让所有用户的历史会话「消失」。appId、productName 与仓库地址
 * 都来自 package.json，由 scripts/build-electron.mjs 在构建期注入。
 */
export const APP_SCHEME = 'app'
export const APP_HOST = 'deepseek'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`

export const APP_ID = __APP_ID__
export const PRODUCT_NAME = __PRODUCT_NAME__
/** 界面显示名；PRODUCT_NAME 继续作为安装包与 userData 的稳定身份 */
export const DISPLAY_NAME = 'DeepSeek'
export const GITHUB_OWNER = __GITHUB_OWNER__
export const GITHUB_REPO = __GITHUB_REPO__

export const RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`
export const releasePageUrl = (version: string) => `${RELEASES_URL}/tag/v${version}`
