# Hand Capture Design

This document is the working design reference for adding poker hand capture to StackFlow. Read this before changing the hand capture model, entry flow, session detail UI, exports, or live-session hand actions.

## Goals

- Make live hand entry fast enough to use at the table right after a hand.
- Support partial capture without making the user feel like they failed to complete the form.
- Allow richer street-by-street detail when the user wants to review or export a hand.
- Keep the first implementation focused on No-Limit Hold'em.
- Store data in a StackFlow-owned model that can later export to standard or semi-standard formats.
- Start from the past session detail page so the flow can be tested without starting a live session.
- Later reuse the same add/edit flow from live cash and tournament screens.

## Non-Goals For The First Version

- No direct solver/GTO feedback in-app.
- No online poker hand history import.
- No variants beyond No-Limit Hold'em.
- No requirement that every hand has full action history.
- No complex route/state changes for live sessions.

## Research Notes

The poker ecosystem has two relevant format families:

- Site-generated text hand histories are the practical de facto standard used by tools such as PokerTracker and many hand converters. The exact text format varies by poker site, which is why parser projects exist.
- PHH is the closest open, documented hand-history standard found so far. It is TOML-based and designed to represent poker hand histories in a structured way.

Useful references:

- PHH spec: https://phh.readthedocs.io/en/stable/spec.html
- PHH required fields and actions: https://phh.readthedocs.io/en/stable/required.html
- PHH optional fields: https://phh.readthedocs.io/en/stable/optional.html
- PHH examples: https://phh.readthedocs.io/en/stable/examples.html
- HHSmithy parser: https://github.com/HHSmithy/PokerHandHistoryParser
- Poker Bankroll Tracker feature reference: https://pokerbankrolltracker.net/

Design implication: StackFlow should store a friendly internal JSON model first, then export lossless StackFlow JSON and PHH where enough structured detail exists.

## Core Product Assumptions

- The user usually enters the hand at the table shortly after it happened.
- `id`, `playedAt`, and `updatedAt` are system-managed.
- `id` is needed for stable edit/delete identity.
- Hand display numbers should be inferred from sorted position in the session's hand list, not stored.
- `playedAt` defaults to the current time and can be edited later.
- Stakes come from the parent session, not the hand.
- The first supported game is No-Limit Hold'em only.
- The user should choose hand table size/player count before choosing position.
- `tableSize` is required for every saved hand.
- The UI should default `tableSize` from the previous hand in the same session when available.
- Table size drives which position pills are shown.
- Cash amounts are stored as cents.
- Tournament amounts are stored as chips.
- Amount inputs should be labeled according to session mode so the user is not guessing.
- Tournament hands should capture blind context because stack depth in big blinds is important for analysis.
- Player names should default to anonymous labels for privacy: `Hero`, `Villain 1`, `Villain 2`, etc.

## Proposed Data Model

Add optional hands to a session:

```ts
interface Session {
  // existing fields...
  hands?: PokerHand[];
}
```

The hand model should allow partial data:

```ts
interface PokerHand {
  id: string;
  playedAt: number;
  updatedAt: number;
  tableSize: HandTableSize;
  blindLevel?: HandBlindLevel;

  players: HandPlayer[];
  board?: HandBoard;
  actions?: HandAction[];
  result?: HandResult;

  tags?: HandTag[];
  note?: string;
}
```

Notes:

- `id` is the stable identifier for editing, deleting, and exporting a specific hand.
- Do not store `handNumber` in the first version. Show `Hand 1`, `Hand 2`, etc. by sorting hands and using the list index.
- If users later need casino-style hand numbers or imported online hand numbers, add a separate optional `externalHandNumber?: string`.
- A hand should always have one hero player. The app should create it automatically with `id: 'hero'`, `label: 'Hero'`, and `isHero: true`.

### Positions

```ts
type PokerPosition =
  | 'SB'
  | 'BB'
  | 'UTG'
  | 'UTG+1'
  | 'UTG+2'
  | 'UTG+3'
  | 'LJ'
  | 'HJ'
  | 'CO'
  | 'BTN';

type HandTableSize = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
```

Notes:

- Position is optional because many quick captures may only need cards, result, tags, and note. Leave it unset when it was not captured.

### Table Size And Position Options

`tableSize` means the number of players dealt into the hand, not the venue's maximum table size and not the number of players who saw the flop.

