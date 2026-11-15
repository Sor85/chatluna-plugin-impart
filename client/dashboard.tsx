import { useLive, useTranslate, type WidgetSize } from '@chatluna/ui-client/client'
import { cn } from '@chatluna/ui-kit'
import { TrophyIcon } from 'lucide-react'
import type { Board, Entry, GroupStats, Stats } from '../src/types'
import { formatLength } from '../src/utils'

/** The board draws the frame and title; this draws the body for the size the viewer picked. */
export function ImpartStatsWidget({ size }: { size: WidgetSize }) {
  const t = useTranslate('impart')
  const { data } = useLive('impart.stats')
  if (size === 'sm') {
    return (
      <div className="h-full text-sm leading-6">
        <Totals data={data} compact />
      </div>
    )
  }
  const groups = data?.ranked ?? []
  return (
    <div className="flex h-full flex-col gap-2 text-sm leading-6">
      <Totals data={data} />
      {!groups.length ? (
        <p className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 text-center text-muted-foreground">
          <TrophyIcon className="size-5" />
          {t('empty')}
        </p>
      ) : size === 'md' ? (
        <Leaders groups={groups} />
      ) : (
        <div className={cn('grid min-h-0 flex-1 content-start gap-3 overflow-y-auto', size === 'xl' && '@2xl:grid-cols-2 @5xl:grid-cols-3')}>
          {groups.map((group) => <GroupBlock key={group.id} group={group} />)}
        </div>
      )}
      {!!data?.hidden && <p className="truncate text-[11px] leading-4 text-muted-foreground">{t('hidden', { count: data.hidden })}</p>}
    </div>
  )
}

function Totals({ data, compact = false }: { data: Stats | null | undefined; compact?: boolean }) {
  const t = useTranslate('impart')
  const totals: [string, number][] = [
    [t('trainers'), data?.trainers ?? 0],
    [t('miners'), data?.miners ?? 0],
    [t('groups'), data?.groups ?? 0],
    [t('openGroups'), data?.openGroups ?? 0]
  ]
  return (
    <dl className={cn('grid shrink-0 gap-x-4 gap-y-1', compact ? 'grid-cols-2' : 'grid-cols-4')}>
      {totals.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">{label}</dt>
          <dd className="text-xl leading-tight font-semibold tracking-tight tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Medium tiles only fit one row per group: the first place of each board. */
function Leaders({ groups }: { groups: GroupStats[] }) {
  const t = useTranslate('impart')
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <table className="w-full table-fixed text-xs leading-5">
        <thead className="text-muted-foreground">
          <tr>
            <th className="font-normal" />
            <th className="w-[30%] text-right font-normal">{t('topLength')}</th>
            <th className="w-[30%] text-right font-normal">{t('topDepth')}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {groups.map((group) => (
            <tr key={group.id}>
              <td className="truncate py-1 pr-2" title={`${group.name} · ${group.platform} · ${group.channelId}`}>
                <span className="font-medium">{group.name}</span>
                {!group.enabled && <span className="text-muted-foreground"> · {t('disabled')}</span>}
              </td>
              <Leader entry={group.length.entries[0]} />
              <Leader entry={group.depth.entries[0]} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Leader({ entry }: { entry: Entry | undefined }) {
  if (entry === undefined) return <td className="py-1 text-right text-muted-foreground">—</td>
  return (
    <td className="truncate py-1 text-right tabular-nums" title={`${entry.name} · ${entry.userId}`}>
      <span className="text-muted-foreground">{entry.name}</span> {formatLength(entry.value)} cm
    </td>
  )
}

function GroupBlock({ group }: { group: GroupStats }) {
  const t = useTranslate('impart')
  return (
    <section className="min-w-0 rounded-lg border p-3">
      <header className="flex min-w-0 items-baseline gap-2">
        <h3 className="min-w-0 flex-1 truncate font-medium" title={group.name}>{group.name}</h3>
        <span className={cn('shrink-0 text-xs', group.enabled ? 'text-foreground' : 'text-muted-foreground')}>
          {group.enabled ? t('enabled') : t('disabled')}
        </span>
      </header>
      <p className="truncate text-xs text-muted-foreground">{group.platform} · {group.channelId}</p>
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
    <div className="mt-2 border-t pt-2">
      <h4 className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{title}</span>
        <span>{t('groupPlayers', { count: board.players })}</span>
      </h4>
      {!rows.length ? (
        <p className="mt-1 text-xs text-muted-foreground">{t('boardEmpty')}</p>
      ) : (
        <ol className="mt-1 flex flex-col leading-6">
          {rows.map((row) => typeof row === 'number' ? (
            <li key={`gap-${row}`} className="text-center text-xs text-muted-foreground">{t('omitted', { count: row })}</li>
          ) : (
            <li key={row.userId} className="flex min-w-0 items-center gap-2">
              <span className="w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{row.rank}</span>
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
    <span aria-hidden className="relative hidden h-1.5 w-16 shrink-0 rounded-full bg-muted @xs:block">
      <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
      <span
        className={cn('absolute inset-y-0 rounded-full', length < 0 ? 'bg-chart-2' : 'bg-chart-1')}
        style={length < 0 ? { right: '50%', width } : { left: '50%', width }}
      />
    </span>
  )
}
