# AGENTS.md — Eigenstate

> Inherits from ~/code/AGENTS.md — read the root file for shared conventions.

## What This Project Is

Eigenstate is a fullscreen browser tool showing a persistent synthetic computational universe. All panes derive their content from shared state. No real inference or quantum computation takes place. Matthew's copy is configured for Cloudflare at screensaver.crossinginto.ai, with a companion listing prepared for crossinginto.ai/tools.

## Stack

Vue 3, TypeScript, Vite, Canvas 2D, IndexedDB, Web Locks, Web Audio, and Cloudflare Workers Static Assets. Node 24.5+ for native TypeScript unit tests. npm manages this project's independent dependencies.

## Key Files

- `src/core`: typed universe, seeded random provider, simulation engines, runtime ownership.
- `src/persistence`: versioned, checksummed snapshots and IndexedDB transactions.
- `src/rendering`: theme registry and Canvas renderers.
- `src/audio`: optional synthesized hum.
- `src/App.vue`: panes, dialogs, shortcuts, lifecycle.
- `scripts/build-sw.mjs`: versioned offline shell.
- `tests`: simulation, persistence, and lifecycle tests.

## Current State

Source repository: https://github.com/vajramatt/eigenstate. Use the repository-local Git identity, including `220089294+vajramatt@users.noreply.github.com`, for all commits.

See README.md and docs/VALIDATION.md for build and validation status.

## Shared Ownership

Matthew Williamson and GPT share creative and technical ownership of Eigenstate. GPT has an explicit thought-leadership mandate: protect the core idea, form opinions, exercise taste, make product decisions, identify weak spots, propose direction, and ship reversible improvements without waiting for approval on every small choice. Matthew retains final say over public identity, major product direction, and irreversible decisions.

This is a project-working agreement. It does not change copyright, repository ownership, or the MIT license.

## Commands

```sh
npm install
npm run dev -- --port 5178
npm test
npm run build
npm run deploy
```

## Constraints

Hosting budget is $0. Keep deployment static-only on Cloudflare Workers Static Assets, with local builds and browser-side simulation and storage. Do not add billable backend compute, paid APIs, hosted databases, paid build services, or plan upgrades. Recheck static-asset pricing before changing hosting architecture; if a feature cannot fit the zero-cost constraint, propose a free alternative rather than enabling charges.

Keep simulation offline. Never inspect user content, send simulation state to a server, or add analytics. Only user-selected snapshot imports may read files. Bound histories and collections. Every visible disturbance should derive from shared state, and every meaningful cause should leave a bounded trace. Only the seeded provider supplies simulation randomness; cryptographic randomness is reserved for new identity creation. Web Locks protect the universe from multiple writers. Respect reduced motion and hidden tabs. Hum requires a user gesture and starts off. Preserve existing universes during tests.

The abandoned native prototype is stored in ignored `.native-prototype/` for local reference. It is not part of the product or build.
