import type { Context } from 'cordis'
import type {} from '@chatluna/ui-client/client'
import zh from './locales/zh.yml'
import en from './locales/en.yml'

export default function apply(ctx: Context) {
  ctx.locale.register('impart', { zh, en })
  ctx.slots.route({
    path: '/impart',
    page: async () => (await import('./page')).ImpartPage,
    title: () => ctx.locale.translate('impart', 'title'),
    icon: 'users',
    group: 'capabilities',
    order: 65
  })
}
