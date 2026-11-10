import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

it('所有子目录说明已登记，登记路径存在', () => {
  const guide = readFileSync(join(root, 'AGENTS.md'), 'utf8')
  const listed = [...guide.matchAll(/`([^`]+\/AGENTS\.md)`/g)].map((match) => match[1]).sort()
  const actual: string[] = []
  for (const scope of ['src', 'client', 'scripts', 'tests']) {
    function walk(path: string) {
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        const file = join(path, entry.name)
        if (entry.isDirectory()) walk(file)
        else if (entry.name === 'AGENTS.md') actual.push(relative(root, file))
      }
    }
    walk(join(root, scope))
  }
  expect(listed).toEqual(actual.sort())
  for (const path of listed) expect(readFileSync(join(root, path), 'utf8')).toContain('根 `AGENTS.md`')
})

it('无已移除命令、货币依赖、自定义字体入口或鼠标指针覆盖', () => {
  const commands = readFileSync(join(root, 'src/commands.ts'), 'utf8')
  for (const removed of ['保养', '牛牛决斗', '重开牛牛', '锁牛牛', '注入', '开启牛牛大作战', '关闭牛牛大作战']) expect(commands).not.toContain(removed)
  const manifest = readFileSync(join(root, 'package.json'), 'utf8')
  for (const removed of ['puppeteer', 'monetary', 'glyph']) expect(manifest).not.toContain(removed)
  expect(readFileSync(join(root, 'src/config.ts'), 'utf8')).not.toContain('fontPath')
  const card = readFileSync(join(root, 'client/dashboard.tsx'), 'utf8')
  expect(card).not.toMatch(/cursor[:\s-]/)
  expect(card).toContain('text-sm leading-6')
})

it('客户端源入口依赖的共享源码随包分发', () => {
  const manifest: { files: string[] } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  expect(manifest.files).toContain('src')
  expect(manifest.files).toContain('client')
  expect(manifest.files).toContain('dist')
})

it('中文英文界面文案的键一致', () => {
  const keys = (lang: string) => readFileSync(join(root, `client/locales/${lang}.yml`), 'utf8').split('\n').filter(Boolean).map((line) => line.split(':')[0]).sort()
  expect(keys('zh')).toEqual(keys('en'))
})
