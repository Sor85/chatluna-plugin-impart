# Agent Note: Render rankings through the takumi service

Status: implemented

## Problem

This plugin embedded a Takumi Renderer and the Noto Sans SC fonts. Enabled alongside the Bilibili card, mc-toolbox and meme-generator plugins, fonts and native renderers stayed resident several times and each plugin limited concurrency on its own.

## Decision

- `takumi` is a required service: `package.json` declares `chatluna-plugin-takumi` as a peer dependency, `cordis.service.required` and `inject` list `takumi`, and rendering uses `ctx.takumi` directly. The `@takumi-rs/core` and font dependencies are gone.
- `renderRanking` (`src/render.ts`) only builds the node tree and applies the service's `fontFamily`; sizing is unchanged. The service queues concurrent renders instead of failing when busy.
- A failed render still falls back to the text ranking.

## Alternatives considered

- An optional service (`cordis.service.optional` plus `ctx.get` at call time): the first version. The host WebUI's service dependency panel reads only `inject`, so optional services are not listed and users cannot tell takumi is needed. Cordis 4 treats every `inject` entry as required: `{ takumi: { required: false } }` shows as optional in the panel, yet the plugin does not start without the service. Switched to required.

## Consequences

- Without takumi the plugin does not start. takumi loads fonts on demand and takes about 13 MB while idle; before the migration the plugin bundled Takumi and always had images, so behaviour matches.
