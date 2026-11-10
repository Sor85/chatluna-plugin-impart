import { describe, expect, it } from 'vitest'
import { Config } from '../src/config'
import { change, displayName, formatLength, targetId, varied } from '../src/utils'

describe('数值与目标边界', () => {
  it('浮动参数表示基数加减百分比，而不是区间端点', () => {
    expect(varied(18, 45, () => 0)).toBeCloseTo(9.9)
    expect(varied(18, 45, () => 1)).toBeCloseTo(26.1)
    expect(varied(10, 45, () => 0)).toBeCloseTo(5.5)
  })
  it('概率按左闭右开匹配，挖矿镜像成功率', () => {
    const config = Config()
    expect(change(9999, 0, 'train', config, () => 0.75).success).toBe(true)
    expect(change(10000, 0, 'train', config, () => 0.75).success).toBe(false)
    expect(change(-10000, 0, 'mine', config, () => 0.75).success).toBe(false)
    expect(change(10000, 0, 'mine', config, () => 0.99).success).toBe(true)
  })
  it('未匹配成功率区间时使用 50%', () => {
    const config = Config({ ...Config(), rates: [] })
    expect(change(0, 0, 'train', config, () => 0.49).success).toBe(true)
    expect(change(0, 0, 'train', config, () => 0.5).success).toBe(false)
  })
  it('保留负号与两位精度，不输出负零', () => {
    expect(formatLength(-1)).toBe('-0.01')
    expect(formatLength(0)).toBe('0.00')
    expect(formatLength(1800)).toBe('18.00')
  })
  it('只接受当前平台的有效目标', () => {
    expect(targetId(undefined, 'onebot')).toBeUndefined()
    expect(targetId('onebot:123', 'onebot')).toBe('123')
    for (const value of ['onebot:', 'onebot:all', 'onebot:here', 'onebot:undefined', 'onebot:<at/>', 'telegram:123']) {
      expect(() => targetId(value, 'onebot')).toThrow()
    }
  })
  it('昵称移除控制字符并限制长度', () => {
    expect(displayName('甲\n‮乙', '123')).toBe('甲乙')
    expect(displayName('  ', '123')).toBe('123')
    expect(Array.from(displayName('甲'.repeat(100), '123'))).toHaveLength(40)
  })
})
