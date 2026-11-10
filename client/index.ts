import type { Context } from 'cordis'
import { lazyPage } from '@chatluna/ui-client/client'
import zh from './locales/zh.yml'
import en from './locales/en.yml'

export default function apply(ctx: Context) {
  ctx.locale.register('impart', { zh, en })
  ctx.slots.register(
    'dashboard.card',
    { id: 'impart.stats', order: 70, size: 'md' },
    lazyPage(async () => (await import('./dashboard')).ImpartStatsCard).component
  )
}
