import { useState } from 'react'
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@chatluna/ui-kit'
import { extensionProps, inferFallback, type SchemaRendererProps } from '@chatluna/ui-schema-form/client'

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {}
}

export function RateTable(props: SchemaRendererProps) {
  const [revision, setRevision] = useState(0)
  const items: unknown[] = Array.isArray(props.value) ? props.value : []
  const fields = Object.entries(props.schema.inner?.dict ?? {})
  const label = String(props.schema.meta.label ?? props.path)
  const replaceRows = (next: unknown[]) => {
    // Structural edits must discard the number input's local draft, not move it to another row.
    setRevision((value) => value + 1)
    props.onChange(next)
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return
    const next = [...items]
    next.splice(to, 0, ...next.splice(from, 1))
    replaceRows(next)
  }
  const reversed = items.flatMap((item, index) => {
    const { min, max } = record(item)
    return typeof min === 'number' && typeof max === 'number' && min >= max ? [index + 1] : []
  })
  const add = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => replaceRows([...items, Object.fromEntries(fields.map(([key, field]) => [key, inferFallback(field)]))])}
    >
      <PlusIcon />
      添加一项
    </Button>
  )
  return (
    <div className="min-w-0 text-sm leading-5" data-impart-rate-table="">
      {extensionProps(props, (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-lg border">
            <Table aria-label={label} className="min-w-[40rem] table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  {fields.map(([key, field]) => (
                    <TableHead key={key} className="px-3">{String(field.meta.label ?? key)}</TableHead>
                  ))}
                  <TableHead className="w-32 pr-3 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, index) => {
                  const row = record(item)
                  const rowLabel = `第 ${index + 1} 项`
                  return (
                    <TableRow key={`${revision}:${index}`}>
                      {fields.map(([key, field]) => {
                        const path = `${props.path}.${index}.${key}`
                        return (
                          <TableCell key={key} className="px-3 py-2">
                            <label className="sr-only" htmlFor={path}>{`${rowLabel}：${String(field.meta.label ?? key)}`}</label>
                            <div className="[&_[data-slot=input-group]]:w-full">
                              {props.render(field, row[key], path, (value) => {
                                props.onChange(items.map((current, at) => at === index ? { ...row, [key]: value } : current))
                              }, { embedded: true })}
                            </div>
                          </TableCell>
                        )
                      })}
                      <TableCell className="pr-3">
                        <div className="flex justify-end gap-0.5">
                          <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} aria-label={`上移：${rowLabel}`} title="上移" onClick={() => move(index, index - 1)}>
                            <ArrowUpIcon />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" disabled={index === items.length - 1} aria-label={`下移：${rowLabel}`} title="下移" onClick={() => move(index, index + 1)}>
                            <ArrowDownIcon />
                          </Button>
                          <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`删除：${rowLabel}`} title="删除" onClick={() => replaceRows(items.filter((_, at) => at !== index))}>
                            <Trash2Icon />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={fields.length + 1} className="h-20 text-center text-muted-foreground">暂无区间，全部按 50% 成功率计算</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {reversed.length > 0 && (
            <p className="text-xs leading-5 text-destructive" role="alert">{`第 ${reversed.join('、')} 项的下限不小于上限，插件无法启动。`}</p>
          )}
        </div>
      ), true, add)}
    </div>
  )
}
