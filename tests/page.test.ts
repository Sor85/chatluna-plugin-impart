import { beforeEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Overview, RankingView } from '../src/types'

const mocks = vi.hoisted(() => ({ live: vi.fn(), party: Object.assign(vi.fn(), { pending: false, offline: false }) }))
vi.mock('@chatluna/ui-client/client', () => ({
  useLive: mocks.live,
  useAction: () => mocks.party,
  useTranslate: () => (key: string) => key
}))
import { ImpartPage } from '../client/page'

const group = { id: 'one', platform: 'onebot', channelId: '123', name: '测试群', enabled: true }
const overview: Overview = { groups: [group], truncated: false }
const ranking: RankingView = {
  group, order: 'length', allChannels: false,
  players: [{ id: 'p', userId: '456', name: '<script>alert(1)</script>', length: -1200, growthFactor: 0.25 }]
}

beforeEach(() => {
  mocks.live.mockReset()
  mocks.party.pending = false
})

it('真实 ui-kit 渲染空态，页面有独立排版基线', () => {
  mocks.live.mockReturnValue({ status: 'ready', data: { groups: [] } })
  const html = renderToStaticMarkup(createElement(ImpartPage))
  expect(html).toContain('empty.title')
  expect(html).toContain('text-sm leading-6')
})

it('真实 ui-kit 表格显示负号、精度并转义昵称', () => {
  mocks.live.mockImplementation((key: string) => ({ status: 'ready', data: key === 'impart.groups' ? overview : ranking }))
  const html = renderToStaticMarkup(createElement(ImpartPage))
  expect(html).toContain('-12.00 cm')
  expect(html).toContain('0.25')
  expect(html).toContain('&lt;script&gt;')
  expect(html).not.toContain('<script>alert')
  expect(html).toContain('data-slot="table"')
})

it('暂停状态保留数据并展示明确说明', () => {
  mocks.live.mockImplementation((key: string) => ({ status: 'ready', data: key === 'impart.groups' ? { ...overview, groups: [{ ...group, enabled: false }] } : ranking }))
  const html = renderToStaticMarkup(createElement(ImpartPage))
  expect(html).toContain('paused.title')
  expect(html).toContain('paused.hint')
  expect(html).toContain('-12.00 cm')
})

it('加载与失败状态独立可见', () => {
  mocks.live.mockReturnValue({ status: 'loading' })
  expect(renderToStaticMarkup(createElement(ImpartPage))).toContain('data-slot="skeleton"')
  mocks.live.mockReturnValue({ status: 'error', error: '加载失败测试', data: undefined })
  expect(renderToStaticMarkup(createElement(ImpartPage))).toContain('加载失败测试')
})
