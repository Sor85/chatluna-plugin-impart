# Agent Note: Separate training and mining data, shared cooldown

Status: implemented

## Problem

After length and depth were split, the growth factor and group participation records were still shared by both modes, and the dashboard only showed length: a player who only mined counted toward the group's training players, and mining reused the factor generated for training. The user asked for training and mining data to be tracked separately, sharing only the cooldown.

## Decision

- The user confirmed splitting all three: growth factor, group participation, and dashboard display. The cooldown `lastActionAt` stays a single column shared by both modes.
- Growth factor: `growthFactor` becomes the nullable length factor, and a new nullable `depthFactor` holds the depth factor; each is generated when its value is initialized. The host SQLite driver rebuilds the whole table on a column rename (`legacy`), so the `growthFactor` name is kept.
- Participation: `impart_memberships` gains boolean `length` and `depth` columns (initial `false`), set by training and mining respectively; group rankings and the dashboard filter by them. There is still one row per player per group, and groups are ordered by total participants.
- Dashboard: totals are now trainers, miners, groups, and active groups; each group lists the top and bottom 5 for length (longest first) and depth (deepest first) with their participant counts. `Entry.length` is renamed to `value`.
- Migration: `Game.migrate` is queued on plugin start and is idempotent: players with depth but no depth factor copy the old factor; players without length have their length factor cleared; legacy participation rows with both flags `false` are flagged from the values the player has initialized.

## Alternatives considered

- One participation row per mode (mode in the key): legacy rows would have to be deleted and recreated, while boolean columns are a plain `ALTER TABLE ADD`.
- Re-rolling depth factors for existing players: their depth growth rate would change abruptly; the user chose to keep the old value.

## Consequences

Legacy participation rows do not record which mode was played in that group, so migration approximates from the player's initialized values; a legacy player who mined elsewhere and only trained here may appear on this group's mining board. An empty participant list returns an empty board directly, because the SQLite driver generates invalid SQL for aggregate queries on an empty id list.