The UI should ask for table size before position, then show only the relevant position pills:

| Table size | Position options |
| --- | --- |
| 2 | SB/BTN, BB |
| 3 | SB, BB, BTN |
| 4 | SB, BB, CO, BTN |
| 5 | SB, BB, UTG, CO, BTN |
| 6 | SB, BB, UTG, HJ, CO, BTN |
| 7 | SB, BB, UTG, LJ, HJ, CO, BTN |
| 8 | SB, BB, UTG, UTG+1, LJ, HJ, CO, BTN |
| 9 | SB, BB, UTG, UTG+1, UTG+2, LJ, HJ, CO, BTN |
| 10 | SB, BB, UTG, UTG+1, UTG+2, UTG+3, LJ, HJ, CO, BTN |

Notes:

- Store specific canonical positions rather than a generic `MP`. `MP` is common shorthand, but it becomes ambiguous across 8, 9, and 10 handed tables.
- For heads-up, the button is also the small blind. The UI can display `SB/BTN` while storing `BTN`.
- The first implementation should remember the previous hand's table size within the same session and default the next hand to it.
- If there is no previous hand in the session, use a conservative default such as 9 handed unless we decide to add a user preference.

### Players

```ts
interface HandPlayer {
  id: string;
  label: string;
  isHero: boolean;
  position?: PokerPosition;
  cards?: [string, string];
  startingStack?: number;
}
```

Notes:

- The first version should default to one player: `{ id: 'hero', label: 'Hero', isHero: true }`.
- A hand should have exactly one player with `isHero: true`.
- Villains should use anonymous default labels and `isHero: false`.
- `cards` use compact card codes such as `Ah`, `Ks`, `Td`.
- `startingStack` is cash cents for cash sessions and chips for tournament sessions.
- `seat` is intentionally omitted. Position should be enough for quick capture and review.
- If action details are entered, the UI can create villains with ids such as `v1`, `v2`, etc.
- Anonymous labels should be the default. Real names can be a later enhancement if there is demand.

### Blind Level

```ts
interface HandBlindLevel {
  smallBlind: number;
  bigBlind: number;
  ante?: number;
  bigBlindAnte?: number;
  label?: string;
}
```

Notes:

- `blindLevel` is primarily for tournament sessions.
- Values are tournament chips.
- `smallBlind` and `bigBlind` are required when `blindLevel` is present.
- `ante` represents a per-player ante.
- `bigBlindAnte` represents a single big-blind ante.
- `label` can capture human-friendly tournament level text such as `Level 8`.
- Stack depth can be derived as `startingStack / blindLevel.bigBlind`.
- The UI should default `blindLevel` from the previous hand in the same tournament session when available.
- For cash sessions, blind context can usually be inferred from session stakes and can stay unset in the first version.
- PHH supports blind context through `antes`, `blinds_or_straddles`, and `min_bet` for no-limit hold'em. PHH also has `starting_stacks`, so our `startingStack` plus `blindLevel` fields line up with later export needs.

### Board

```ts
interface HandBoard {
  flop?: [string, string, string];
  turn?: string;
  river?: string;
}
```

Notes:

- Run-it-twice and double-board hands are intentionally out of scope for the first version.
- If needed later, this can evolve to `runouts?: HandRunout[]`.

### Actions

```ts
type HandStreet = 'preflop' | 'flop' | 'turn' | 'river';

type HandActionType =
  | 'postSmallBlind'
  | 'postBigBlind'
  | 'postAnte'
  | 'straddle'
  | 'fold'
  | 'check'
  | 'call'
  | 'bet'
  | 'raise'
  | 'allIn'
  | 'collectPot'
  | 'show'
  | 'muck';

interface HandAction {
  id: string;
  street: HandStreet;
  actorId: string;
  type: HandActionType;
  amount?: number;
  raiseToAmount?: number;
  note?: string;
}
```

Notes:

- `amount` is cash cents for cash sessions and chips for tournament sessions.
- `raiseToAmount` captures the common live phrasing "raise to 75".
- The UI should use a smaller action set first: fold, check, call, bet, raise to, all-in.
- Blind, ante, straddle, collect-pot, show, and muck can be generated or entered through advanced controls later.
- Do not model `showdown` as a street in the first version. Showdown is captured with `result.wentToShowdown` and optional revealed cards on `HandPlayer.cards`.
- Do not store cards on actions. Board cards belong on `HandBoard`; player hole cards belong on `HandPlayer.cards`.

