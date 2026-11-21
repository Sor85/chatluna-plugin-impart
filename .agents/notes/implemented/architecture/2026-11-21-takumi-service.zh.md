# Agent Note: 排行榜改用 takumi 服务渲染

Status: implemented

## Problem

本插件内置 Takumi Renderer 与 Noto Sans SC 字体。与 B 站卡片、mc-toolbox、meme-generator 同时启用时，字体和原生 Renderer 常驻多份，渲染并发各自限制。

## Decision

- `takumi` 作为必需服务：`package.json` 以 peerDependency 声明 `chatluna-plugin-takumi`，`cordis.service.required` 与 `inject` 列出 `takumi`，渲染时直接使用 `ctx.takumi`。移除 `@takumi-rs/core` 与字体依赖。
- `renderRanking`（`src/render.ts`）只构建节点树并设置服务给出的 `fontFamily`，尺寸计算不变。并发由服务排队，不再在繁忙时直接失败。
- 渲染失败仍回退文字排行。

## Alternatives considered

- 可选服务（`cordis.service.optional` 加调用时 `ctx.get`）：最初采用。宿主 WebUI 的「服务依赖」面板只读 `inject`，可选服务不显示，用户看不出需要安装 takumi；而 Cordis 4 把 `inject` 的每一项都当作必需，写成 `{ takumi: { required: false } }` 面板显示「可选」，实际缺少服务时插件不启动。改为必需。

## Consequences

- 未启用 takumi 时整个插件不启动。takumi 字体按需加载，不渲染时只占约 13 MB，迁移前插件自带 Takumi，图片能力始终可用，行为与此一致。
