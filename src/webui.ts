import type { Context } from 'cordis'
import { Schema } from '@chatluna/schema'
import type {} from '@chatluna/ui-server'
import type {} from '@chatluna/permission'
import type { Game } from './game'
import type { RankingRequest, RankingView } from './types'

export function registerWebUI(ctx: Context, game: Game) {
  ctx.chatluna_webui.addEntry({ baseUrl: import.meta.url, source: '../client/index.ts', bundle: '../dist/client.js' })
  ctx.chatluna_webui.state('impart.groups', { get: () => game.groups() })
  ctx.chatluna_webui.state('impart.ranking', {
    params: Schema.object({
      groupId: Schema.string().max(512).required(),
      order: Schema.union(['length', 'mining']).required()
    }),
    get: async ({ groupId, order }: RankingRequest): Promise<RankingView | undefined> => {
      const ranking = await game.rankingView(groupId, order)
      if (!ranking) return undefined
      return { ...ranking, players: ranking.players.map(({ id, userId, name, length, growthFactor }) => ({ id, userId, name, length, growthFactor })) }
    }
  })
  ctx.chatluna_webui.action('impart.party', {
    input: Schema.object({ groupId: Schema.string().max(512).required(), enabled: Schema.boolean().required() })
  }, async ({ groupId, enabled }, action) => {
    if (await ctx.permissions.levelOf({ platform: 'webui', user: action.user }) < 3) throw new Error('此操作需要管理员权限（权限等级 3）。')
    const group = await game.setParty(groupId, enabled)
    ctx.chatluna_webui.refresh('impart.groups')
    ctx.chatluna_webui.refresh('impart.ranking')
    return group
  })
}