### Result

```ts
interface HandResult {
  heroNetAmount?: number;
  outcome?: 'won' | 'lost' | 'chopped';
  potAmount?: number;
  wentToShowdown?: boolean;
}
```

Notes:

- `heroNetAmount` is the most important result field.
- Leave `outcome` unset when it was not captured.
- Positive means hero won. Negative means hero lost.
- Cash sessions store cents. Tournament sessions store chips.
- The UI should make win/loss entry fast with plus/minus controls or segmented outcome buttons.

### Tags

```ts
type HandTag =
  | 'bigPot'
  | 'bluff'
  | 'heroCall'
  | 'badBeat'
  | 'allIn'
  | 'threeBetPot'
  | 'fourBetPot'
  | 'multiway'
  | 'mistake'
  | 'review'
  | 'interesting';
```

Notes:

- Tags should be pill buttons.
- The most common tags should be visible first.
- Custom tags can be considered later.

## UX Direction

Use a wizard-style sheet that supports quick exit to the result step.

Core idea: a user can enter only the pieces they remember now, save the hand, and fill in details later.

### Wizard Steps

1. Hero
   - Table size
   - Tournament blinds when session mode is tournament
   - Cards
   - Position
   - Optional starting stack
   - Actions: Next, Skip to Result, Save Partial

2. Preflop
   - Optional villain count
   - Fast action builder
   - Actions: Next, Skip to Result, Save Partial

3. Flop
   - Flop cards
   - Optional actions
   - Actions: Next, Skip to Result, Save Partial

4. Turn
   - Turn card
   - Optional actions
   - Actions: Next, Skip to Result, Save Partial

5. River
   - River card
   - Optional actions
   - Actions: Next, Skip to Result, Save Partial

6. Result
   - Hero net result
   - Tags
   - Notes
   - Played at
   - Actions: Save, Save & Add Another, Cancel

### Fast Capture Priorities

Explore and prefer controls that reduce typing:

- Card picker optimized for two-card entry and board entry.
- Table size slider, defaulting to the previous hand in the same session.
- Position slider whose stops are derived from the selected table size, defaulting to the previous hero position when valid.
- Position pills remain a fallback if sliders feel awkward in phone testing.
- Tournament blind-level inputs defaulting to the previous hand in the same session.
- Tag pills.
- Segmented win/loss/chop outcome control.
- Numeric input with plus/minus sign handling for result.
- Recent amounts or quick chips for tournament sessions if useful.
- `Save & Add Another` for breaks or after-session batch entry.
- Defaults from session: stakes, mode, amount unit.
- Defaults from current time: playedAt.
- Defaults from previous hand in same session where useful: table size, hero position, blind level, villain labels.

## Session Detail UX

Start the feature from the past sessions detail/edit page.

Add a `Hands` section to the session detail view:

- Header with hand count and `Add Hand`.
- Empty state when no hands have been captured.
- Compact list of hands:
  - Derived hand display number
  - Played time
  - Hero cards
  - Position
  - Result
  - Tags
  - Note preview
- Tap/click a hand to view details.
- Per-hand actions later: edit, duplicate, delete, export.

## Live Session UX

Later, add `Add Hand` to live cash and tournament screens.

The same wizard should be reused. Live session entry should default `playedAt` to now and should return to the live session after save.

## Export Direction

Support exports in this order:

1. StackFlow JSON
   - Lossless.
   - Always available.

2. PHH
   - Available when enough structure exists.
   - Best candidate for standard or semi-standard integration.

3. Plain text summary
   - Human-readable copy/paste format.
   - Useful for asking another person or external tool for advice.
   - Not treated as the canonical model.

## Open Questions

- Should tournament hand result entry require explicit `+` or `-`, or use outcome plus amount?
- Should the first implementation include street actions, or only lay the model groundwork and start with quick capture plus board?
- How much validation should card entry enforce at first?
- Should `startingStack` be part of the first UI or delayed until advanced details?
- Should tournament blind level be part of the first Hero step or a compact advanced row defaulted from the previous hand?
- Should delete/edit hand actions ship in the first implementation or second?
