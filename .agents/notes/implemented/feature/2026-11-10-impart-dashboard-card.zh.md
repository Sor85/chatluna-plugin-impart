# Agent Note: 以仪表盘卡片取代独立管理页

Status: implemented

## Problem

用户要求删除侧栏「银趴」页面（`/impart`），改为把统计信息注入 V2 仪表盘，并提供默认开启的注入开关。

## Decision

- 客户端只向宿主核心 SlotMap 声明的 `dashboard.card` 插槽注册 `impart.stats` 卡片（`md`，order 70），与用量、定时任务插件的卡片注册方式一致；插槽注册随插件 fiber 自动卸载。
- 服务端只提供只读 `impart.stats` state：玩家数、全部与进行中群数、打胶榜首与挖矿榜首（有符号长度，同值按 id 稳定）。
- `Config.dashboard` 默认 `true`；关闭时 `src/index.ts` 不注入 WebUI，客户端入口与 state 都不注册。
- 页面专用的 `impart.groups`、`impart.ranking` state 与 `impart.party` action 一并删除，群开关只通过聊天指令操作，减少需要单独鉴权的写接口。

## Alternatives considered

- 保留页面并额外加卡片：用户明确要求删除页面。
- 卡片内提供群开关：仪表盘卡片定位为概览，写操作需另行鉴权，且聊天指令已覆盖。
- 客户端读取配置自行隐藏：需要额外公开配置，且关闭后仍加载客户端代码。

## Consequences

WebUI 不再能查看完整排行或切换群开关；完整排行通过聊天指令查看。仪表盘插件未加载时卡片不显示，但 state 仍会注册。
