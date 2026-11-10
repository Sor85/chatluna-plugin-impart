import type { Config } from './config'
import type { Mode } from './types'

export function formatLength(value: number) {
  return (value / 100).toFixed(2)
}

export function displayName(value: string, fallback: string) {
  return Array.from(value.replace(/[\p{Cc}\p{Cf}]/gu, '').trim()).slice(0, 40).join('') || fallback
}

export function targetId(target: string | undefined, platform: string): string | undefined {
  if (target === undefined) return undefined
  const prefix = `${platform}:`
  if (!target.startsWith(prefix)) throw new Error('目标必须属于当前平台。')
  const id = target.slice(prefix.length)
  if (!id || ['all', 'here', 'undefined', 'null'].includes(id) || /[\s<>"']/u.test(id) || id.length > 128) {
    throw new Error('目标必须是有效用户，不能是全体成员。')
  }
  return id
}

export function varied(base: number, variance: number, random: () => number) {
  return base * (1 + (random() * 2 - 1) * variance / 100)
}

export function change(length: number, growthFactor: number, mode: Mode, config: Config, random: () => number) {
  const direction = mode === 'train' ? 1 : -1
  const progress = direction * length / 100
  const rate = config.rates.find((band) => band.min <= progress && progress < band.max)?.rate ?? 50
  const success = random() * 100 < rate
  const magnitude = success
    ? varied(config.growth, config.growthVariance, random) * (1 + growthFactor)
    : varied(config.setback, config.setbackVariance, random)
  const delta = direction * (success ? 1 : -1) * Math.max(1, Math.round(magnitude * 100))
  if (!Number.isSafeInteger(length + delta)) throw new Error('长度超出安全数值范围，本次操作未生效。')
  return { success, delta }
}
