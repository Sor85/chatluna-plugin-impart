#!/usr/bin/env node
import assert from 'node:assert/strict'
import { randomInt, randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const host = process.env.IMPART_HOST_URL
const endpoint = process.env.IMPART_TEST_URL
const token = process.env.CHATLUNA_TOKEN
if (!host || !endpoint || !token) throw new Error('需要 IMPART_HOST_URL、IMPART_TEST_URL 和 CHATLUNA_TOKEN；仅用于隔离测试实例。')
const runId = `impart-${randomUUID()}`
const output = resolve(process.env.IMPART_EVIDENCE_DIR ?? `.test-artifacts/${runId}`)
await mkdir(output, { recursive: true })
const checks = []
const base = 880000000 + randomInt(1000000)
const owner = String(base), member = String(base + 1), bot = String(base + 2), group = String(base + 3), secondGroup = String(base + 4)
let credential
let spaceId
let success = false

async function request(url, bearer, input) {
  const response = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input), signal: AbortSignal.timeout(45000)
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${new URL(url).pathname}: HTTP ${response.status}: ${text.slice(0, 500)}`)
  return text ? JSON.parse(text) : undefined
}
const action = (name, input = {}) => request(`${host}/api/action/${name}`, token, input)
const tool = (name, input = {}) => request(`${endpoint}/tools/${name}`, credential.token, { ...input, testRunId: runId })
function passed(name, detail) {
  checks.push({ name, passed: true, detail })
  console.log(`通过：${name}${detail ? ` · ${detail}` : ''}`)
}
async function send(content, { user = owner, channel = group, quiet = false } = {}) {
  const sent = await tool('send_message', { spaceId, operatorId: user, conversationId: `group:${channel}`, content: `/${content}`, idempotencyKey: randomUUID() })
  const waited = await tool('wait_for_message', { spaceId, cursor: sent.cursorBefore, conversationId: `group:${channel}`, authorId: bot, timeoutSeconds: quiet ? 2 : 20, settleSeconds: quiet ? 0 : 1 })
  if (quiet && waited.outcome === 'timeout') return ''
  assert.equal(waited.outcome, 'matched', `指令未回复：${content}`)
  const message = waited.event.data
  await writeFile(resolve(output, `message-${checks.length}-${randomUUID()}.json`), JSON.stringify({ content, message }, null, 2))
  return message
}
const body = (message) => typeof message === 'string' ? message : message.content
function has(message, pattern) { assert.match(body(message), pattern); return message }

try {
  credential = await action('onebot-sandbox.create-test-credential', { name: runId, scopes: ['read', 'interact', 'manage', 'debug'] })
  const created = await tool('create_test_space', { name: `Impart 隔离回归 ${runId.slice(-8)}`, idempotencyKey: randomUUID() })
  spaceId = created.spaceId
  await tool('apply_environment_changes', {
    spaceId, expectedRevision: created.revision, idempotencyKey: randomUUID(),
    changes: [
      { action: 'create-user', data: { id: owner, name: '测试矿工甲' } },
      { action: 'create-user', data: { id: member, name: '测试矿工乙' } },
      { action: 'create-bot', data: { id: bot, name: 'Impart 测试机器人', implementation: 'napcat', enabled: true } },
      ...[group, secondGroup].map((id, index) => ({ action: 'create-group', data: { id, name: `Impart 验收群 ${index + 1}`, members: [
        { participantId: owner, role: 'owner' }, { participantId: member, role: 'member' }, { participantId: bot, role: 'admin' }
      ] } }))
    ]
  })
  passed('独立空间与随机用户群创建', spaceId)
  has(await send('看看牛牛'), /尚未参与/)
  passed('查询不自动初始化')
  has(await send('打胶'), /已初始化.*18\.00 cm/)
  passed('首次仅初始化')
  has(await send('挖矿'), /冷却/)
  passed('打胶与挖矿共享冷却')
  await delay(5100)
  has(await send('开导'), /打胶成功，长度 \+/)
  passed('开导别名与成功增长')
  await delay(5100)
  has(await send('挖矿'), /挖矿成功，长度 -.*当前 18\.00 cm/)
  passed('挖矿反向减少')
  await delay(5100)
  has(await send('挖矿'), /挖矿成功/)
  await delay(5100)
  has(await send('挖矿'), /当前 -/)
  passed('挖矿跨过零点')
  const profile = has(await send('看看牛牛'), /长度：-.*cm\n生长系数：/)
  assert.doesNotMatch(body(profile), /货币|余额/)
  passed('个人查询包含负长度且没有货币')
  has(await send(`打胶 <at id="${member}"/>`), /测试矿工乙 已初始化/)
  await delay(5100)
  has(await send(`打胶 <at id="${member}"/>`), /测试矿工乙 打胶成功/)
  passed('提及成员初始化和帮助成长')
  has(await send('挖矿', { channel: secondGroup }), /冷却/)
  has(await send('挖矿', { user: member, channel: secondGroup }), /冷却/)
  passed('帮助双方冷却跨群生效')
  has(await send('打胶 <at type="all"/>'), /有效用户|全体成员|正确的用户/)
  passed('拒绝全体提及')
  for (const command of ['牛牛排行榜', '挖矿排行榜']) {
    const reply = await send(command)
    const conversation = await tool('get_conversation', { spaceId, operatorId: owner, conversationId: `group:${group}`, messageLimit: 100 })
    const message = conversation.messages.find((item) => item.id === reply.id) ?? conversation.messages.filter((item) => item.authorId === bot).at(-1)
    const media = message.media?.find((item) => item.type === 'image' || item.mimeType === 'image/png') ?? message.media?.[0]
    assert.ok(media, `${command} 未收到真实图片：${JSON.stringify(message)}`)
    const image = await action('onebot-sandbox.media-content', { spaceId, operatorId: owner, mediaId: media.id })
    const png = Buffer.from(image.dataBase64, 'base64')
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    assert.equal(png.readUInt32BE(16), 960)
    await writeFile(resolve(output, `${command}.png`), png)
    passed(`${command}真实 Takumi PNG`, `${png.readUInt32BE(16)}×${png.readUInt32BE(20)}，${png.length} 字节`)
  }
  const denied = await send('结束银趴', { user: member, quiet: true })
  assert.doesNotMatch(body(denied), /本群银趴已结束/)
  has(await send('看看牛牛'), /生长系数/)
  passed('普通成员不能关闭群游戏')
  has(await send('结束银趴'), /本群银趴已结束/)
  has(await send('结束银趴'), /本群银趴已结束/)
  has(await send('打胶'), /游戏功能已暂停/)
  has(await send('看看牛牛'), /游戏功能已暂停/)
  has(await send('牛牛排行榜'), /游戏功能已暂停/)
  passed('结束幂等并拦截操作、查询与排行榜')
  has(await send('看看牛牛', { channel: secondGroup }), /生长系数/)
  passed('关闭只作用于当前群')
  has(await send('开始银趴'), /本群银趴已开始/)
  has(await send('开始银趴'), /本群银趴已开始/)
  const restored = await send('看看牛牛')
  assert.equal(body(restored), body(profile))
  passed('开始幂等且不重置长度')
  const help = body(await send('银趴'))
  for (const removed of ['保养', '决斗', '重开', '锁牛牛', '注入', '货币']) assert.ok(!help.includes(removed))
  passed('帮助只展示保留功能')
  for (const removed of ['保养', '牛牛决斗', '重开牛牛', '锁牛牛', '注入', '注入排行榜']) {
    const reply = await send(removed, { quiet: true })
    assert.equal(body(reply), '', `已移除指令仍在回复：${removed}`)
  }
  passed('已移除指令全部不再响应')
  const groupId = JSON.stringify(['onebot', group])
  const closed = await action('impart.party', { groupId, enabled: false })
  assert.equal(closed.enabled, false)
  has(await send('看看牛牛'), /游戏功能已暂停/)
  await action('impart.party', { groupId, enabled: true })
  has(await send('看看牛牛'), /生长系数/)
  passed('ui-kit 管理页后端开关与聊天状态一致')
  const unauth = await fetch(`${host}/api/action/impart.party`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId, enabled: false }) })
  assert.equal(unauth.status, 401)
  passed('WebUI 未鉴权请求被拒绝')
  await action('impart.party', { groupId: JSON.stringify(['onebot', secondGroup]), enabled: false })
  passed('保留可预览的暂停与空列表测试群')
  success = true
} catch (error) {
  checks.push({ name: '执行中断', passed: false, detail: error.message })
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (spaceId && credential) {
    try { await tool(success ? 'complete_test_space' : 'fail_test_space', { spaceId, idempotencyKey: randomUUID() }) } catch (error) { console.error(`空间收尾失败：${error.message}`); process.exitCode = 1 }
  }
  if (credential) {
    try { await action('onebot-sandbox.revoke-test-credential', { id: credential.id }) } catch (error) { console.error(`测试凭据撤销失败：${error.message}`); process.exitCode = 1 }
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ runId, spaceId, group, secondGroup, owner, member, bot, success, checks, completedAt: new Date().toISOString() }, null, 2))
  console.log(`证据目录：${output}`)
  if (spaceId) console.log(`测试空间：${spaceId}`)
}
