# Agent Note: 以仪表盘卡片取代独立管理页

Status: implemented

## Problem

用户要求删除侧栏「银趴」页面（`/impart`），改为把统计信息注入 V2 仪表盘，并提供默认开启的注入开关。

## Decision

- 客户端只向宿主核心 SlotMap 声明的 `dashboard.card` 插槽注册 `impart.stats` 卡片（`lg` 整行，order 70），与用量、定时任务插件的卡片注册方式一致；插槽注册随插件 fiber 自动卸载。
- 服务端只提供只读 `impart.stats` state：玩家数、全部与进行中群数，以及按历史参与人数排序的前 6 个群各自按长度排列的最长与最短各 5 名（名次连续，人数不足 10 时全部列出，中间名次仅给出省略数）（有符号长度，同值按 id 稳定）。数量上限写在 `src/game.ts`，用于限制单次 state 推送体积；超出的群只给出数量。
- `Config.dashboard` 默认 `true`；关闭时 `src/index.ts` 不注入 WebUI，客户端入口与 state 都不注册。
- 页面专用的 `impart.groups`、`impart.ranking` state 与 `impart.party` action 一并删除，群开关只通过聊天指令操作，减少需要单独鉴权的写接口。

## Alternatives considered

- 保留页面并额外加卡片：用户明确要求删除页面。
- 卡片内提供群开关：仪表盘卡片定位为概览，写操作需另行鉴权，且聊天指令已覆盖。
- 客户端读取配置自行隐藏：需要额外公开配置，且关闭后仍加载客户端代码。

## Consequences

WebUI 不再能查看完整排行或切换群开关；完整排行通过聊天指令查看。仪表盘插件未加载时卡片不显示，但 state 仍会注册。

## 群名补全（2026-11-11）

OneBot 消息事件不带群名，首次建档的群曾只记录群号。现在事件缺少群名时通过 `bot.getGuild` 查询并缓存一小时，任何指令取到真实群名都会更新记录，群号回退值不覆盖已有群名。只显示群号的旧群在下一次有人使用指令后更新。


## 适配小组件看板（2026-11-15）

V2 仪表盘改为可编辑的小组件看板，`dashboard.card` 插槽不再渲染，卡片因此消失。现改用 `ctx.slots.widget()` 注册 `impart.stats`（order 70，默认 `lg`，可选 `sm`/`md`/`lg`/`xl`，图标 `trophy`），标题与图库说明经 `ctx.locale.bind('impart')` 取多语言文案。看板绘制外框与标题，组件按尺寸取舍内容：`sm` 只显示四项总数，`md` 每群一行列出长度与深度第一名，`lg`、`xl` 显示完整首尾榜单，`xl` 依容器宽度分列。看板格子高度固定，内容超出时在组件内滚动。state 与 `Config.dashboard` 的挂载规则不变。
