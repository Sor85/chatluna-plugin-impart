import type { Context } from 'cordis'
import { subscribeLive } from '@chatluna/ui-client/client'
import { registerReactFormExtension } from '@chatluna/ui-schema-form/client'
import { RateTable } from './rate-table'
import zh from './locales/zh.yml'
import en from './locales/en.yml'

export default function apply(ctx: Context) {
  ctx.locale.register('impart', { zh, en })
  const t = ctx.locale.bind('impart')
  ctx.effect(() => registerReactFormExtension({ type: 'array', role: 'impart:rates', component: RateTable, priority: 30 }))
  // The settings table always loads; the widget follows the server's impart.stats state, which exists only with Config.dashboard.
  ctx.effect(() => {
    let widget: (() => void) | undefined
    const unsubscribe = subscribeLive('impart.stats', undefined, ({ data }) => {
      if (data === null) {
        widget?.()
        widget = undefined
      } else if (data !== undefined && widget === undefined) {
        widget = ctx.slots.widget({
          id: 'impart.stats',
          order: 70,
          title: () => t('title'),
          description: () => t('description'),
          icon: 'trophy',
          size: 'lg',
          sizes: ['sm', 'md', 'lg', 'xl'],
          page: async () => (await import('./dashboard')).ImpartStatsWidget
        })
      }
    })
    return () => {
      unsubscribe()
      widget?.()
    }
  })
}
