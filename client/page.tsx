import { useState } from 'react'
import { useAction, useLive, useTranslate } from '@chatluna/ui-client/client'
import {
  Alert, AlertDescription, AlertTitle, Badge, Button, EmptyState, FilterChips,
  Label, PageHeader, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger,
  SelectValue, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@chatluna/ui-kit'
import type { RankingOrder } from '../src/types'
import { formatLength } from '../src/utils'

export function ImpartPage() {
  const t = useTranslate('impart')
  const groups = useLive('impart.groups')
  const [selected, setSelected] = useState('')
  const [order, setOrder] = useState<RankingOrder>('length')
  const current = groups.data?.groups.find((group) => group.id === selected) ?? groups.data?.groups[0]
  const ranking = useLive('impart.ranking', { groupId: current?.id ?? '', order })
  const party = useAction('impart.party')
  const error = groups.error ?? ranking.error
  const view = ranking.data
  return (
    <div className="flex min-h-full min-w-0 flex-col gap-5 p-(--page-gutter) text-sm leading-6">
      <PageHeader title={t('title')} description={t('description')} />
      {error && <Alert variant="destructive"><AlertTitle>{t('error')}</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      {groups.status === 'loading' ? <Skeleton className="h-32 w-full" /> : !current ? (
        <EmptyState title={t('empty.title')} hint={t('empty.hint')} />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="impart-group">{t('group')}</Label>
              <Select value={current.id} onValueChange={(value) => { if (typeof value === 'string') setSelected(value) }}>
                <SelectTrigger id="impart-group" className="w-64 max-w-full"><SelectValue>{current.name}</SelectValue></SelectTrigger>
                <SelectContent><SelectGroup>
                  {groups.data?.groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}><span className="min-w-0 flex-1 truncate">{group.name} · {group.platform}</span></SelectItem>
                  ))}
                </SelectGroup></SelectContent>
              </Select>
            </div>
            <FilterChips<RankingOrder> label={t('ranking')} value={order} onChange={setOrder} options={[
              { value: 'length', label: t('lengthRanking') }, { value: 'mining', label: t('miningRanking') }
            ]} />
            <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
              <Badge variant="secondary">{current.enabled ? t('enabled') : t('disabled')}</Badge>
              <Button variant="outline" disabled={party.pending || party.offline} onClick={() => void party({ groupId: current.id, enabled: !current.enabled })}>
                {party.pending ? t('saving') : current.enabled ? t('end') : t('start')}
              </Button>
            </div>
          </div>
          {groups.data?.truncated && <p className="text-muted-foreground">{t('truncated')}</p>}
          <p className="text-muted-foreground">{current.platform} · {current.channelId} · {view?.allChannels ? t('global') : t('local')}</p>
          {!current.enabled && <Alert><AlertTitle>{t('paused.title')}</AlertTitle><AlertDescription>{t('paused.hint')}</AlertDescription></Alert>}
          {ranking.status === 'loading' ? <Skeleton className="h-48 w-full" /> : !view?.players.length ? (
            <EmptyState title={t('players.empty')} hint={t('players.hint')} />
          ) : (
            <div className="rounded-xl border bg-card">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-16">{t('rank')}</TableHead>
                  <TableHead>{t('player')}</TableHead>
                  <TableHead className="text-right">{t('length')}</TableHead>
                  <TableHead className="text-right">{t('factor')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>{view.players.map((player, index) => (
                  <TableRow key={player.id}>
                    <TableCell className="font-mono text-muted-foreground">{String(index + 1).padStart(2, '0')}</TableCell>
                    <TableCell><div className="max-w-64 truncate font-medium" title={player.name}>{player.name}</div><div className="text-xs text-muted-foreground">{player.userId}</div></TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatLength(player.length)} cm</TableCell>
                    <TableCell className="text-right tabular-nums">{player.growthFactor.toFixed(2)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
          <p className="text-xs leading-5 text-muted-foreground">{order === 'mining' ? t('miningHint') : t('lengthHint')}</p>
          <p className="text-xs leading-5 text-muted-foreground">{t('rules')}</p>
        </>
      )}
    </div>
  )
}
