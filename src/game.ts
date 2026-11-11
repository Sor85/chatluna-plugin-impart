import { $ } from '@cordisjs/plugin-database'
import type { Database } from '@cordisjs/plugin-database'
import type { Config } from './config'
import type { Actor, Group, GroupStats, Mode, PlayResult, Player, Ranking, RankingOrder, Stats, Target } from './types'
import { change, displayName, varied } from './utils'
import type {} from './models'

const DASHBOARD_GROUPS = 6
const DASHBOARD_PLAYERS = 5

export class Game {
  private pending = Promise.resolve()

  constructor(
    private database: Database,
    readonly config: Config,
    private random: () => number = Math.random,
    private now: () => number = Date.now
  ) {
    if (config.rates.some((band) => band.min >= band.max)) throw new Error('成功率区间下限必须小于上限。')
    if (config.initialLengthMin > config.initialLengthMax) throw new Error('初始长度下限不能大于上限。')
    if (config.initialDepthMin > config.initialDepthMax) throw new Error('初始深度下限不能大于上限。')
  }

  private transact<T>(run: (tx: Database) => Promise<T>): Promise<T> {
    const result = this.pending.then(() => this.database.transact(run))
    this.pending = result.then(() => undefined, () => undefined)
    return result
  }

  private async group(tx: Database, actor: Actor): Promise<Group> {
    const id = JSON.stringify([actor.platform, actor.channelId])
    const name = displayName(actor.groupName, actor.channelId)
    const [group] = await tx.get('impart_groups', { id })
    if (!group) return tx.create('impart_groups', { id, platform: actor.platform, channelId: actor.channelId, name, enabled: this.config.defaultEnabled })
    // 群号只是取不到群名时的回退，不覆盖已记录的群名。
    if (name === actor.channelId || name === group.name) return group
    await tx.set('impart_groups', { id }, { name })
    return { ...group, name }
  }

  private async join(tx: Database, groupId: string, playerId: string) {
    await tx.upsert('impart_memberships', [{ id: JSON.stringify([groupId, playerId]), groupId, playerId }])
  }

  play(actor: Actor, target: Target, mode: Mode): Promise<PlayResult> {
    return this.transact(async (tx): Promise<PlayResult> => {
      const group = await this.group(tx, actor)
      if (!group.enabled) return { kind: 'closed' }
      const now = this.now()
      const field = mode === 'train' ? 'length' : 'depth'
      const targetKey = JSON.stringify([actor.platform, target.userId])
      const actorKey = JSON.stringify([actor.platform, actor.userId])
      const [targetPlayer] = await tx.get('impart_players', { id: targetKey })
      const [actorPlayer] = targetKey === actorKey ? [targetPlayer] : await tx.get('impart_players', { id: actorKey })
      const cooldown = (player: Player): PlayResult | undefined => {
        const remaining = player.lastActionAt + this.config.cooldownSeconds * 1000 - now
        if (remaining > 0) return { kind: 'cooldown', userId: player.userId, seconds: Math.ceil(remaining / 1000) }
      }
      for (const [id, existing, identity] of [[targetKey, targetPlayer, target], [actorKey, actorPlayer, actor]] as const) {
        if (existing?.[field] != null) continue
        const waiting = existing && cooldown(existing)
        if (waiting) return waiting
        const [min, max] = mode === 'train'
          ? [this.config.initialLengthMin, this.config.initialLengthMax]
          : [this.config.initialDepthMin, this.config.initialDepthMax]
        const initial = Math.round((min + this.random() * (max - min)) * 100)
        const update = { name: displayName(identity.name, identity.userId), lastActionAt: now, ...(mode === 'train' ? { length: initial } : { depth: initial }) }
        const player = existing
          ? { ...existing, ...update }
          : await tx.create('impart_players', { id, platform: actor.platform, userId: identity.userId, length: null, depth: null, growthFactor: this.random(), ...update })
        if (existing) await tx.set('impart_players', { id }, update)
        await this.join(tx, group.id, id)
        return { kind: 'initialized', player, mode }
      }
      for (const player of [actorPlayer!, targetPlayer!]) {
        const waiting = cooldown(player)
        if (waiting) return waiting
      }
      const current = targetPlayer![field]!
      const { success, delta } = change(current, targetPlayer!.growthFactor, mode, this.config, this.random)
      const update = { name: displayName(target.name, target.userId), lastActionAt: now, ...(mode === 'train' ? { length: current + delta } : { depth: current + delta }) }
      const player: Player = { ...targetPlayer!, ...update }
      await tx.set('impart_players', { id: targetKey }, update)
      if (actorKey !== targetKey) {
        await tx.set('impart_players', { id: actorKey }, { name: displayName(actor.name, actor.userId), lastActionAt: now })
      }
      await this.join(tx, group.id, targetKey)
      if (actorKey !== targetKey) await this.join(tx, group.id, actorKey)
      return { kind: 'changed', player, delta, success, mode }
    })
  }

