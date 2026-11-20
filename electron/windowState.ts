import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export const MIN_WINDOW_SIZE = { width: 960, height: 640 }
const DEFAULT_WINDOW_SIZE = { width: 1200, height: 800 }
/** 至少要露出这么多像素才算「可见」，避免窗口完全落在屏幕外 */
const MIN_VISIBLE = 120

export type WindowState = Rectangle

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const centered = (workArea: Rectangle, size: { width: number; height: number }): WindowState => ({
  width: size.width,
  height: size.height,
  x: Math.round(workArea.x + (workArea.width - size.width) / 2),
  y: Math.round(workArea.y + (workArea.height - size.height) / 2),
})

/** 校验持久化的窗口位置；落在所有屏幕之外或尺寸非法时回到主屏居中 */
export const validateWindowState = (value: unknown, workAreas: Rectangle[]): WindowState => {
  const primary = workAreas[0] ?? {
    x: 0,
    y: 0,
    width: DEFAULT_WINDOW_SIZE.width,
    height: DEFAULT_WINDOW_SIZE.height,
  }
  const fallback = centered(primary, DEFAULT_WINDOW_SIZE)
  if (!value || typeof value !== 'object') {
    return fallback
  }

  const candidate = value as Partial<WindowState>
  if (
    !isFiniteNumber(candidate.x) ||
    !isFiniteNumber(candidate.y) ||
    !isFiniteNumber(candidate.width) ||
    !isFiniteNumber(candidate.height)
  ) {
    return fallback
  }

  const largest = workAreas.reduce(
    (best, area) => (area.width * area.height > best.width * best.height ? area : best),
    primary
  )
  const width = Math.min(
    Math.max(MIN_WINDOW_SIZE.width, Math.round(candidate.width)),
    Math.max(MIN_WINDOW_SIZE.width, largest.width)
  )
  const height = Math.min(
    Math.max(MIN_WINDOW_SIZE.height, Math.round(candidate.height)),
    Math.max(MIN_WINDOW_SIZE.height, largest.height)
  )

  const bounds: WindowState = {
    x: Math.round(candidate.x),
    y: Math.round(candidate.y),
    width,
    height,
  }
  const visible = workAreas.some((area) => {
    const overlapX =
      Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x)
    const overlapY =
      Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y)
    return overlapX >= MIN_VISIBLE && overlapY >= MIN_VISIBLE
  })

  return visible ? bounds : centered(primary, { width, height })
}

const statePath = () => path.join(app.getPath('userData'), 'window-state.json')

export const loadWindowState = (): WindowState => {
  const primary = screen.getPrimaryDisplay().workArea
  const workAreas = [primary, ...screen.getAllDisplays().map((display) => display.workArea)]
  try {
    return validateWindowState(JSON.parse(readFileSync(statePath(), 'utf8')), workAreas)
  } catch {
    return validateWindowState(null, workAreas)
  }
}

const saveWindowState = (win: BrowserWindow) => {
  try {
    writeFileSync(statePath(), JSON.stringify(win.getNormalBounds()))
  } catch {
    // 写盘失败不影响本次使用，下次启动回到默认尺寸
  }
}

/** 移动/缩放时防抖保存，关闭窗口时立即保存一次 */
export const attachWindowState = (win: BrowserWindow) => {
  let timer: NodeJS.Timeout | undefined
  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => saveWindowState(win), 300)
  }
  win.on('resize', schedule)
  win.on('move', schedule)
  win.on('close', () => {
    clearTimeout(timer)
    saveWindowState(win)
  })
  win.on('closed', () => clearTimeout(timer))
}
