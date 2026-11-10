import { beforeEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Stats } from '../src/types'

const mocks = vi.hoisted(() => ({ live: vi.fn() }))
vi.mock('@chatluna/ui-client/client', () => ({
  useLive: mocks.live,
  useTranslate: () => (key: string, params?: Record<string, unknown>) => params ? `${key}|${Object.entries(params).join('|')}` : key
}))
import { ImpartStatsCard } from '../client/dashboard'

beforeEach(() => mocks.live.mockReset())

it('真实 ui-kit 渲染空态，卡片有独立排版基线', () => {
  mocks.live.mockReturnValue({ status: 'loading', data: undefined })
  const html = renderToStaticMarkup(createElement(ImpartStatsCard))
  expect(html).toContain('empty')
  expect(html).toContain('text-sm leading-6')
  expect(html).toContain('players,0')
})

it('显示统计、有符号长度并转义昵称', () => {
  const stats: Stats = {
    players: 2, groups: 3, openGroups: 2,
    longest: { platform: 'onebot', userId: '1', name: '甲', length: 3281 },
    deepest: { platform: 'onebot', userId: '2', name: '<script>alert(1)</script>', length: -2100 }
  }
  mocks.live.mockReturnValue({ status: 'ready', data: stats })
  const html = renderToStaticMarkup(createElement(ImpartStatsCard))
  expect(html).toContain('summary|players,2|open,2|groups,3')
  expect(html).toContain('32.81 cm')
  expect(html).toContain('-21.00 cm')
  expect(html).toContain('&lt;script&gt;')
  expect(html).not.toContain('<script>alert')
})
