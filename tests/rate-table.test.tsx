// @vitest-environment jsdom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Context } from 'cordis'
import { Schema } from '@chatluna/schema'
import { SchemaForm, extensionOf, registerReactFormExtension } from '@chatluna/ui-schema-form/client'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { RateTable } from '../client/rate-table'
import { Config } from '../src/config'

const mocks = vi.hoisted(() => ({ listener: undefined as ((snapshot: { data: unknown }) => void) | undefined, unsubscribe: vi.fn() }))
vi.mock('@chatluna/ui-client/client', () => ({
  lazyPage: () => ({ component: () => null }),
  subscribeLive: (_key: string, _params: unknown, listener: (snapshot: { data: unknown }) => void) => {
    mocks.listener = listener
    return mocks.unsubscribe
  }
}))
vi.mock('../client/locales/zh.yml', () => ({ default: {} }))
vi.mock('../client/locales/en.yml', () => ({ default: {} }))
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
afterAll(() => vi.unstubAllGlobals())

let root: Root | undefined
let dispose: (() => void) | undefined
let container: HTMLDivElement
const field = Object.assign({}, ...(Config.list ?? []).map((group) => group.dict)).rates as Schema
const schema = Schema.object({ rates: field })

afterEach(async () => {
  await act(async () => root?.unmount())
  root = undefined
  dispose?.()
  dispose = undefined
  container?.remove()
})

type Value = Record<string, unknown> & { rates?: unknown[] }

async function mount(value: Value = {}) {
  dispose = registerReactFormExtension({ type: 'array', role: 'impart:rates', component: RateTable, priority: 30 })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  let current = value
  function Form() {
    const [draft, setDraft] = useState(value)
    current = draft
    return <SchemaForm schema={schema} value={draft} initial={value} onChange={setDraft} />
  }
  await act(async () => root?.render(<Form />))
  return () => current
}

function table() {
  const element = container.querySelector('table[aria-label="成功率区间"]')
  if (!(element instanceof HTMLTableElement)) throw new Error('缺少成功率区间表格')
  return element
}
function inputs() {
  return [...table().querySelectorAll<HTMLInputElement>('input[inputmode="decimal"]')]
}
async function click(element: Element | null | undefined) {
  if (!element) throw new Error('缺少可点击元素')
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true })))
}
async function type(index: number, value: string) {
  const element = inputs()[index]
  if (!element) throw new Error('缺少数字输入框')
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('成功率区间表格', () => {
  it('以带列头的表格显示默认区间，只读取不写入配置', async () => {
    const current = await mount()
    expect(table().tBodies[0].rows).toHaveLength(10)
    expect([...table().tHead!.querySelectorAll('th')].map((cell) => cell.textContent)).toEqual(['下限（含，厘米）', '上限（不含，厘米）', '成功率（%）', '操作'])
    expect(table().querySelectorAll('[data-schema-field]')).toHaveLength(0)
    expect(inputs().slice(0, 3).map((element) => element.value)).toEqual(['-1,000,000,000,000', '0', '100'])
    expect(current()).toEqual({})
    expect(container.querySelector('[data-impart-rate-table]')?.className).toContain('text-sm leading-5')
  })

  it('编辑单元格只改动对应行和字段，保留未知字段', async () => {
    const current = await mount({ rates: [{ min: 0, max: 100, rate: 80, extra: '保留' }, { min: 100, max: 300, rate: 70 }] })
    await type(5, '65')
    expect(current().rates).toEqual([{ min: 0, max: 100, rate: 80, extra: '保留' }, { min: 100, max: 300, rate: 65 }])
  })

  it('上下移动保持各行数值，删除后保留空数组，新增写入完整默认值', async () => {
    const current = await mount({ rates: [{ min: 0, max: 100, rate: 80 }, { min: 100, max: 300, rate: 70 }] })
    await click(container.querySelector('button[aria-label="下移：第 1 项"]'))
    expect(current().rates).toEqual([{ min: 100, max: 300, rate: 70 }, { min: 0, max: 100, rate: 80 }])
    expect(inputs().map((element) => element.value)).toEqual(['100', '300', '70', '0', '100', '80'])
    await click(container.querySelector('button[aria-label="删除：第 2 项"]'))
    await click(container.querySelector('button[aria-label="删除：第 1 项"]'))
    expect(current().rates).toEqual([])
    expect(table().textContent).toContain('暂无区间')
    const field = container.querySelector('[data-impart-rate-table]')
    await click([...(field?.querySelectorAll('button') ?? [])].find((item) => item.textContent?.includes('添加一项')))
    expect(current().rates).toEqual([{ min: 0, max: 100, rate: 50 }])
    expect(Config({ ...Config(), rates: current().rates as Config['rates'] }).rates).toEqual([{ min: 0, max: 100, rate: 50 }])
  })

  it('下限不小于上限的行给出提示', async () => {
    await mount({ rates: [{ min: 0, max: 100, rate: 80 }, { min: 300, max: 300, rate: 70 }] })
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('第 2 项')
  })

  it('客户端注册专属表格，仪表盘卡片跟随统计状态挂载与卸载', async () => {
    const ordinary = Schema.array(Schema.object({ min: Schema.number() })).role('table')
    const before = extensionOf(ordinary, [])?.component
    const cards: string[] = []
    const ctx = new Context()
    ctx.provide('locale')
    ctx.provide('slots')
    ctx.set('locale', { register: () => () => {} })
    ctx.set('slots', { register: (_name: string, options: { id: string }) => {
      cards.push(options.id)
      return () => cards.splice(cards.indexOf(options.id), 1)
    } })
    const { default: apply } = await import('../client')
    await ctx.plugin(apply)
    try {
      expect(extensionOf(field, [])?.component).toBe(RateTable)
      expect(extensionOf(ordinary, [])?.component).toBe(before)
      expect(cards).toEqual([])
      mocks.listener?.({ data: undefined })
      expect(cards).toEqual([])
      mocks.listener?.({ data: { players: 0 } })
      mocks.listener?.({ data: { players: 1 } })
      expect(cards).toEqual(['impart.stats'])
      mocks.listener?.({ data: null })
      expect(cards).toEqual([])
      mocks.listener?.({ data: { players: 1 } })
    } finally {
      await ctx.fiber.dispose()
    }
    expect(cards).toEqual([])
    expect(mocks.unsubscribe).toHaveBeenCalled()
    expect(extensionOf(field, [])?.component).not.toBe(RateTable)
  })
})
