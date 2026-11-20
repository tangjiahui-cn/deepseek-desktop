import { readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { build } from 'esbuild'

const root = path.resolve(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))

const repository =
  typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository?.url ?? '')
const match = /github\.com[/:]([^/]+)\/([^/.]+)(?:\.git)?/.exec(repository)
if (!match) {
  throw new Error(`package.json repository must point at a GitHub repository: ${repository}`)
}
const [, owner, repo] = match

if (!pkg.appId || !pkg.productName) {
  throw new Error('package.json must define appId and productName')
}

const apiOrigin = process.env.API_ORIGIN ?? 'https://api.deepseek.com'
const outdir = path.join(root, 'electron/dist')
rmSync(outdir, { recursive: true, force: true })

await build({
  entryPoints: [path.join(root, 'electron/main.ts'), path.join(root, 'electron/preload.ts')],
  outdir,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  outExtension: { '.js': '.cjs' },
  sourcemap: false,
  legalComments: 'none',
  define: {
    __API_ORIGIN__: JSON.stringify(apiOrigin),
    __APP_ID__: JSON.stringify(pkg.appId),
    __PRODUCT_NAME__: JSON.stringify(pkg.productName),
    __GITHUB_OWNER__: JSON.stringify(owner),
    __GITHUB_REPO__: JSON.stringify(repo),
    __UPDATER_CACHE_DIR__: JSON.stringify(`${pkg.name}-updater`),
  },
  logLevel: 'info',
})

console.log(`[build:electron] built main/preload for ${owner}/${repo} -> ${path.relative(root, outdir)}`)
