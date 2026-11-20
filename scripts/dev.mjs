import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(import.meta.dirname, '..')
const bin = (name) =>
  path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? `${name}.cmd` : name)
const port = 8090
const children = new Set()

const run = (command, args, options = {}) => {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  })
  children.add(child)
  child.on('exit', () => children.delete(child))
  return child
}

const stopAll = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM')
    }
  }
}

const waitForPort = (targetPort, timeoutMs) =>
  new Promise((resolve, reject) => {
    const startedAt = Date.now()
    const attempt = () => {
      const socket = net.createConnection({ host: '127.0.0.1', port: targetPort })
      socket.once('connect', () => {
        socket.destroy()
        resolve()
      })
      socket.once('error', () => {
        socket.destroy()
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`dev server did not start on port ${targetPort}`))
          return
        }
        setTimeout(attempt, 150)
      })
    }
    attempt()
  })

const buildElectron = () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/build-electron.mjs')], {
    cwd: root,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error('failed to build Electron main process')
  }
}

process.on('SIGINT', () => {
  stopAll()
  process.exit(0)
})
process.on('SIGTERM', () => {
  stopAll()
  process.exit(0)
})
process.on('exit', stopAll)

buildElectron()

const devServer = run(bin('rspack'), ['serve', '-c', 'rspack.config.ts'])
devServer.on('exit', (code) => {
  if (code !== 0) {
    stopAll()
    process.exit(code ?? 1)
  }
})

try {
  await waitForPort(port, 60_000)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  stopAll()
  process.exit(1)
}

const electronEnv = { ...process.env, ELECTRON_RENDERER_URL: `http://localhost:${port}` }
const extraArgs = (process.env.ELECTRON_EXTRA_ARGS ?? '').split(/\s+/).filter(Boolean)
// 某些终端环境会预设 ELECTRON_RUN_AS_NODE，那会让 Electron 以 Node 模式启动
delete electronEnv.ELECTRON_RUN_AS_NODE

const electron = run(bin('electron'), ['.', ...extraArgs], { env: electronEnv })
electron.on('exit', (code) => {
  stopAll()
  process.exit(code ?? 0)
})
