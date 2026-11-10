import type { Context } from 'cordis'
import type { Session } from 'koishi'
import { h } from '@satorijs/core'
import type {} from '@chatluna/permission'
import type { Game } from './game'
import type { Actor, Mode, RankingOrder, Target } from './types'
import { createRankingRenderer, rankingText } from './render'
import { displayName, formatLength, targetId } from './utils'

const closed = '本群银趴已结束，游戏功能已暂停。管理员可使用“开始银趴”恢复。'

function actorOf(session: Session | undefined): Actor {
  if (!session?.userId || !session.channelId || session.isDirect || !session.guildId) throw new Error('此功能仅支持群聊。')
  return {
    platform: session.platform,
    channelId: session.channelId,
    groupName: session.event.channel?.name || session.event.guild?.name || session.channelId,
    userId: session.userId,
    name: displayName(session.username, session.userId)
  }
}

async function targetOf(session: Session, actor: Actor, raw: string | undefined): Promise<Target> {
  const userId = targetId(raw, actor.platform) ?? actor.userId
  if (userId === actor.userId) return { userId, name: actor.name }
  const member = await session.bot.getGuildMember(session.guildId!, userId)
  if (member.user?.id !== userId) throw new Error('目标必须是本群成员。')
  return { userId, name: displayName(member.nick || member.user.name || userId, userId) }
}

export function registerCommands(ctx: Context, game: Game, signal: AbortSignal, refresh: () => void) {
  const render = createRankingRenderer(signal)
  const owner = 'chatluna-plugin-impart'
  const safe = async (run: () => Promise<string>) => {
    try {
      signal.throwIfAborted()
      return await run()
    } catch (error) {
      if (signal.aborted) return ''
      ctx.logger.warn('Command failed: %s', error)
      return h.escape(error instanceof Error ? error.message : '操作失败，数据未确认更新。')
    }
  }
  ctx.command('impart', '打胶与挖矿群聊游戏', { owner, authority: 1 }).alias('银趴').action(() =>
    '打胶（开导） [@成员]：增长玩法\n挖矿 [@成员]：反向玩法\n看看牛牛 [@成员]：查看长度与系数\n牛牛排行榜 / 挖矿排行榜：查看排名\n开始银趴 / 结束银趴：管理员设置本群开关\n首次参与仅初始化，长度跨群共享，打胶与挖矿共用冷却。'
  )
  const play = (session: Session | undefined, raw: string | undefined, mode: Mode) => safe(async () => {
    const actor = actorOf(session)
    if (!session) return ''
    if (raw !== undefined && targetId(raw, actor.platform) === actor.userId) return '操作自己时不需要 @。'
    const target = await targetOf(session, actor, raw)
    const result = await game.play(actor, target, mode)
    refresh()
    if (result.kind === 'closed') return closed
    if (result.kind === 'cooldown') return h.escape(`${result.userId === actor.userId ? '当前用户' : '目标用户'}仍在冷却，剩余 ${result.seconds} 秒。`)
    if (result.kind === 'initialized') return h.escape(`${result.player.name} 已初始化，长度 ${formatLength(result.player.length)} cm，生长系数 ${result.player.growthFactor.toFixed(2)}。本次未执行${mode === 'train' ? '打胶' : '挖矿'}。`)
    const label = mode === 'train' ? '打胶' : '挖矿'
    return h.escape(`${result.player.name} ${label}${result.success ? '成功' : '失败'}，长度 ${result.delta > 0 ? '+' : ''}${formatLength(result.delta)} cm，当前 ${formatLength(result.player.length)} cm。`)
  })
  ctx.command('impart.train [target:user]', '打胶，增加长度', { owner, authority: 1 }).alias('打胶', '开导')
    .action(({ session }, target) => play(session, target, 'train'))
  ctx.command('impart.mine [target:user]', '挖矿，减少长度', { owner, authority: 1 }).alias('挖矿')
    .action(({ session }, target) => play(session, target, 'mine'))
  ctx.command('impart.profile [target:user]', '查看长度和生长系数', { owner, authority: 1 }).alias('看看牛牛')
    .action(({ session }, raw) => safe(async () => {
      const actor = actorOf(session)
      if (!session) return ''
      const target = await targetOf(session, actor, raw)
      const result = await game.profile(actor, target.userId)
      refresh()
      if (result.kind === 'closed') return closed
      if (!result.player) return '该用户尚未参与。首次使用“打胶”或“挖矿”时初始化。'
      return h.escape(`${result.player.name}\n长度：${formatLength(result.player.length)} cm\n生长系数：${result.player.growthFactor.toFixed(2)}`)
    }))
  const rank = (session: Session | undefined, order: RankingOrder) => safe(async () => {
    const ranking = await game.ranking(actorOf(session), order)
    refresh()
    if (!ranking) return closed
    if (!ranking.players.length) return '当前范围暂无玩家记录。首次使用“打胶”或“挖矿”时初始化。'
    if (!game.config.imageMode) return h.escape(rankingText(ranking))
    try {
      const image = await render(ranking)
      signal.throwIfAborted()
      return String(h.image(image, 'image/png'))
    } catch (error) {
      if (signal.aborted) return ''
      ctx.logger.warn('Ranking image failed: %s', error)
      return h.escape(`图片生成失败，已改为文字排行。\n${rankingText(ranking)}`)
    }
  })
  ctx.command('impart.rank', '查看长度降序排行', { owner, authority: 1 }).alias('牛牛排行榜')
    .action(({ session }) => rank(session, 'length'))
  ctx.command('impart.mining-rank', '查看长度升序排行', { owner, authority: 1 }).alias('挖矿排行榜', '深度排行榜')
    .action(({ session }) => rank(session, 'mining'))
  for (const [name, alias, enabled] of [
    ['start', '开始银趴', true], ['end', '结束银趴', false]
  ] satisfies [string, string, boolean][]) {
    ctx.command(`impart.${name}`, alias, { owner, authority: 3 }).alias(alias)
      .action(({ session }) => safe(async () => {
        const actor = actorOf(session)
        if (!session || !await ctx.permissions.test('authority:3', session)) return '此操作需要管理员权限（权限等级 3）。'
        await game.party(actor, enabled)
        refresh()
        return enabled ? '本群银趴已开始，游戏功能已开放。' : '本群银趴已结束，游戏功能已暂停。'
      }))
  }
}
