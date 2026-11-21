import { afterEach, expect, it } from 'vitest'
import { Context } from 'cordis'
import Takumi, { Config as TakumiConfig } from 'chatluna-plugin-takumi'
import { rankingNode, rankingText, renderRanking } from '../src/render'
import type { Ranking } from '../src/types'

const ranking: Ranking = {
  group: { id: 'test', platform: 'onebot', channelId: 'test', name: '图片测试群', enabled: true },
  allChannels: false,
  order: 'mining',
  players: [{ id: 'a', platform: 'onebot', userId: '123', name: '测试玩家 <img src="http://127.0.0.1/secret"/>', length: 100, depth: -2345, growthFactor: 0.5, depthFactor: 0.25, lastActionAt: 0 }]
}

const hosts: Context[] = []
afterEach(async () => {
  for (const ctx of hosts.splice(0)) await ctx.fiber.dispose()
})

async function takumi() {
  const ctx = new Context()
  hosts.push(ctx)
  await ctx.plugin(Takumi, TakumiConfig.parse({}))
  return ctx.takumi
}

it('Takumi 服务实际输出 PNG，尺寸正确，中文字库离线可用', async () => {
  const png = await renderRanking(await takumi(), ranking, new AbortController().signal)
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(png.readUInt32BE(16)).toBe(960)
  expect(png.readUInt32BE(20)).toBe(386)
  expect(png.length).toBeGreaterThan(5000)
})

it('昵称只进入文本节点，不创建外部资源节点', () => {
  expect(JSON.stringify(rankingNode(ranking))).not.toContain('"type":"image"')
  expect(rankingText(ranking)).toContain('-23.45 cm')
  expect(rankingText({ ...ranking, order: 'length' })).toContain('1.00 cm')
  expect(rankingText(ranking)).toContain('挖矿排行榜')
})

it('取消后不再渲染', async () => {
  const lifetime = new AbortController()
  lifetime.abort()
  await expect(renderRanking(await takumi(), ranking, lifetime.signal)).rejects.toThrow()
})
