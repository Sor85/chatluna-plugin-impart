import type {} from '@chatluna/ui-client/client'

export type Mode = 'train' | 'mine'
export type RankingOrder = 'length' | 'mining'

export interface Player {
  id: string
  platform: string
  userId: string
  name: string
  length: number | null
  depth: number | null
  growthFactor: number | null
  depthFactor: number | null
  lastActionAt: number
}

export interface Group {
  id: string
  platform: string
  channelId: string
  name: string
  enabled: boolean
}

export interface Membership {
  id: string
  groupId: string
  playerId: string
  length: boolean
  depth: boolean
}

export interface Actor {
  platform: string
  channelId: string
  groupName: string
  userId: string
  name: string
}

export interface Target {
  userId: string
  name: string
}

export type PlayResult =
  | { kind: 'closed' }
  | { kind: 'initialized'; player: Player; mode: Mode }
  | { kind: 'cooldown'; userId: string; seconds: number }
  | { kind: 'changed'; player: Player; delta: number; success: boolean; mode: Mode }

export interface Ranking {
  group: Group
  order: RankingOrder
  allChannels: boolean
  players: Player[]
}

export interface Entry {
  rank: number
  userId: string
  name: string
  value: number
}

export interface Board {
  players: number
  entries: Entry[]
}

export interface GroupStats {
  id: string
  platform: string
  channelId: string
  name: string
  enabled: boolean
  length: Board
  depth: Board
}

export interface Stats {
  trainers: number
  miners: number
  groups: number
  openGroups: number
  ranked: GroupStats[]
  hidden: number
}

declare module '@chatluna/ui-client/client' {
  interface States {
    'impart.stats': Stats
  }
}
