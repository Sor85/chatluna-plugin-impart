import type { Context } from 'cordis'
import type {} from 'koishi'
import type {} from '@chatluna/permission'
import type {} from '@chatluna/ui-server'
import { Config } from './config'
import { defineModels } from './models'
import { Game } from './game'
import { registerCommands } from './commands'
import { registerWebUI } from './webui'

export const name = 'chatluna-impart'
export { Config }
export const inject = ['model', 'database', 'koishi', 'permissions']

export function apply(ctx: Context, config: Config) {
  defineModels(ctx)
  const lifetime = new AbortController()
  ctx.effect(() => () => lifetime.abort())
  const game = new Game(ctx.database, config)
  registerCommands(ctx, game, lifetime.signal, () => {
    const webui = ctx.get('chatluna_webui')
    webui?.refresh('impart.groups')
    webui?.refresh('impart.ranking')
  })
  ctx.inject(['chatluna_webui'], (ctx) => registerWebUI(ctx, game))
}
