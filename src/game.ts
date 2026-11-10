import { $ } from '@cordisjs/plugin-database'
import type { Database } from '@cordisjs/plugin-database'
import type { Config } from './config'
import type { Actor, Group, Leader, Mode, PlayResult, Player, Ranking, RankingOrder, Stats, Target } from './types'
import { change, displayName, varied } from './utils'
import type {} from './models'

export class Game {
  private pending = Promise.resolve()

  constructor(
    private database: Database,
    readonly config: Config,
    private random: () => number = Math.random,
    private now: () => number = Date.now
  ) {
    if (config.rates.some((band) => band.min >= band.max)) throw new Error('成功率区间下限必须小于上限。')
  }

  private transact<T>(run: (tx: Database) => Promise<T>): Promise<T> {
    const result = this.pending.then(() => this.database.transact(run))
    this.pending = result.then(() => undefined, () => undefined)
    return result
  }

  private async group(tx: Database, actor: Actor): Promise<Group> {
    const id = JSON.stringify([actor.platform, actor.channelId])
    const [group] = await tx.get('impart_groups', { id })
    if (group) return group
    return tx.create('impart_groups', {
      id,
      platform: actor.platform,
      channelId: actor.channelId,
      name: displayName(actor.groupName, actor.channelId),
      enabled: this.config.defaultEnabled
    })
  }

  private async join(tx: Database, groupId: string, playerId: string) {
    await tx.upsert('impart_memberships', [{ id: JSON.stringify([groupId, playerId]), groupId, playerId }])
  }

  play(actor: Actor, target: Target, mode: Mode): Promise<PlayResult> {
    return this.transact(async (tx): Promise<PlayResult> => {
      const group = await this.group(tx, actor)
      if (!group.enabled) return { kind: 'closed' }
      const now = this.now()
      const targetKey = JSON.stringify([actor.platform, target.userId])
      const actorKey = JSON.stringify([actor.platform, actor.userId])
      const [targetPlayer] = await tx.get('impart_players', { id: targetKey })
      const [actorPlayer] = targetKey === actorKey ? [targetPlayer] : await tx.get('impart_players', { id: actorKey })
      if (!targetPlayer || !actorPlayer) {
        const identity = !targetPlayer ? target : actor
        const player = await tx.create('impart_players', {
          id: !targetPlayer ? targetKey : actorKey,
          platform: actor.platform,
          userId: identity.userId,
          name: displayName(identity.name, identity.userId),
          length: Math.round(varied(this.config.initialLength, this.config.initialVariance, this.random) * 100),
          growthFactor: this.random(),
          lastActionAt: now
        })
        await this.join(tx, group.id, player.id)
        return { kind: 'initialized', player }
      }
      for (const player of [actorPlayer, targetPlayer]) {
        const remaining = player.lastActionAt + this.config.cooldownSeconds * 1000 - now
        if (remaining > 0) return { kind: 'cooldown', userId: player.userId, seconds: Math.ceil(remaining / 1000) }
      }
      const { success, delta } = change(targetPlayer.length, targetPlayer.growthFactor, mode, this.config, this.random)
      const player: Player = {
        ...targetPlayer,
        name: displayName(target.name, target.userId),
        length: targetPlayer.length + delta,
        lastActionAt: now
      }
      await tx.set('impart_players', { id: targetKey }, { name: player.name, length: player.length, lastActionAt: now })
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
      await tx.set('impart_groups', { id: group.id }, { enabled, name: displayName(actor.groupName, actor.channelId) })
      return { ...group, enabled, name: displayName(actor.groupName, actor.channelId) }
    })
  }

  private async ranked(tx: Database, group: Group, order: RankingOrder): Promise<Ranking> {
    const members = this.config.allChannels ? undefined : await tx.get('impart_memberships', { groupId: group.id }, ['playerId'])
    const players = await tx.get('impart_players', {
      platform: group.platform,
      ...(members ? { id: members.map((member) => member.playerId) } : {})
    }, { sort: { length: order === 'length' ? 'desc' : 'asc', id: 'asc' }, limit: this.config.rankingLimit })
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
    const leader = async (sort: 'asc' | 'desc'): Promise<Leader | undefined> => {
      const [player] = await this.database.get('impart_players', {}, { sort: { length: sort, id: 'asc' }, limit: 1 })
      return player && { platform: player.platform, userId: player.userId, name: player.name, length: player.length }
    }
    const [players, groups, openGroups, longest, deepest] = await Promise.all([
      this.database.select('impart_players').execute((row) => $.count(row.id)),
      this.database.select('impart_groups').execute((row) => $.count(row.id)),
      this.database.select('impart_groups', { enabled: true }).execute((row) => $.count(row.id)),
      leader('desc'),
      leader('asc')
    ])
    return { players, groups, openGroups, longest, deepest }
  }
}
