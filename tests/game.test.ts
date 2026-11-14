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
    expect(config).toMatchObject({ initialLengthMin: 0, initialLengthMax: 18, initialDepthMin: -18, initialDepthMax: 0, growth: 10, setback: 12, cooldownSeconds: 5, rankingLimit: 15, dashboard: true })
    expect(() => Config({ ...config, cooldownSeconds: -1 })).toThrow()
    expect(() => Config({ ...config, rankingLimit: 100 })).toThrow()
    expect(() => new Game(ctx.database, { ...config, initialLengthMin: 20 })).toThrow('初始长度')
    expect(() => new Game(ctx.database, { ...config, initialDepthMax: -20 })).toThrow('初始深度')
    expect(() => new Game(ctx.database, { ...config, rates: [{ min: 3, max: 2, rate: 80 }] })).toThrow('下限')
  })

  it('首次仅初始化，查询不创建玩家，初始化有冷却', async () => {
    expect(await game.profile(actor, actor.userId)).toMatchObject({ kind: 'profile', player: undefined })
    expect(await ctx.database.get('impart_players', {})).toHaveLength(0)
    const initial = await game.play(actor, actor, 'mine')
    expect(initial).toMatchObject({ kind: 'initialized', mode: 'mine', player: { length: null, depth: -900, growthFactor: null, depthFactor: 0.5, lastActionAt: now } })
    expect(await game.play(actor, actor, 'train')).toMatchObject({ kind: 'cooldown', seconds: 5 })
  })

  it('打胶与挖矿分别初始化，初值取各自的下限到上限', async () => {
    random.mockReturnValueOnce(1)
    expect(await game.play(actor, actor, 'train')).toMatchObject({ kind: 'initialized', mode: 'train', player: { length: 1800, depth: null, growthFactor: 0.5, depthFactor: null } })
    now += 5000
    random.mockReturnValueOnce(0).mockReturnValueOnce(0.25)
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ kind: 'initialized', mode: 'mine', player: { length: 1800, depth: -1800, growthFactor: 0.5, depthFactor: 0.25 } })
    now += 5000
    random.mockReturnValueOnce(0)
    expect(await game.play(actor, bob, 'train')).toMatchObject({ kind: 'initialized', player: { userId: 'bob', length: 0, depth: null } })
    expect(await game.profile(actor, actor.userId)).toMatchObject({ player: { length: 1800, depth: -1800, lastActionAt: now - 5000 } })
    game = new Game(ctx.database, { ...config, initialLengthMin: 5, initialLengthMax: 25, initialDepthMin: -30, initialDepthMax: -10 }, random, () => now)
    const carol = { userId: 'carol', name: '丙' }
    random.mockReturnValueOnce(0.25)
    expect(await game.play({ ...actor, ...carol }, carol, 'train')).toMatchObject({ player: { length: 1000 } })
    now += 5000
    random.mockReturnValueOnce(0)
    expect(await game.play({ ...actor, ...carol }, carol, 'mine')).toMatchObject({ player: { depth: -3000 } })
  })

  it('帮助他人时依次初始化目标和发起者', async () => {
    expect(await game.play(actor, bob, 'train')).toMatchObject({ kind: 'initialized', player: { userId: 'bob' } })
    expect(await ctx.database.get('impart_players', {})).toHaveLength(1)
    expect(await game.play(actor, bob, 'train')).toMatchObject({ kind: 'initialized', player: { userId: 'alice' } })
    expect(await game.play(actor, bob, 'train')).toMatchObject({ kind: 'cooldown' })
  })

  it('打胶只改长度，挖矿只改深度，已有长度的玩家首次挖矿仍需初始化', async () => {
    await initialize()
    expect(await game.play(actor, actor, 'train')).toMatchObject({ kind: 'changed', success: true, delta: 1500, player: { length: 2400, depth: null } })
    now += 5000
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ kind: 'initialized', player: { length: 2400, depth: -900 } })
    now += 5000
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ kind: 'changed', delta: -1500, player: { length: 2400, depth: -2400 } })
    now += 5000
    expect(await game.play(actor, actor, 'train')).toMatchObject({ player: { length: 3900, depth: -2400 } })
  })

  it('打胶与挖矿各用自己的生长系数', async () => {
    random.mockReturnValueOnce(0.5).mockReturnValueOnce(0)
    await initialize()
    random.mockReturnValueOnce(0.5).mockReturnValueOnce(0.9)
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ player: { growthFactor: 0, depthFactor: 0.9 } })
    now += 5000
    expect(await game.play(actor, actor, 'train')).toMatchObject({ kind: 'changed', delta: 1000, player: { length: 1900 } })
    now += 5000
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ kind: 'changed', delta: -1900, player: { depth: -2800 } })
  })

  it('失败反向变化且不乘系数，失败也消耗冷却', async () => {
    await initialize()
    random.mockReturnValueOnce(0.99)
    expect(await game.play(actor, actor, 'train')).toMatchObject({ success: false, delta: -1200, player: { length: -300 } })
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ kind: 'cooldown' })
    await ctx.database.set('impart_players', {}, { depth: -1800 })
    now += 5000
    random.mockReturnValueOnce(0.99)
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ success: false, delta: 1200, player: { length: -300, depth: -600 } })
  })

  it('帮助他人仅改目标长度，但双方共用跨群冷却', async () => {
    await game.play(actor, bob, 'train')
    await game.play(actor, bob, 'train')
    now += 5000
    expect(await game.play(actor, bob, 'train')).toMatchObject({ player: { userId: 'bob', length: 2400 } })
    expect(await game.profile(actor, actor.userId)).toMatchObject({ player: { length: 900, lastActionAt: now } })
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
    expect(await game.profile(actor, actor.userId)).toMatchObject({ player: { length: 30900 } })
  })

  it('同一平台跨群共享数值，不同平台互不串号', async () => {
    await initialize()
    const otherGroup = { ...actor, channelId: 'group-b' }
    expect(await game.play(otherGroup, actor, 'train')).toMatchObject({ kind: 'changed', player: { length: 2400 } })
    expect(await game.profile(actor, actor.userId)).toMatchObject({ player: { length: 2400 } })
    expect(await game.play({ ...actor, platform: 'telegram' }, actor, 'mine')).toMatchObject({ kind: 'initialized', player: { length: null, depth: -900 } })
    expect(await ctx.database.get('impart_players', {})).toHaveLength(2)
  })

  it('群开关幂等，关闭阻止操作和查询，不影响其他群和存量数据', async () => {
    await initialize()
    await game.party(actor, false)
    await game.party(actor, false)
    expect(await game.play(actor, actor, 'train')).toEqual({ kind: 'closed' })
    expect(await game.profile(actor, actor.userId)).toEqual({ kind: 'closed' })
    expect(await game.ranking(actor, 'length')).toBeUndefined()
    expect(await game.profile({ ...actor, channelId: 'group-b' }, actor.userId)).toMatchObject({ player: { length: 900 } })
    expect(await game.stats()).toMatchObject({ trainers: 1, miners: 0, groups: 2, openGroups: 1 })
    await game.party(actor, true)
    await game.party(actor, true)
    expect(await game.profile(actor, actor.userId)).toMatchObject({ player: { length: 900, lastActionAt: 100_000 } })
  })

  it('取到群名时更新记录，群号回退不覆盖已有群名', async () => {
    const unnamed = { ...actor, groupName: actor.channelId }
    await game.profile(unnamed, actor.userId)
    expect(await ctx.database.get('impart_groups', {})).toMatchObject([{ name: 'group-a' }])
    await game.profile(actor, actor.userId)
    expect(await ctx.database.get('impart_groups', {})).toMatchObject([{ name: '测试群 A' }])
    await game.party(unnamed, false)
    await game.play(unnamed, actor, 'train')
    expect(await ctx.database.get('impart_groups', {})).toMatchObject([{ name: '测试群 A', enabled: false }])
  })

  it('新群默认关闭时不初始化，管理员仍能显式开启', async () => {
    game = new Game(ctx.database, { ...config, defaultEnabled: false }, random, () => now)
    expect(await game.play(actor, actor, 'mine')).toEqual({ kind: 'closed' })
    expect(await ctx.database.get('impart_players', {})).toHaveLength(0)
    await game.party(actor, true)
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ kind: 'initialized' })
  })

  it('长度榜与深度榜各自只含本群该玩法的历史参与者', async () => {
    await initialize()
    await game.play(actor, bob, 'train')
    await ctx.database.set('impart_players', { userId: 'bob' }, { length: -2500 })
    await game.play({ ...actor, channelId: 'group-b', userId: 'carol', name: '丙' }, { userId: 'carol', name: '丙' }, 'train')
    await game.play({ ...actor, userId: 'dave', name: '丁' }, { userId: 'dave', name: '丁' }, 'mine')
    expect((await game.ranking(actor, 'mining'))?.players.map((player) => player.userId)).toEqual(['dave'])
    await ctx.database.set('impart_players', { userId: 'alice' }, { depth: -100, depthFactor: 0.5 })
    await ctx.database.set('impart_players', { userId: 'bob' }, { depth: -3000, depthFactor: 0.5 })
    await ctx.database.set('impart_players', { userId: 'dave' }, { length: 5000, growthFactor: 0.5 })
    expect((await game.ranking(actor, 'length'))?.players.map((player) => player.userId)).toEqual(['alice', 'bob'])
    expect((await game.ranking(actor, 'mining'))?.players.map((player) => player.userId)).toEqual(['dave'])
    expect((await game.ranking({ ...actor, channelId: 'empty' }, 'length'))?.players).toEqual([])
    now += 5000
    expect(await game.play(actor, actor, 'mine')).toMatchObject({ kind: 'changed', player: { depth: -1600 } })
    expect((await game.ranking(actor, 'mining'))?.players.map((player) => player.userId)).toEqual(['alice', 'dave'])
    const stats = await game.stats()
    expect(stats).toMatchObject({ trainers: 4, miners: 3, groups: 3, openGroups: 3, hidden: 0 })
    expect(stats.ranked.map((group) => [group.channelId, group.length.players, group.depth.players])).toEqual([['group-a', 2, 2], ['group-b', 1, 0]])
    expect(stats.ranked[0]!.length.entries).toEqual([
      { rank: 1, userId: 'alice', name: '甲', value: 900 },
      { rank: 2, userId: 'bob', name: '乙', value: -2500 }
    ])
    expect(stats.ranked[0]!.depth.entries.map((entry) => [entry.userId, entry.rank])).toEqual([['alice', 1], ['dave', 2]])
    expect(stats.ranked[1]!.depth.entries).toEqual([])
  })

  it('迁移旧数据：深度沿用旧系数，参与记录按已初始化数值标记玩法', async () => {
    const legacy = { platform: 'onebot', name: '旧', lastActionAt: 0 }
    await ctx.database.upsert('impart_players', [
      { ...legacy, id: 'both', userId: 'both', length: 100, depth: -200, growthFactor: 0.7 },
      { ...legacy, id: 'miner', userId: 'miner', length: null, depth: -300, growthFactor: 0.3 },
      { ...legacy, id: 'trainer', userId: 'trainer', length: 400, depth: null, growthFactor: 0.1 }
    ])
    await ctx.database.upsert('impart_memberships', ['both', 'miner', 'trainer'].map((playerId) => ({ id: playerId, groupId: 'g', playerId })))
    await game.migrate()
    await game.migrate()
    const players = await ctx.database.get('impart_players', {}, { sort: { id: 'asc' } })
    expect(players.map(({ id, growthFactor, depthFactor }) => [id, growthFactor, depthFactor])).toEqual([
      ['both', 0.7, 0.7], ['miner', null, 0.3], ['trainer', 0.1, null]
    ])
    const memberships = await ctx.database.get('impart_memberships', {}, { sort: { id: 'asc' } })
    expect(memberships.map(({ id, length, depth }) => [id, length, depth])).toEqual([
      ['both', true, true], ['miner', false, true], ['trainer', true, false]
    ])
  })

  it('仪表盘按参与人数展示前 6 个群，空群不计入', async () => {
    game = new Game(ctx.database, { ...config, cooldownSeconds: 0 }, random, () => now)
    for (let index = 0; index < 7; index++) {
      for (let user = 0; user <= index; user++) {
        const player = { userId: `u${user}`, name: `玩家${user}` }
        await game.play({ ...actor, channelId: `g${index}`, ...player }, player, 'train')
      }
    }
    await game.profile({ ...actor, channelId: 'quiet' }, actor.userId)
    const stats = await game.stats()
    expect(stats).toMatchObject({ trainers: 7, miners: 0, groups: 8, hidden: 1 })
    expect(stats.ranked.map((group) => group.channelId)).toEqual(['g6', 'g5', 'g4', 'g3', 'g2', 'g1'])
    expect(stats.ranked[0]!.length.entries.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(stats.ranked[0]!.depth).toEqual({ players: 0, entries: [] })
  })

  it('仪表盘每群分别列长度与深度首尾各 5 名，名次连续不重复', async () => {
    game = new Game(ctx.database, { ...config, cooldownSeconds: 0 }, random, () => now)
    for (let user = 0; user < 12; user++) {
      const player = { userId: `u${String(user).padStart(2, '0')}`, name: `玩家${user}` }
      await game.play({ ...actor, ...player }, player, 'train')
      await game.play({ ...actor, ...player }, player, 'mine')
      await ctx.database.set('impart_players', { userId: player.userId }, { length: 100 * (6 - user), depth: 100 * (6 - user) })
    }
    const [group] = (await game.stats()).ranked
    expect([group!.length.players, group!.depth.players]).toEqual([12, 12])
    expect(group!.length.entries.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5, 8, 9, 10, 11, 12])
    expect(group!.length.entries.map((entry) => entry.value)).toEqual([600, 500, 400, 300, 200, -100, -200, -300, -400, -500])
    expect(group!.depth.entries.map((entry) => entry.rank)).toEqual([1, 2, 3, 4, 5, 8, 9, 10, 11, 12])
    expect(group!.depth.entries.map((entry) => entry.value)).toEqual([-500, -400, -300, -200, -100, 200, 300, 400, 500, 600])
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
