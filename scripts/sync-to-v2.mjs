#!/usr/bin/env node
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, watch } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const host = resolve(process.env.CHATLUNA_V2_ROOT ?? join(source, '../../chatluna-v2-mirror'))
const target = join(host, 'external/impart')
const files = ['package.json', 'tsconfig.json', 'tsconfig.client.json', 'tsconfig.test.json', 'vitest.config.ts', 'README.md', 'LICENSE', 'AGENTS.md', 'src', 'client', 'tests', 'scripts', '.agents']
if (!existsSync(join(host, 'package.json'))) throw new Error(`未找到 V2 宿主：${host}`)
for (const path of [host, join(host, 'external'), target]) {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) throw new Error(`目标不能包含符号链接：${path}`)
}
if (existsSync(target)) {
  if (realpathSync(target) === realpathSync(source)) throw new Error('不能同步到源码自身')
  const manifest = join(target, 'package.json')
  if (!existsSync(manifest) || JSON.parse(readFileSync(manifest, 'utf8')).name !== 'chatluna-plugin-impart') {
    throw new Error('目标不是本插件的开发副本')
  }
}
function checkTree(path) {
  if (lstatSync(path).isSymbolicLink()) throw new Error(`拒绝符号链接：${path}`)
  if (lstatSync(path).isDirectory()) for (const item of readdirSync(path)) checkTree(join(path, item))
}
function sync() {
  for (const item of files) {
    const from = join(source, item)
    if (!existsSync(from)) continue
    checkTree(from)
    const to = join(target, item)
    if (existsSync(to)) checkTree(to)
    mkdirSync(target, { recursive: true })
    cpSync(from, to, { recursive: true, preserveTimestamps: true, filter: (path) => !path.split('/').some((part) => part.startsWith('.env')) })
  }
  console.log(`已同步至 ${target}`)
}
sync()
if (!process.argv.includes('--once')) {
  let timer
  const watcher = watch(source, { recursive: true }, (_event, filename) => {
    if (!filename || !files.includes(String(filename).split('/')[0])) return
    clearTimeout(timer)
    timer = setTimeout(() => { try { sync() } catch (error) { console.error(error.message) } }, 150)
  })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    clearTimeout(timer)
    watcher.close()
    process.exit(0)
  })
}
