import { useLive, useTranslate } from '@chatluna/ui-client/client'
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@chatluna/ui-kit'
import type { Board, Entry, GroupStats } from '../src/types'
import { formatLength } from '../src/utils'

export function ImpartStatsCard() {
  const t = useTranslate('impart')
  const { data } = useLive('impart.stats')
  const totals: [string, number][] = [
    [t('trainers'), data?.trainers ?? 0],
    [t('miners'), data?.miners ?? 0],
    [t('groups'), data?.groups ?? 0],
    [t('openGroups'), data?.openGroups ?? 0]
  ]
  return (
    <Card className="h-full text-sm leading-6">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="flex flex-wrap gap-x-8 gap-y-2">
          {totals.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {!data?.ranked.length ? (
          <p className="rounded-lg border border-dashed py-6 text-center text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.ranked.map((group) => <GroupBlock key={group.id} group={group} />)}
          </div>
        )}
        {!!data?.hidden && <p className="text-xs text-muted-foreground">{t('hidden', { count: data.hidden })}</p>}
      </CardContent>
    </Card>
  )
}

function GroupBlock({ group }: { group: GroupStats }) {
  const t = useTranslate('impart')
  return (
    <section className="min-w-0 rounded-lg border p-4">
      <header className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium" title={group.name}>{group.name}</h3>
          <p className="truncate text-xs text-muted-foreground">{group.platform} · {group.channelId}</p>
        </div>
        <Badge variant={group.enabled ? 'secondary' : 'outline'}>{group.enabled ? t('enabled') : t('disabled')}</Badge>
      </header>
      <BoardList title={t('length')} board={group.length} />
      <BoardList title={t('depth')} board={group.depth} />
    </section>
  )
}

function BoardList({ title, board }: { title: string; board: Board }) {
  const t = useTranslate('impart')
  const scale = Math.max(1, ...board.entries.map((entry) => Math.abs(entry.value)))
  const rows: (Entry | number)[] = []
  for (const entry of board.entries) {
    const previous = rows.at(-1)
    if (typeof previous === 'object' && entry.rank - previous.rank > 1) rows.push(entry.rank - previous.rank - 1)
    rows.push(entry)
  }
  return (
    <div className="mt-3 border-t pt-3">
      <h4 className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{title}</span>
        <span>{t('groupPlayers', { count: board.players })}</span>
      </h4>
      {!rows.length ? (
        <p className="mt-1 text-xs text-muted-foreground">{t('boardEmpty')}</p>
      ) : (
        <ol className="mt-2 flex flex-col gap-1">
          {rows.map((row) => typeof row === 'number' ? (
            <li key={`gap-${row}`} className="py-0.5 text-center text-xs text-muted-foreground">{t('omitted', { count: row })}</li>
          ) : (
            <li key={row.userId} className="flex min-w-0 items-center gap-3">
              <span className="w-6 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{row.rank}</span>
              <span className="min-w-0 flex-1 truncate" title={`${row.name} · ${row.userId}`}>{row.name}</span>
              <LengthBar length={row.value} scale={scale} />
              <span className="w-20 shrink-0 text-right font-medium tabular-nums">{formatLength(row.value)} cm</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function LengthBar({ length, scale }: { length: number; scale: number }) {
  const width = `${Math.abs(length) / scale * 50}%`
  return (
    <span aria-hidden className="relative h-1.5 w-24 shrink-0 rounded-full bg-muted">
      <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
      <span
        className={cn('absolute inset-y-0 rounded-full', length < 0 ? 'bg-chart-2' : 'bg-chart-1')}
        style={length < 0 ? { right: '50%', width } : { left: '50%', width }}
      />
    </span>
  )
}
