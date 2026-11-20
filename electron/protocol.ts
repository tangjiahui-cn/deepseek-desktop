import { protocol } from 'electron'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { APP_HOST, APP_SCHEME } from './constants'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.pdf': 'application/pdf',
}

const mimeType = (filePath: string) =>
  MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream'

const isInside = (root: string, candidate: string) =>
  candidate === root || candidate.startsWith(root + path.sep)

/**
 * 在 app ready 之前调用。standard + secure 让 localStorage / IndexedDB 可用，
 * 同时让页面处于安全上下文，getUserMedia、clipboard 等能力才可用。
 */
export const registerAppScheme = () => {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: APP_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])
}

const contentSecurityPolicy = (apiOrigin: string) =>
  [
    "default-src 'self'",
    "script-src 'self'",
    // KaTeX / Mermaid 会写内联样式
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    'font-src \'self\' data:',
    `connect-src 'self' ${apiOrigin}`,
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ')

const textResponse = (status: number, body: string) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
  })

/**
 * 把 renderer 构建产物挂到 app://deepseek/。
 *
 * 路径必须落在 rendererRoot 内：URL 里的 .. 与百分号编码都先还原再校验，
 * 越界请求返回 403，而不是静默回退到 index.html。
 */
export const registerAppProtocol = (rendererRoot: string, apiOrigin: string) => {
  const root = path.resolve(rendererRoot)
  const origin = apiOrigin.replace(/\/+$/, '')

  protocol.handle(APP_SCHEME, async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return textResponse(405, 'Method Not Allowed')
    }

    let url: URL
    try {
      url = new URL(request.url)
    } catch {
      return textResponse(400, 'Bad Request')
    }
    if (url.host !== APP_HOST) {
      return textResponse(404, 'Not Found')
    }

    let pathname: string
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return textResponse(400, 'Bad Request')
    }
    if (pathname.includes('\0')) {
      return textResponse(400, 'Bad Request')
    }

    const relative = pathname.replace(/^\/+/, '') || 'index.html'
    let filePath = path.resolve(root, relative)
    if (!isInside(root, filePath)) {
      return textResponse(403, 'Forbidden')
    }

    try {
      const info = await stat(filePath)
      if (info.isDirectory()) {
        filePath = path.join(filePath, 'index.html')
      }
    } catch {
      // 没有扩展名的路径按前端路由处理，其余缺失资源直接 404。
      if (path.extname(relative) !== '') {
        return textResponse(404, 'Not Found')
      }
      filePath = path.join(root, 'index.html')
    }

    if (!isInside(root, filePath)) {
      return textResponse(403, 'Forbidden')
    }

    let body: Buffer
    try {
      body = await readFile(filePath)
    } catch {
      return textResponse(404, 'Not Found')
    }

    const type = mimeType(filePath)
    const isHtml = path.extname(filePath).toLowerCase() === '.html'
    const headers: Record<string, string> = {
      'Content-Type': type,
      'Content-Length': String(body.byteLength),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': isHtml
        ? 'no-cache'
        : relative.includes('static/')
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
    }
    if (isHtml) {
      headers['Content-Security-Policy'] = contentSecurityPolicy(origin)
    }

    return new Response(request.method === 'HEAD' ? null : new Uint8Array(body), {
      status: 200,
      headers,
    })
  })
}
