# Developer Guide

This document is for contributors working on StackFlow locally.

## Stack

- TypeScript
- Vite
- Vitest
- Vanilla DOM rendering
- Chart.js

## Prerequisites

- Node.js 20 recommended
- npm 9+

## Setup

```bash
npm install
```

## Local Commands

```bash
npm run dev
```

Starts the local Vite development server.

```bash
npm run build
```

Type-checks and builds the production bundle.

```bash
npm run preview
```

Serves the production build locally.

```bash
npm test
```

Runs the unit test suite.

```bash
npm run test:watch
```

Runs Vitest in watch mode.

```bash
npm run test:coverage
```

Runs tests with coverage output.

## Project Structure

```text
src/
  models/       Domain types and pure session helpers
  services/     Business rules and session orchestration
  stats/        Derived metrics calculators
  storage/      localStorage adapters and preference persistence
  ui/           Views, router, render logic, and helpers
  styles/       App styling
  utils/        Shared utilities

public/
  audio/        Static audio assets
  icons/        PWA and install icons
  manifest.webmanifest
  sw.js

tests/
  models/
  services/
  stats/
  storage/
  ui/
  utils/
```

## Architecture Notes

- Session mode is `cash` or `tournament`
- Event types are `investment`, `return`, and `expense`
- Money is stored in cents
- Profit is derived, not persisted
- Business rules should stay in services and calculators, not inside view rendering

See [src/ARCHITECTURE.md](src/ARCHITECTURE.md) for the domain overview.

## Data Model

- Primary storage is browser `localStorage`
- JSON export is the main backup/import format
- CSV export is for session-level reporting
- Data is browser-local unless exported/imported

## PWA Notes

- `public/manifest.webmanifest` defines install metadata
- `public/sw.js` provides app-shell caching and offline fallback behavior
- `src/main.ts` registers the service worker in production builds only
- `index.html` advertises the manifest, icons, and theme metadata

## Release and Deployment

### GitHub Pages

Pages deploys from `.github/workflows/deploy-pages.yml`.

- trigger: push to `main`
- action: build `dist` and deploy to GitHub Pages

Typical flow:

1. Work on `dev`
2. Open a PR from `dev` to `main`
3. Merge when ready
4. Push or merge to `main`
5. GitHub Actions deploys Pages automatically

### GitHub Release Artifacts

`.github/workflows/release.yml` runs on tags matching `v*` and attaches a zipped production build to the GitHub release.

## Current Workflow

- do feature work on `dev`
- validate with `npm test` and `npm run build`
- create a PR to `main`
- merge when ready for release

## Documentation Split

- [README.md](README.md) is for end users
- `DEVELOPER.md` is for local setup and engineering workflow
