import { beforeEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { WidgetSize } from '@chatluna/ui-client/client'
import type { Stats } from '../src/types'

const mocks = vi.hoisted(() => ({ live: vi.fn() }))
vi.mock('@chatluna/ui-client/client', () => ({
  useLive: mocks.live,
  useTranslate: () => (key: string, params?: Record<string, unknown>) => params ? `${key}|${Object.entries(params).join('|')}` : key
}))
import { ImpartStatsWidget } from '../client/dashboard'

const render = (size: WidgetSize) => renderToStaticMarkup(createElement(ImpartStatsWidget, { size }))

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

beforeEach(() => mocks.live.mockReset())

it('各尺寸渲染空态，根容器有独立排版基线', () => {
  mocks.live.mockReturnValue({ status: 'loading', data: undefined })
  for (const size of ['sm', 'md', 'lg', 'xl'] as const) {
    const html = render(size)
    expect(html).toContain('text-sm leading-6')
    expect(html).toContain('tabular-nums">0</dd>')
    if (size === 'sm') expect(html).not.toContain('empty')
    else expect(html).toContain('empty')
  }
})

it('小尺寸只显示总数', () => {
  mocks.live.mockReturnValue({ status: 'ready', data: stats })
  const html = render('sm')
  expect(html).toContain('tabular-nums">12</dd>')
  expect(html).toContain('tabular-nums">4</dd>')
  expect(html).not.toContain('测试群')
  expect(html).not.toContain('hidden')
})

it('中尺寸每群列出两种玩法的第一名，缺记录显示占位', () => {
  mocks.live.mockReturnValue({ status: 'ready', data: stats })
  const html = render('md')
  expect(html).toMatch(/topLength.*topDepth/)
  expect(html).toContain('测试群')
  expect(html).toContain('disabled')
  expect(html).toContain('32.81 cm')
  expect(html).not.toContain('-21.00 cm')
  expect(html).toContain('>—</td>')
  expect(html).toContain('hidden|count,1')
})

it('大尺寸按群分别列出长度与深度名次、省略中间名次、有符号数值、暂停状态和未显示群数，并转义昵称', () => {
  mocks.live.mockReturnValue({ status: 'ready', data: stats })
  for (const size of ['lg', 'xl'] as const) {
    const html = render(size)
    expect(html).toContain('onebot · 30001')
    expect(html).toContain('tabular-nums">12</dd>')
    expect(html).toMatch(/>length<.*groupPlayers\|count,12.*>depth<.*groupPlayers\|count,0.*boardEmpty/)
    expect(html).toContain('disabled')
    expect(html).toContain('omitted|count,10')
    expect(html).toContain('32.81 cm')
    expect(html).toContain('-21.00 cm')
    expect(html).toContain('right:50%;width:32.00')
    expect(html).toContain('hidden|count,1')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert')
  }
  expect(render('xl')).toContain('@2xl:grid-cols-2')
  expect(render('lg')).not.toContain('@2xl:grid-cols-2')
})
