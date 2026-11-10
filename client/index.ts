import type { Context } from 'cordis'
import { lazyPage, subscribeLive } from '@chatluna/ui-client/client'
import { registerReactFormExtension } from '@chatluna/ui-schema-form/client'
import { RateTable } from './rate-table'
import zh from './locales/zh.yml'
import en from './locales/en.yml'

export default function apply(ctx: Context) {
  ctx.locale.register('impart', { zh, en })
  ctx.effect(() => registerReactFormExtension({ type: 'array', role: 'impart:rates', component: RateTable, priority: 30 }))
  // The settings table always loads; the card follows the server's impart.stats state, which exists only with Config.dashboard.
  ctx.effect(() => {
    let card: (() => void) | undefined
    const unsubscribe = subscribeLive('impart.stats', undefined, ({ data }) => {
      if (data === null) {
        card?.()
        card = undefined
      } else if (data !== undefined && card === undefined) {
        card = ctx.slots.register(
          'dashboard.card',
          { id: 'impart.stats', order: 70, size: 'lg' },
          lazyPage(async () => (await import('./dashboard')).ImpartStatsCard).component
        )
      }
    })
    return () => {
      unsubscribe()
      card?.()
    }
  })
}
