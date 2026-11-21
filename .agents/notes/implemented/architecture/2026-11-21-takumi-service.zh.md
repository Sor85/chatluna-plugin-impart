# Agent Note: 排行榜改用 takumi 服务渲染

Status: implemented

## Problem

本插件内置 Takumi Renderer 与 Noto Sans SC 字体。与 B 站卡片、mc-toolbox、meme-generator 同时启用时，字体和原生 Renderer 常驻多份，渲染并发各自限制。

## Decision

- `takumi` 作为可选服务：`package.json` 以 peerDependency 声明 `chatluna-plugin-takumi`，`cordis.service.optional` 列出 `takumi`，渲染时 `ctx.get('takumi')` 取用。移除 `@takumi-rs/core` 与字体依赖。
- `renderRanking`（`src/render.ts`）只构建节点树并设置服务给出的 `fontFamily`，尺寸计算不变。并发由服务排队，不再在繁忙时直接失败。
- 服务未启用与渲染失败走同一条文字回退。

## Alternatives considered

- 设为必需服务：未启用 takumi 时整个游戏停用，而排行榜图片只是可选输出，拒绝。

## Consequences

- 不启用 takumi 时排行榜以文字发送，游戏功能不受影响。
