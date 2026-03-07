# StackFlow

StackFlow is a minimal, offline-first poker session tracker focused on clean domain modeling and long-term extensibility.

The goal is not just to track sessions — but to model poker session economics in a consistent, composable way.

---

## Design Philosophy

### 1. Domain First

The domain model is the source of truth.

UI is a projection of state.
Calculations are derived from events.
Persistence is an implementation detail.

Business logic does not live in the UI.

---

### 2. Event-Driven Financial Model

A session is modeled as a series of financial events:

- `investment` — money entering the session
- `return` — money leaving the session to the player
- `expense` — money permanently leaving the session (tips, food, travel)

Profit is derived:

grossProfit = returns - investments
netProfit = grossProfit - expenses


The system never stores profit directly.  
All financial results are computed from events.

---

### 3. Lifecycle Accuracy

Sessions explicitly track lifecycle:

- `startedAt`
- `endedAt`
- `updatedAt`

There is never more than one active session.

Lifecycle state is determined by `endedAt === undefined`.

---

### 4. Storage Abstraction

Persistence is handled via a repository interface:

SessionRepository


Current implementation:
- `LocalStorageRepository`

The service layer depends only on the repository interface, allowing:

- Future cloud sync
- IndexedDB storage
- Backend API
- Versioned migrations

Without changing business logic.

---

### 5. Separation of Concerns

- **Models** → Pure domain definitions
- **Service Layer** → Business rules and lifecycle enforcement
- **Repository** → Persistence abstraction
- **Calculators** → Derived statistics
- **UI** → Stateless rendering of current state

No calculation logic exists in the UI.

---

### 6. Simplicity Over Frameworks

The UI is implemented using:

- Vanilla TypeScript
- `innerHTML` rendering
- Manual event wiring

No framework is used intentionally.

This keeps:

- Bundle size small
- Complexity low
- Architecture visible
- Refactoring safe

---

## Core Domain Model

### Session

- id
- mode (cash | tournament)
- stakes
- location
- startedAt
- endedAt?
- updatedAt
- events[]

### SessionEvent

- id
- type (investment | return | expense)
- amount (in cents)
- timestamp
- category? (for expense)
- note?

Amounts are stored in cents to avoid floating point errors.

---

## Derived Metrics

All statistics are computed from events:

- Invested
- Returned
- Expenses
- Gross Profit
- Net Profit
- ROI (tournament only)
- Duration
- Hourly Rate
- Lifetime Stats

No derived metric is persisted.

---

## Non-Goals

- Complex state management libraries
- Heavy UI frameworks
- Premature optimization
- Over-engineered abstractions

The focus is correctness, clarity, and extensibility.

---

## Future Extensions (Design-Compatible)

- Session editing
- Undo event
- Staking splits
- Expense breakdown reporting
- Charts
- Data export/import
- Cloud sync
- Multi-device support

All future work should respect the existing domain-first architecture.

---

## Status

Active development.
Offline-first.
Single-user.
Local storage persistence.