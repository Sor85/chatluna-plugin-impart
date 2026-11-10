# Agent Note: Dashboard card replaces the standalone page

Status: implemented

## Problem

The user asked to remove the sidebar "Party" page (`/impart`), inject the plugin's statistics into the V2 dashboard instead, and add a default-on toggle for the injection.

## Decision

- The client registers only an `impart.stats` card (`md`, order 70) in the `dashboard.card` slot declared by the core SlotMap, matching the usage and schedule cards; the registration is disposed with the plugin fiber.
- The server exposes only the read-only `impart.stats` state: player count, total and active group counts, and the training and mining leaders (signed length, ties broken by id).
- `Config.dashboard` defaults to `true`; when disabled `src/index.ts` skips the WebUI injection, so neither the client entry nor the state is registered.
- The page-only `impart.groups` and `impart.ranking` states and the `impart.party` action are removed. Group switches stay in chat commands, leaving no separately authorized write endpoint.

## Alternatives considered

- Keeping the page alongside the card: the user explicitly asked to remove it.
- Group switches inside the card: dashboard cards are overviews, writes would need their own authorization, and chat commands already cover them.
- Hiding the card client-side from config: requires exposing config and still loads client code when disabled.

## Consequences

The WebUI no longer shows full rankings or toggles groups; full rankings are available through chat commands. Without the dashboard plugin the card is not shown, though the state is still registered.
