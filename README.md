# StackFlow

StackFlow is an offline-first poker session tracker built with TypeScript and Vite.

It tracks cash and tournament sessions using an event-based financial model (investments, returns, expenses), then derives all stats from those events.

## Features

- Start and track active cash or tournament sessions
- Bottom-sheet data entry for session actions (buy-in, add-on/rebuy, expenses, end session)
- Session history grid with filters, sorting, and aggregate footer metrics
- Charts for trends and performance using Chart.js
- Export filtered sessions to JSON or CSV
- Manual session entry from the Sessions view
- Local preference/history capture for fast entry (location, stakes, buy-in, categories)
- Offline persistence in browser localStorage

## Tech Stack

- TypeScript
- Vite
- Vanilla DOM rendering (no frontend framework)
- Chart.js

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## NPM Scripts

- `npm run dev`: Start local Vite dev server
- `npm run build`: Type-check and build production assets
- `npm run preview`: Serve the built app locally

## Project Structure

```text
src/
  models/       Domain types (Session, SessionEvent)
  services/     Business rules and session orchestration
  stats/        Derived metrics calculators
  storage/      Repository abstractions and localStorage adapters
  ui/           Views, rendering, routing, and user interaction
  styles/       App styling
  utils/        Shared utilities
```

## Domain Model Summary

- Session mode: `cash` or `tournament`
- Event types: `investment`, `return`, `expense`
- Amounts are stored in cents to avoid floating-point errors
- Profit is derived, not persisted:
  - `gross = returns - investments`
  - `net = gross - expenses`

See architecture details in [src/ARCHITECTURE.md](src/ARCHITECTURE.md).

## Data and Exports

- Primary storage: browser `localStorage`
- Export formats:
  - JSON (full session details suitable for re-import workflows)
  - CSV (session-level tabular data)

## Development Notes

- This project is intentionally framework-light to keep domain logic explicit.
- Business rules should stay in services/calculators, not in UI rendering code.
- Keep all money math in cents.

## Roadmap Ideas

- Import flow for exported JSON
- Cloud sync / multi-device support
- Expanded analytics and charting
- Optional undo/event edit workflows

## License

MIT - see [LICENSE](LICENSE).
