import type {} from '@chatluna/ui-client/client'

export type Mode = 'train' | 'mine'
export type RankingOrder = 'length' | 'mining'

export interface Player {
  id: string
  platform: string
  userId: string
  name: string
  length: number
  growthFactor: number
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
  | { kind: 'initialized'; player: Player }
  | { kind: 'cooldown'; userId: string; seconds: number }
  | { kind: 'changed'; player: Player; delta: number; success: boolean; mode: Mode }

export interface Ranking {
  group: Group
  order: RankingOrder
  allChannels: boolean
  players: Player[]
}

export interface Overview {
  groups: Group[]
  truncated: boolean
}

export interface RankingRequest {
  groupId: string
  order: RankingOrder
}

export interface PartyRequest {
  groupId: string
  enabled: boolean
}

export interface PlayerView {
  id: string
  userId: string
  name: string
  length: number
  growthFactor: number
}

export interface RankingView {
  group: Group
  order: RankingOrder
  allChannels: boolean
  players: PlayerView[]
}

declare module '@chatluna/ui-client/client' {
  interface States {
    'impart.groups': Overview
    'impart.ranking': RankingView | undefined
  }
  interface Actions {
    'impart.party'(input: PartyRequest): Group
  }
}
