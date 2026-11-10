import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from 'cordis'
import Database from '@cordisjs/plugin-database'
import Sqlite from '@cordisjs/plugin-database-sqlite'
import { Config } from '../src/config'
import { Game } from '../src/game'
import { defineModels } from '../src/models'
import type { Actor } from '../src/types'

const actor: Actor = { platform: 'onebot', channelId: 'group-a', groupName: '测试群 A', userId: 'alice', name: '甲' }
const bob = { userId: 'bob', name: '乙' }
let ctx: Context
let now: number
let random: ReturnType<typeof vi.fn<() => number>>
let config: Config
let game: Game

beforeEach(async () => {
  ctx = new Context()
  await ctx.plugin(Database)
  await ctx.plugin(Sqlite, { path: ':memory:' })
  defineModels(ctx)
  now = 100_000
  random = vi.fn(() => 0.5)
  config = Config()
  game = new Game(ctx.database, config, random, () => now)
})
afterEach(async () => { await ctx.fiber.dispose() })

async function initialize() {
  const result = await game.play(actor, actor, 'train')
  now += 5000
  return result
}

describe('真实 SQLite 游戏事务', () => {
  it('默认配置保留原始数值规则', () => {
    expect(config).toMatchObject({ initialLength: 18, initialVariance: 45, growth: 10, setback: 12, cooldownSeconds: 5, rankingLimit: 15 })
    expect(() => Config({ ...config, cooldownSeconds: -1 })).toThrow()
    expect(() => Config({ ...config, rankingLimit: 100 })).toThrow()
    expect(() => new Game(ctx.database, { ...config, rates: [{ min: 3, max: 2, rate: 80 }] })).toThrow('下限')
  })

  it('首次仅初始化，查询不创建玩家，初始化有冷却', async () => {
    expect(await game.profile(actor, actor.userId)).toMatchObject({ kind: 'profile', player: undefined })
    expect(await ctx.database.get('impart_players', {})).toHaveLength(0)
    const initial = await game.play(actor, actor, 'mine')
    expect(initial).toMatchObject({ kind: 'initialized', player: { length: 1800, growthFactor: 0.5, lastActionAt: now } })
    expect(await game.play(actor, actor, 'train')).toMatchObject({ kind: 'cooldown', seconds: 5 })
  })

  it('帮助他人时依次初始化目标和发起者', async () => {
    expect(await game.play(actor, bob, 'train')).toMatchObject({ kind: 'initialized', player: { userId: 'bob' } })
    expect(await ctx.database.get('impart_players', {})).toHaveLength(1)
    expect(await game.play(actor, bob, 'train')).toMatchObject({ kind: 'initialized', player: { userId: 'alice' } })
    expect(await game.play(actor, bob, 'train')).toMatchObject({ kind: 'cooldown' })
  })

  it('成功打胶增长，挖矿反向减少并允许负长度', async () => {
    await initialize()
    expect(await game.play(actor, actor, 'train')).toMatchObject({ kind: 'changed', success: true, delta: 1500, player: { length: 3300 } })
    now += 5000
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ delta: -1500, player: { length: 1800 } })
    now += 5000
    await game.play(actor, actor, 'mine')
    now += 5000
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ player: { length: -1200 } })
  })

  it('失败反向变化且不乘系数，失败也消耗冷却', async () => {
    await initialize()
    random.mockReturnValueOnce(0.99)
    expect(await game.play(actor, actor, 'train')).toMatchObject({ success: false, delta: -1200, player: { length: 600 } })
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ kind: 'cooldown' })
    await ctx.database.set('impart_players', {}, { length: -1800 })
    now += 5000
    random.mockReturnValueOnce(0.99)
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ success: false, delta: 1200, player: { length: -600 } })
  })

  it('帮助他人仅改目标长度，但双方共用跨群冷却', async () => {
    await game.play(actor, bob, 'train')
    await game.play(actor, bob, 'train')
    now += 5000
    expect(await game.play(actor, bob, 'train')).toMatchObject({ player: { userId: 'bob', length: 3300 } })
    expect(await game.profile(actor, actor.userId)).toMatchObject({ player: { length: 1800, lastActionAt: now } })
    expect(await game.play({ ...actor, channelId: 'group-b' }, actor, 'mine')).toMatchObject({ kind: 'cooldown' })
    expect(await game.play({ ...actor, ...bob, channelId: 'group-b' }, bob, 'mine')).toMatchObject({ kind: 'cooldown' })
  })

  it('冷却向上取整，目标冷却也必须完成', async () => {
    await game.play(actor, actor, 'train')
    now += 4001
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ kind: 'cooldown', seconds: 1 })
    await game.play(actor, bob, 'train')
    now += 1000
    expect(await game.play(actor, bob, 'mine')).toMatchObject({ kind: 'cooldown', userId: 'bob', seconds: 4 })
  })

  it('并发交替操作不能绕过冷却', async () => {
    await initialize()
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => game.play(actor, actor, i % 2 ? 'mine' : 'train')))
    expect(results.filter((result) => result.kind === 'changed')).toHaveLength(1)
    expect(results.filter((result) => result.kind === 'cooldown')).toHaveLength(9)
  })

  it('零冷却并发操作无丢失更新', async () => {
    game = new Game(ctx.database, { ...config, cooldownSeconds: 0, rates: [{ min: -1e12, max: 1e12, rate: 100 }] }, random, () => now)
    await initialize()
    await Promise.all(Array.from({ length: 20 }, () => game.play(actor, actor, 'train')))
    expect(await game.profile(actor, actor.userId)).toMatchObject({ player: { length: 31800 } })
  })

  it('同一平台跨群共享数值，不同平台互不串号', async () => {
    await initialize()
    const otherGroup = { ...actor, channelId: 'group-b' }
    expect(await game.play(otherGroup, actor, 'train')).toMatchObject({ kind: 'changed', player: { length: 3300 } })
    expect(await game.profile(actor, actor.userId)).toMatchObject({ player: { length: 3300 } })
    expect(await game.play({ ...actor, platform: 'telegram' }, actor, 'mine')).toMatchObject({ kind: 'initialized', player: { length: 1800 } })
    expect(await ctx.database.get('impart_players', {})).toHaveLength(2)
  })

  it('群开关幂等，关闭阻止操作和查询，不影响其他群和存量数据', async () => {
    await initialize()
    await game.party(actor, false)
    await game.party(actor, false)
    expect(await game.play(actor, actor, 'train')).toEqual({ kind: 'closed' })
    expect(await game.profile(actor, actor.userId)).toEqual({ kind: 'closed' })
    expect(await game.ranking(actor, 'length')).toBeUndefined()
    expect(await game.profile({ ...actor, channelId: 'group-b' }, actor.userId)).toMatchObject({ player: { length: 1800 } })
    const groupId = JSON.stringify([actor.platform, actor.channelId])
    expect(await game.rankingView(groupId, 'length')).toMatchObject({ players: [{ length: 1800 }] })
    await game.party(actor, true)
    await game.party(actor, true)
    expect(await game.profile(actor, actor.userId)).toMatchObject({ player: { length: 1800, lastActionAt: 100_000 } })
  })

  it('新群默认关闭时不初始化，管理员仍能显式开启', async () => {
    game = new Game(ctx.database, { ...config, defaultEnabled: false }, random, () => now)
    expect(await game.play(actor, actor, 'mine')).toEqual({ kind: 'closed' })
    expect(await ctx.database.get('impart_players', {})).toHaveLength(0)
    await game.party(actor, true)
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ kind: 'initialized' })
  })

  it('榜单排序相反、同值稳定，只包含所选群的历史参与者', async () => {
    await initialize()
    await game.play(actor, bob, 'train')
    await ctx.database.set('impart_players', { userId: 'bob' }, { length: -2500 })
    await game.play({ ...actor, channelId: 'group-b', userId: 'carol', name: '丙' }, { userId: 'carol', name: '丙' }, 'train')
    expect((await game.ranking(actor, 'length'))?.players.map((player) => player.userId)).toEqual(['alice', 'bob'])
    expect((await game.ranking(actor, 'mining'))?.players.map((player) => player.userId)).toEqual(['bob', 'alice'])
    expect((await game.ranking({ ...actor, channelId: 'empty' }, 'length'))?.players).toEqual([])
  })

  it('全平台榜遵守平台隔离及人数限制，不绕过当前群关闭', async () => {
    await initialize()
    await game.play({ ...actor, platform: 'telegram' }, actor, 'train')
    game = new Game(ctx.database, { ...config, allChannels: true, rankingLimit: 1 }, random, () => now)
    expect((await game.ranking({ ...actor, channelId: 'new' }, 'length'))?.players).toHaveLength(1)
    await game.party(actor, false)
    expect(await game.ranking(actor, 'length')).toBeUndefined()
  })

  it('事务错误回滚，队列失败后仍可继续操作', async () => {
    await initialize()
    game = new Game(ctx.database, { ...config, rates: [{ min: -1e12, max: 1e12, rate: 100 }] }, () => 0, () => now)
    await ctx.database.set('impart_players', {}, { length: Number.MAX_SAFE_INTEGER })
    await expect(game.play(actor, actor, 'train')).rejects.toThrow('安全数值')
    expect(await game.profile(actor, actor.userId)).toMatchObject({ player: { length: Number.MAX_SAFE_INTEGER, lastActionAt: 100_000 } })
    await ctx.database.set('impart_players', {}, { length: 1800 })
    expect(await game.play(actor, actor, 'train')).toMatchObject({ kind: 'changed' })
  })

  it('重建业务实例保留长度、冷却与群状态', async () => {
    await game.play(actor, actor, 'train')
    const replacement = new Game(ctx.database, config, random, () => now)
    expect(await replacement.play(actor, actor, 'mine')).toMatchObject({ kind: 'cooldown' })
    await replacement.party(actor, false)
    expect(await new Game(ctx.database, config).profile(actor, actor.userId)).toEqual({ kind: 'closed' })
  })
})
