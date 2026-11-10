import type { Context } from 'cordis'
import type {} from '@chatluna/ui-server'
import type { Game } from './game'

export function registerWebUI(ctx: Context, game: Game, dashboard: boolean) {
  ctx.chatluna_webui.addEntry({ baseUrl: import.meta.url, source: '../client/index.ts', bundle: '../dist/client.js' })
  if (dashboard) ctx.chatluna_webui.state('impart.stats', { get: () => game.stats() })
}