  profile(actor: Actor, userId: string) {
    return this.transact(async (tx) => {
      const group = await this.group(tx, actor)
      if (!group.enabled) return { kind: 'closed' }
      const [player] = await tx.get('impart_players', { id: JSON.stringify([actor.platform, userId]) })
      return { kind: 'profile', player }
    })
  }

  party(actor: Actor, enabled: boolean): Promise<Group> {
    return this.transact(async (tx) => {
      const group = await this.group(tx, actor)
      await tx.set('impart_groups', { id: group.id }, { enabled })
      return { ...group, enabled }
    })
  }

  private async ranked(tx: Database, group: Group, order: RankingOrder): Promise<Ranking> {
    const members = this.config.allChannels ? undefined : await tx.get('impart_memberships', { groupId: group.id }, ['playerId'])
    const players = await tx.get('impart_players', {
      platform: group.platform,
      ...(order === 'length' ? { length: { $exists: true } } : { depth: { $exists: true } }),
      ...(members ? { id: members.map((member) => member.playerId) } : {})
    }, { sort: { ...(order === 'length' ? { length: 'desc' } : { depth: 'asc' }), id: 'asc' }, limit: this.config.rankingLimit })
    return { group, order, players, allChannels: this.config.allChannels }
  }

  ranking(actor: Actor, order: RankingOrder) {
    return this.transact(async (tx) => {
      const group = await this.group(tx, actor)
      if (!group.enabled) return undefined
      return this.ranked(tx, group, order)
    })
  }

  async stats(): Promise<Stats> {
    const [players, groups, counts] = await Promise.all([
      this.database.select('impart_players').execute((row) => $.count(row.id)),
      this.database.get('impart_groups', {}),
      this.database.select('impart_memberships').groupBy(['groupId'], { count: (row) => $.count(row.id) }).execute()
    ])
    const sizes = new Map(counts.map((row) => [row.groupId, row.count]))
    const active = groups
      .filter((group) => sizes.has(group.id))
      .sort((a, b) => sizes.get(b.id)! - sizes.get(a.id)! || a.id.localeCompare(b.id))
    const shown = active.slice(0, DASHBOARD_GROUPS)
    const ranked = await Promise.all(shown.map(async (group): Promise<GroupStats> => {
      const members = await this.database.get('impart_memberships', { groupId: group.id }, ['playerId'])
      const query = { id: members.map((member) => member.playerId), length: { $exists: true } }
      const [count, longest, shortest] = await Promise.all([
        this.database.select('impart_players', query).execute((row) => $.count(row.id)),
        this.database.get('impart_players', query, { sort: { length: 'desc', id: 'asc' }, limit: DASHBOARD_PLAYERS }),
        this.database.get('impart_players', query, { sort: { length: 'asc', id: 'desc' }, limit: DASHBOARD_PLAYERS })
      ])
      const entries = [
        ...longest.map((player, index) => ({ player, rank: index + 1 })),
        ...shortest.reverse().map((player, index) => ({ player, rank: count - shortest.length + index + 1 }))
      ].filter(({ rank }, index, all) => all.findIndex((other) => other.rank === rank) === index)
        .map(({ player: { userId, name, length }, rank }) => ({ rank, userId, name, length: length! }))
      return { ...group, players: sizes.get(group.id)!, entries }
    }))
    return { players, groups: groups.length, openGroups: groups.filter((group) => group.enabled).length, ranked, hidden: active.length - shown.length }
  }
}
