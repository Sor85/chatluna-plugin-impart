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
  expect(html).toContain('tabular-nums">0</dd>')
})

it('按群分别列出长度与深度名次、省略中间名次、有符号数值、暂停状态和未显示群数，并转义昵称', () => {
  const stats: Stats = {
    trainers: 12, miners: 4, groups: 3, openGroups: 2, hidden: 1,
    ranked: [{
      id: 'g', platform: 'onebot', channelId: '30001', name: '测试群', enabled: false,
      length: {
        players: 12,
        entries: [
          { rank: 1, userId: '1', name: '甲', value: 3281 },
          { rank: 12, userId: '2', name: '<script>alert(1)</script>', value: -2100 }
        ]
      },
      depth: { players: 0, entries: [] }
    }]
  }
  mocks.live.mockReturnValue({ status: 'ready', data: stats })
  const html = renderToStaticMarkup(createElement(ImpartStatsCard))
  expect(html).toContain('onebot · 30001')
  expect(html).toContain('tabular-nums">12</dd>')
  expect(html).toContain('tabular-nums">4</dd>')
  expect(html).toMatch(/>length<.*groupPlayers\|count,12.*>depth<.*groupPlayers\|count,0.*boardEmpty/)
  expect(html).toContain('disabled')
  expect(html).toContain('omitted|count,10')
  expect(html).toContain('32.81 cm')
  expect(html).toContain('-21.00 cm')
  expect(html).toContain('right:50%;width:32.00')
  expect(html).toContain('hidden|count,1')
  expect(html).toContain('&lt;script&gt;')
  expect(html).not.toContain('<script>alert')
})
