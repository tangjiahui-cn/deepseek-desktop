import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
rmSync(path.join(root, 'dist'), { recursive: true, force: true })

const rspack = path.join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'rspack.cmd' : 'rspack'
)
const result = spawnSync(rspack, ['build', '-c', 'rspack.config.ts'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, NODE_ENV: 'production' },
})
process.exit(result.status ?? 1)
