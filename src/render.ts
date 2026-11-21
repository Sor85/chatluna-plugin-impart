import type Takumi from 'chatluna-plugin-takumi'
import type { Node, TextNode } from 'chatluna-plugin-takumi'
import type { Player, Ranking } from './types'
import { formatLength } from './utils'

function measure(ranking: Ranking, player: Player) {
  return formatLength(ranking.order === 'length' ? player.length! : player.depth!)
}

function text(value: string, style: TextNode['style'] = {}): TextNode {
  return { type: 'text', text: value, style }
}

export function rankingText(ranking: Ranking) {
  const title = ranking.order === 'length' ? '牛牛排行榜' : '挖矿排行榜'
  const scope = ranking.allChannels ? `${ranking.group.platform} 全平台` : ranking.group.name
  return `${title} · ${scope}\n${ranking.players.map((player, index) => `${index + 1}. ${player.name}  ${measure(ranking, player)} cm`).join('\n')}`
}

export function rankingNode(ranking: Ranking): Node {
  const mining = ranking.order === 'mining'
  return {
    type: 'container',
    style: {
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 48,
      backgroundColor: '#fafaf9', color: '#1c1917', fontSize: 24, lineHeight: 1.5
    },
    children: [
      text('IMPART  /  CHATLUNA', { fontSize: 16, color: '#57534e', letterSpacing: 3 }),
      text(mining ? '挖矿排行榜' : '牛牛排行榜', { fontSize: 44, fontWeight: 700, marginTop: 12 }),
      text(`${ranking.allChannels ? `${ranking.group.platform} · 全平台` : ranking.group.name}  ·  ${ranking.players.length} 位玩家`, {
        fontSize: 20, color: '#57534e', marginTop: 8, marginBottom: 28
      }),
      ...ranking.players.map((player, index): Node => ({
        type: 'container',
        style: {
          display: 'flex', alignItems: 'center', height: 76, flexShrink: 0,
          borderTop: '1px solid #e7e5e4', gap: 20
        },
        children: [
          text(String(index + 1).padStart(2, '0'), { width: 44, fontSize: 20, color: '#57534e' }),
          {
            type: 'container', style: { display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0 },
            children: [
              text(Array.from(player.name).length > 18 ? `${Array.from(player.name).slice(0, 18).join('')}…` : player.name, { fontSize: 24 }),
              text(`@${player.userId.slice(0, 32)}`, { fontSize: 15, color: '#57534e' })
            ]
          },
          text(`${measure(ranking, player)} cm`, { fontSize: 26, fontWeight: 600, flexShrink: 0 })
        ]
      })),
      text(mining ? '深度升序 · 数值越小挖得越深 · 深度跨群共享' : '长度降序 · 打胶与挖矿共用冷却 · 长度跨群共享', {
        fontSize: 16, color: '#57534e', marginTop: 28
      })
    ]
  }
}

export function renderRanking(takumi: Pick<Takumi, 'render' | 'fontFamily'>, ranking: Ranking, signal: AbortSignal) {
  const node = rankingNode(ranking)
  node.style = { ...node.style, fontFamily: takumi.fontFamily }
  return takumi.render(node, { width: 960, height: 310 + ranking.players.length * 76, format: 'png', signal })
}
