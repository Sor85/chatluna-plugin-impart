import { useLive, useTranslate } from '@chatluna/ui-client/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@chatluna/ui-kit'
import type { Leader } from '../src/types'
import { formatLength } from '../src/utils'

export function ImpartStatsCard() {
  const t = useTranslate('impart')
  const { data } = useLive('impart.stats')
  const rows: [string, Leader | undefined][] = [[t('longest'), data?.longest], [t('deepest'), data?.deepest]]
  return (
    <Card className="h-full text-sm leading-6">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>
          {t('summary', { players: data?.players ?? 0, open: data?.openGroups ?? 0, groups: data?.groups ?? 0 })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!data?.players ? (
          <p className="py-4 text-center text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="divide-y">
            {rows.map(([label, player]) => player && (
              <li key={label} className="flex items-center gap-3 py-2">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
                <span className="min-w-0 flex-1 truncate" title={player.name}>{player.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{player.platform} · {player.userId}</span>
                <span className="w-24 shrink-0 text-right font-medium tabular-nums">{formatLength(player.length)} cm</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
