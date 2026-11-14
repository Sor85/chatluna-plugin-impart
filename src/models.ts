import type { Context } from 'cordis'
import type {} from '@cordisjs/plugin-database'
import type { Group, Membership, Player } from './types'

declare module '@cordisjs/plugin-database' {
  interface Tables {
    impart_players: Player
    impart_groups: Group
    impart_memberships: Membership
  }
}

export function defineModels(ctx: Context) {
  ctx.model.extend('impart_players', {
    id: 'string',
    platform: 'string',
    userId: 'string',
    name: 'string',
    length: { type: 'integer', nullable: true },
    depth: { type: 'integer', nullable: true },
    // growthFactor 为长度（打胶）系数，沿用旧列名以免 SQLite 重建表。
    growthFactor: { type: 'double', nullable: true },
    depthFactor: { type: 'double', nullable: true },
    lastActionAt: 'integer'
  }, { primary: 'id', unique: [['platform', 'userId']], indexes: [['platform', 'length'], ['platform', 'depth']] })
  ctx.model.extend('impart_groups', {
    id: 'string',
    platform: 'string',
    channelId: 'string',
    name: 'string',
    enabled: 'boolean'
  }, { primary: 'id', unique: [['platform', 'channelId']] })
  ctx.model.extend('impart_memberships', {
    id: 'string',
    groupId: 'string',
    playerId: 'string',
    length: { type: 'boolean', initial: false },
    depth: { type: 'boolean', initial: false }
  }, { primary: 'id', unique: [['groupId', 'playerId']], indexes: [['groupId']] })
}
