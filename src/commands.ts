import type { Context } from 'cordis'
import type { Session } from 'koishi'
import { h } from '@satorijs/core'
import type {} from '@chatluna/permission'
import type { Game } from './game'
import type { Actor, Mode, RankingOrder, Target } from './types'
import { createRankingRenderer, rankingText } from './render'
import { displayName, formatLength, targetId } from './utils'

const closed = '本群银趴已结束，游戏功能已暂停。管理员可使用“开始银趴”恢复。'
const GROUP_NAME_TTL = 3600_000

async function targetOf(session: Session, actor: Actor, raw: string | undefined): Promise<Target> {
  const userId = targetId(raw, actor.platform) ?? actor.userId
  if (userId === actor.userId) return { userId, name: actor.name }
  const member = await session.bot.getGuildMember(session.guildId!, userId)
  if (member.user?.id !== userId) throw new Error('目标必须是本群成员。')
  return { userId, name: displayName(member.nick || member.user.name || userId, userId) }
}

export function registerCommands(ctx: Context, game: Game, signal: AbortSignal, refresh: () => void) {
  // OneBot 等平台的消息事件不带群名，按群查询一次并缓存，避免每条指令都调用平台接口。
  const groupNames = new Map<string, { name: string; at: number }>()
  const groupName = async (session: Session) => {
    const known = session.event.channel?.name || session.event.guild?.name
    if (known) return known
    const key = JSON.stringify([session.platform, session.guildId])
    const cached = groupNames.get(key)
    if (cached && Date.now() - cached.at < GROUP_NAME_TTL) return cached.name
    const fetched = await session.bot.getGuild(session.guildId!).then((guild) => guild.name, () => undefined)
    const name = fetched || cached?.name || session.channelId!
    groupNames.set(key, { name, at: Date.now() })
    return name
  }
  const actorOf = async (session: Session | undefined): Promise<Actor> => {
    if (!session?.userId || !session.channelId || session.isDirect || !session.guildId) throw new Error('此功能仅支持群聊。')
    return {
      platform: session.platform,
      channelId: session.channelId,
      groupName: await groupName(session),
      userId: session.userId,
      name: displayName(session.username, session.userId)
    }
  }
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
    '打胶（开导） [@成员]：增加长度\n挖矿 [@成员]：增加深度\n看看牛牛 [@成员]：查看长度、深度及各自的生长系数\n牛牛排行榜 / 挖矿排行榜：查看排名\n开始银趴 / 结束银趴：管理员设置本群开关\n首次打胶初始化长度，首次挖矿初始化深度；长度、深度、生长系数与群参与记录按玩法分开，数值跨群共享，打胶与挖矿共用冷却。'
  )
  const play = (session: Session | undefined, raw: string | undefined, mode: Mode) => safe(async () => {
    const actor = await actorOf(session)
    if (!session) return ''
    if (raw !== undefined && targetId(raw, actor.platform) === actor.userId) return '操作自己时不需要 @。'
    const target = await targetOf(session, actor, raw)
    const result = await game.play(actor, target, mode)
    refresh()
    if (result.kind === 'closed') return closed
    if (result.kind === 'cooldown') return h.escape(`${result.userId === actor.userId ? '当前用户' : '目标用户'}仍在冷却，剩余 ${result.seconds} 秒。`)
    const [action, label, value, factor] = mode === 'train'
      ? ['打胶', '长度', result.player.length!, result.player.growthFactor!]
      : ['挖矿', '深度', result.player.depth!, result.player.depthFactor!]
    if (result.kind === 'initialized') return h.escape(`${result.player.name} 已初始化${label} ${formatLength(value)} cm，生长系数 ${factor.toFixed(2)}。`)
    return h.escape(`${result.player.name} ${action}${result.success ? '成功' : '失败'}，${label} ${result.delta > 0 ? '+' : ''}${formatLength(result.delta)} cm，当前 ${formatLength(value)} cm。`)
  })
  ctx.command('impart.train [target:user]', '打胶，增加长度', { owner, authority: 1 }).alias('打胶', '开导')
    .action(({ session }, target) => play(session, target, 'train'))
  ctx.command('impart.mine [target:user]', '挖矿，增加深度', { owner, authority: 1 }).alias('挖矿')
    .action(({ session }, target) => play(session, target, 'mine'))
  ctx.command('impart.profile [target:user]', '查看长度、深度及各自的生长系数', { owner, authority: 1 }).alias('看看牛牛')
    .action(({ session }, raw) => safe(async () => {
      const actor = await actorOf(session)
      if (!session) return ''
      const target = await targetOf(session, actor, raw)
      const result = await game.profile(actor, target.userId)
      refresh()
      if (result.kind === 'closed') return closed
      if (!result.player) return '该用户尚未参与。首次使用“打胶”或“挖矿”时初始化。'
      const show = (value: number | null, factor: number | null) => value === null ? '未初始化' : `${formatLength(value)} cm（生长系数 ${factor!.toFixed(2)}）`
      const { name, length, growthFactor, depth, depthFactor } = result.player
      return h.escape(`${name}\n长度：${show(length, growthFactor)}\n深度：${show(depth, depthFactor)}`)
    }))
  const rank = (session: Session | undefined, order: RankingOrder) => safe(async () => {
    const ranking = await game.ranking(await actorOf(session), order)
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
  ctx.command('impart.mining-rank', '查看深度升序排行', { owner, authority: 1 }).alias('挖矿排行榜', '深度排行榜')
    .action(({ session }) => rank(session, 'mining'))
  for (const [name, alias, enabled] of [
    ['start', '开始银趴', true], ['end', '结束银趴', false]
  ] satisfies [string, string, boolean][]) {
    ctx.command(`impart.${name}`, alias, { owner, authority: 3 }).alias(alias)
      .action(({ session }) => safe(async () => {
        const actor = await actorOf(session)
        if (!session || !await ctx.permissions.test('authority:3', session)) return '此操作需要管理员权限（权限等级 3）。'
        await game.party(actor, enabled)
        refresh()
        return enabled ? '本群银趴已开始，游戏功能已开放。' : '本群银趴已结束，游戏功能已暂停。'
      }))
  }
}
