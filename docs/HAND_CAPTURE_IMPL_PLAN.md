# Hand Capture Implementation Plan

This is the working implementation plan for hand capture. Keep this aligned with `docs/HAND_CAPTURE_DESIGN.md` as decisions change.

## Guiding Principle

Prefer simple, fast capture over exhaustive entry. The data model may support detail, but the first user experience should make a useful partial hand easy to save.

## Phase 0: Design Documentation

Status: In progress.

- Add `docs/HAND_CAPTURE_DESIGN.md`.
- Add this implementation plan.
- Iterate on model and UX before writing feature code.

## Phase 1: Model And Storage Foundation

Goal: Support storing hands on sessions without changing visible app behavior.

Tasks:

- Add hand capture types, likely in `src/models/hand.ts`.
- Add `hands?: PokerHand[]` to `Session`.
- Add domain helpers:
  - `getSessionHands(session): PokerHand[]`
  - `getHeroPlayer(hand): HandPlayer`
  - `getDefaultTableSize(session): HandTableSize`
  - `getDefaultBlindLevel(session): HandBlindLevel | undefined`
  - `sortHandsByPlayedAt(hands): PokerHand[]`
  - `getHandDisplayNumber(session, handId): number | null`
  - `createDefaultHeroPlayer(): HandPlayer`
  - card/code validation helpers if needed
- Add service methods:
  - `addHandToSession(sessionId, input)`
  - `updateSessionHand(sessionId, handId, updates)`
  - `deleteSessionHand(sessionId, handId)`
- Keep legacy sessions backward compatible by treating missing `hands` as an empty array.
- Add unit tests for required table size validation, previous-table-size defaulting, tournament blind-level validation/defaulting, default hero creation, exactly-one-hero validation, derived display numbering, add/update/delete behavior, and backward compatibility.

Notes:

- This phase can target completed sessions first because the first UI entry point is the session detail page.
- Live active-session methods can be thin wrappers later.

## Phase 2: Session Detail Hand Section

Goal: Make hands visible and addable from the past session detail/edit page.

Tasks:

- Add a `Hands` section to the session detail modal/page.
- Show empty state when there are no captured hands.
- Show a compact list when hands exist:
  - Derived hand display number
  - Played time
  - Hero cards
  - Position
  - Result
  - Tags
  - Note preview
- Add an `Add Hand` button from this section.
- Keep edit/delete/export actions out unless they are cheap and low-risk.

Testing focus:

- Sessions with no `hands` still render.
- Session with one or more hands renders the list.
- Add Hand button opens the hand entry sheet.

## Phase 3: Quick Capture Wizard MVP

Goal: Save a useful partial hand quickly.

Initial fields:

- Table size
- Tournament blinds when session mode is tournament
- Hero cards
- Position
- Result amount
- Outcome
- Tags
- Note
- Played at

Recommended first wizard:

1. Hero
   - Table size/player count
   - Blind level for tournament sessions
   - Hero cards
   - Position
   - Skip to Result

2. Result
   - Outcome
   - Amount
   - Tags
   - Note
   - Played at
   - Save
   - Save & Add Another

Why start this small:

- It validates the core storage path.
- It is easy to use from a completed session.
- It gives the user immediate value without forcing action reconstruction.
- It creates realistic captured data for later list/detail/export work.

Fast-entry ideas to explore:

- Card picker instead of raw typing.
- Table size slider, defaulting to the previous hand in the same session when available.
- Tournament blind-level inputs defaulting to the previous hand in the same session when available.
- Position slider whose stops update from the selected table size.
- Position slider defaults to the previous hero position when it is valid for the selected table size.
- Position pills remain a fallback if slider entry feels less precise in phone testing.
- Tag pills with the common tags visible.
- Win/loss/chop segmented control.
- Amount field that applies sign based on outcome.
- `Save & Add Another`.

Testing focus:

- Saves partial hand with only result and note.
- Creates a default `Hero` player for every saved hand.
- Saves table size.
- Defaults table size from the previous hand in the same session.
- Saves tournament blind level when provided.
- Defaults tournament blind level from the previous hand in the same session.
- Validates blind level values when present.
- Saves hero cards and position.
- Position options reflect table size, including 6, 9, and 10 handed cases.
- Position slider adjusts its stops when table size changes.
- Save & Add Another keeps the sheet open with sensible defaults.
- Validation catches invalid card codes or duplicate cards if validation is included.

## Phase 4: Hand Detail View And Editing

Goal: Let a user review and adjust captured hands from session detail.

Tasks:

- Tap/click hand list item to view details.
- Add edit path using the same wizard/sheet.
- Add delete confirmation.
- Consider duplicate hand as a convenience for batch entry.

Testing focus:

- Existing hands can be opened.
- Edits preserve hand id.
- Derived hand display numbers update based on the current sorted list.
- Delete removes only the selected hand.

## Phase 5: Board And Street Detail Capture

Goal: Extend the wizard for fuller hand histories without hurting quick capture.

Add optional steps:

- Board
  - Flop
  - Turn
  - River
- Preflop/flop/turn/river action entry
- Villain labels/count
- Showdown should not be a separate street. Capture it as `wentToShowdown` plus optional revealed player cards.

Important UX rule:

- Every detail step must offer `Skip to Result` and `Save Partial`.

Testing focus:

- Board cards save correctly.
- Actions save in street order.
- Partial action history is allowed.
- Amount units follow session mode.

## Phase 6: Export

Goal: Export captured hand data for review outside StackFlow.

Export formats:

- StackFlow JSON
  - First export format.
  - Lossless.
  - Always available.

- Plain text summary
  - Useful for copy/paste review.
  - Can work with partial hands.

- PHH
  - Standards-oriented export.
  - May require enough structured fields to be present.
  - Add clear messaging when a hand is too incomplete for PHH.

Testing focus:

- JSON export round-trips hand data.
- Plain text export handles partial and fuller hands.
- PHH export either succeeds with valid required fields or returns a clear unavailable reason.

## Phase 7: Live Session Entry

Goal: Reuse the same Add Hand flow from live cash and tournament screens.

Tasks:

- Add `Add Hand` action to live cash screen.
- Add `Add Hand` action to live tournament screen.
- Default `playedAt` to current time.
- Return user to live session after save.
- Keep existing simple routing behavior.

Testing focus:

- Live cash Add Hand opens the same wizard.
- Live tournament Add Hand opens the same wizard.
- Saving updates active session and stays in the live flow.

## Phase 8: Later Enhancements

Ideas to revisit after core capture is working:

- Custom tags.
- Recent tag suggestions.
- Recent result amounts.
- Full PHH import/export round trip.
- PokerStars-like text export.
- AI-assisted hand review.
- Hand stats on session/stats screens.
- Run-it-twice or double-board support.
- Omaha or other variants.

## First Implementation Recommendation

Start with Phase 1 through Phase 3 only:

1. Store hands on sessions.
2. Show a Hands section on the session detail page.
3. Add a minimal two-step quick capture wizard.

Do not start with street-by-street action entry unless the quick capture flow already feels good.
