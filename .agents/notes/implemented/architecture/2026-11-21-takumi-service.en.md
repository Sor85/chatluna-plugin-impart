# Agent Note: Render rankings through the takumi service

Status: implemented

## Problem

This plugin embedded a Takumi Renderer and the Noto Sans SC fonts. Enabled alongside the Bilibili card, mc-toolbox and meme-generator plugins, fonts and native renderers stayed resident several times and each plugin limited concurrency on its own.

## Decision

- `takumi` is an optional service: `package.json` declares `chatluna-plugin-takumi` as a peer dependency, `cordis.service.optional` lists `takumi`, and rendering reads it with `ctx.get('takumi')`. The `@takumi-rs/core` and font dependencies are gone.
- `renderRanking` (`src/render.ts`) only builds the node tree and applies the service's `fontFamily`; sizing is unchanged. The service queues concurrent renders instead of failing when busy.
- A missing service and a failed render share the same text fallback.

## Alternatives considered

- A required service: without takumi the whole game would stop, though the ranking image is an optional output; rejected.

## Consequences

- Without takumi, rankings are sent as text and the game keeps working.
