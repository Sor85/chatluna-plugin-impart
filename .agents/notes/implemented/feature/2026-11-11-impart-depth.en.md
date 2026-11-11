# Agent Note: Split training length from mining depth

Status: implemented

## Problem

Mining used to be the reverse of training on a single shared length, initialized at `18 ±45%` on first play. The user asked for separate initialization: training defaults to 0–18 cm, mining to 0 to -18 cm, and mining text should say "depth" instead of "length".

## Decision

- The user confirmed two independent values: `length` and the new `depth` on `impart_players` are both nullable integers (hundredths of a centimeter); `null` means that mode has not been initialized. Training only reads and writes length, mining only depth.
- `initialVariance` is removed in favor of separate lower and upper bounds for length and depth (`initialLengthMin/Max` default 0/18, `initialDepthMin/Max` default -18/0); initial values are uniform within the range, and `Game` throws on construction when a lower bound exceeds its upper bound. The user asked for both bounds to be configurable instead of fixing one at 0. The growth factor is still generated once when the record is created and shared by both modes.
- A player with an existing record who uses the other mode for the first time only initializes that value and spends their cooldown; only the initialized player's cooldown is checked, keeping the "target first, then actor" initialization order.
- The length ranking and dashboard only include players with an initialized length; the mining ranking only includes players with an initialized depth, sorted ascending. Dashboard ranks count the group's participants with a length, while the group size stays the historical participant count.
- SQLite columns are nullable by default, so marking `length` nullable keeps the column type and avoids a table rebuild; `depth` is added with `ALTER TABLE ADD`, leaving existing lengths intact and depths empty.

## Alternatives considered

- Keep one shared value and only pick the initial sign by the first command: the same number would be both length and depth, which does not match "separate initialization"; the user declined it.
- Boolean initialization flags: would need default-value migrations, while nullable columns already express the state.

## Consequences

Mining no longer affects length and training no longer affects depth; lengths lowered by mining in the previous version keep their values. Cooldown remains shared by both modes. The dashboard shows length only, not depth.
