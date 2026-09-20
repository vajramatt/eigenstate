# Eigenstate

[Open Eigenstate](https://screensaver.crossinginto.ai) · [Source on GitHub](https://github.com/vajramatt/eigenstate)

A persistent generative observatory inspired by scientific computing interfaces, frontier AI systems, and quantum research environments. Open it, enter fullscreen, and watch a synthetic universe evolve. Between visits, it resumes with the same identity and a reconciled history. Occasional simulated crashes archive that universe and begin a new one.

Eigenstate is a browser screensaver for entertainment only. All agents, terminal logs, and metrics are simulated. It performs no real AI inference or quantum computation. The numbers describe its own synthetic simulation; they are not measurements of your computer or private reasoning traces.

## Run locally

Use Node.js 24.5 or newer and npm.

```sh
npm ci
npm run dev -- --port 5178
```

Open `http://127.0.0.1:5178/`. The development server updates the page as you edit. Development builds expand the diagnostics panel by default.

```sh
npm test          # Determinism, snapshots, migrations, recovery, lifecycle
npm run build    # Type-check, bundle, and generate the offline shell
npm run preview  # Preview the production build
```

Use HTTPS when hosting. Localhost is also a secure context for IndexedDB, Web Locks, cryptographic checksums, audio, and service workers. Current desktop browsers are the intended environment. Smaller screens use a stacked layout.

## Controls

| Key | Action |
| --- | --- |
| `F` | Enter or exit fullscreen |
| `T` | Cycle themes, with a brief theme-name toast |
| `~` | Open the colophon |
| `D` | Toggle the soft ambient hum |
| `Space` | Pause or resume |
| `S` | Open settings |
| `?` or `H` | Show keyboard shortcuts |
| `Esc` | Close a dialog or exit fullscreen |
| `Q` | Close the colophon or shortcut dialog |

Controls remain available by mouse and touch. Shortcuts do not intercept typing, selectors, or dialogs. Space pauses even when a toolbar button is focused; Enter activates focused buttons. In a second tab, pause freezes that view while the writer tab keeps evolving. Fullscreen requires a click or keypress. The toolbar and cursor disappear after four idle seconds in fullscreen; moving the pointer reveals them.

Settings include layout, anomaly frequency, simulated crashes, quiet updates, optional screen wake lock, and universe export/import. Development builds also offer 1×, 10×, 100×, and 1000× speed, pause/resume, manual anomalies, and a crash preview that leaves the current universe intact. Acceleration applies to the visible session and resets to 1× on reload.

The hum is synthesized from three sine oscillators at 55, 110.06, and 165 Hz, with a low-pass filter and volume control. A slow modulation adds gentle volume swells about every eleven seconds. Its default volume is 35%; the control reports whether audio is playing, paused, muted, or blocked. It starts off on every visit and requires a user gesture. Pausing or hiding the page suspends audio. There are no audio recordings or remote samples.

## Themes

Eigenstate, Tokyo Night, Synthwave '84, Nord, and Catppuccin Mocha are available through the theme menu or `T`. Text, graphs, matrices, controls, and browser chrome use a shared palette registry. Themes change color without changing simulation state. No theme adds scanlines, CRT distortion, or phosphor glow.

Add a theme to `src/rendering/themes.ts`. Keep text readable against both panel and background colors, and include attribution for any adapted palette in `THIRD_PARTY_NOTICES.md`.

## Architecture

```text
src/core/
  types.ts           bounded universe and subsystem records
  random.ts          persisted Mulberry32 random state
  universe.ts        creation, identity, links, event recording
  engines.ts         agent, experiment, branch, quantum, inference, world engines
  anomalies.ts       events that alter actual simulated state
  simulation.ts      live advancement and elapsed-time reconciliation
  runtime.ts         writer ownership, pause, lifecycle, checkpoint queue
src/persistence/
  snapshot.ts        validation, SHA-256 envelope, version migration
  store.ts           transactional IndexedDB storage and recovery
src/rendering/       Canvas projections and theme tokens
src/audio/           opt-in synthesized hum
src/components/     cached, independently refreshed canvas panes
src/App.vue          observatory, preferences, colophon, controls
scripts/build-sw.mjs versioned offline asset cache
```

All panes read one `Universe`. Agent dependencies produce graph edges; experiment membership produces registry rows; persisted latent vectors produce the world projection. The branch fan is a summary of seven experiments, not an explicit tree containing millions of branches. The model specification panel displays current experiment state and executes no code.

The simulation updates once a second while visible. Canvas panes render at up to 30 frames per second, with a slow camera orbit, drifting agent positions, signals along active dependencies, and interpolated quantum and inference values. These presentation effects never advance the simulation or its PRNG. Offscreen panes stop drawing. Quiet mode disables continuous motion and refreshes at most once every five seconds. The page stops its simulation timer when hidden and reconciles elapsed time on return. A service worker caches application assets; it does not run the simulation in the background.

The runtime terminal streams one subsystem sample per simulation tick (every five seconds in quiet mode) alongside agent, experiment, and anomaly events. Every fifth incoming sample uses a brief typewriter reveal; event records arrive immediately. Typing stops while paused, hidden, or offscreen and is disabled in quiet mode. Its 80-line scrollback stays in memory. Scroll up to inspect earlier lines; select **Resume following** to return to the live tail. A compact world trace displays the current epoch, vector count, and coupling count. Pause freezes motion and streaming together.

## Simulated crashes

Occasionally the screensaver freezes, displays a fictional fault report, and counts down eight seconds before starting a new universe. The default interval is 45–90 minutes of active viewing, chosen from the universe seed. Settings also offers 10–20 minutes or Off. Paused and hidden time does not count; simulation speed does not shorten the interval. Quiet mode keeps the sequence free of motion and flashing.

Before restarting, Eigenstate saves the old universe and its replacement in one transaction. If that save fails, it keeps the current universe and disables crashes for the session. Automatic crashes require browser storage and writer ownership. Reloading during a pending crash restarts the countdown; another tab can finish it after taking ownership.

Only the most recent crashed universe is retained. **Settings → Export last crashed universe** downloads it. Import that file to restore it with a new crash grace period. Manual reset and import keep this archive; clearing site data removes it. Development builds include **Preview crash (no reset)** to inspect the screen without replacing any state.

## Persistence and continuity

State lives in the browser's IndexedDB database `eigenstate-v1`, within the current origin. The `state` store holds a current snapshot, previous checkpoint, last crashed universe, and at most three quarantined corrupt records. The `settings` store holds theme, layout, and quiet-mode preferences separately. For Matthew's deployment, the origin is `https://screensaver.crossinginto.ai`.

Each snapshot contains a version, JSON payload, and SHA-256 checksum. The payload holds universe identity, seed, PRNG state, elapsed age, entities, summary counters, bounded history, anomaly rate, optional crash frequency and remaining viewing time, and last wall-clock timestamp. No endless terminal transcript is stored.

Checkpoint writes replace the current state in one IndexedDB transaction every 15 seconds and when the page becomes hidden. The previous checkpoint is updated in the same transaction. Abrupt termination can lose up to one checkpoint interval of live detail; the next session reconciles the elapsed gap. Teardown is a best effort, not the only save mechanism.

On load, Eigenstate checks the checksum, format version, entity limits, references, vector dimensions, and numeric bounds. Version 1's `lastSavedAt` field migrates to version 2's `savedAt`, with a default anomaly rate. A corrupt current snapshot is quarantined, then the previous checkpoint is tried. If neither loads, a new universe starts with a visible recovery notice. Unknown future versions are preserved without overwrite. Imports are size-limited, validated, and confirmed before replacement.

Web Locks permit only one tab at a time to write a universe. Other visible tabs follow checkpoints and can take over after the writer releases its lock. A hidden writer checkpoints and releases ownership. If safe persistence is unavailable, a visible notice explains that the session must be exported to keep it.

Browser storage is not a permanent backup. Request persistent storage from Settings; the browser decides whether to grant it. Site-data clearing, private browsing, browser policies, profile changes, or moving to another origin can remove or isolate state. Export your universe to keep a portable copy. Preview ports and production domains have separate universes.

## Time reconciliation

The same snapshot and elapsed duration produce the same result within a given engine version. A gap is divided into at most 96 analytical steps. Branch evaluation and task counts accumulate by rate, convergence uses exponential decay, and lifecycle events use seeded probabilities. Large intervals aggregate agent turnover and anomaly counts instead of creating unbounded records.

Ten hours offline therefore take bounded work, not 36,000 timer ticks. Year-scale tests keep the same universe identity. Different partitions of elapsed time are not guaranteed to produce identical paths, and floating-point math is not promised to match bit-for-bit across every JavaScript engine. Negative clock changes never reverse age or lower the saved wall-time marker. A defensive per-call duration bound of one trillion seconds prevents pathological inputs.

## Reset, export, and removal

Use **Settings → Export universe** to download a checksummed JSON snapshot. Importing a snapshot replaces the current universe after confirmation and reconciles its elapsed time.

**Reset universe** requires typing `RESET`. It atomically replaces the saved universe with a new identity and seed at age zero, and clears the previous checkpoint and corruption recovery history. The last crashed universe and theme preferences stay intact. Export before resetting if you want to keep the old universe.

An installed browser app can be removed through the browser's app-management interface. To remove saved state and the offline shell, clear site data for Eigenstate's exact origin. Uninstalling an app shortcut alone may leave that data in the browser. Eigenstate is an ambient fullscreen website; it does not register as a macOS screensaver or replace your lock screen.

## Cloudflare and Crossing Into

The included `wrangler.jsonc` serves `dist/` through Cloudflare Workers Static Assets with no backend. Matthew's configured custom domain is `screensaver.crossinginto.ai`. Change or remove the route before deploying your own copy.

```sh
npx wrangler login
npm run deploy
```

This uploads the app and changes the configured deployment. The Cloudflare account must control the domain. An alternative is Cloudflare Pages with build command `npm run build` and output directory `dist`.

The companion listing lives in `crossinginto.ai/content/tools.md`. Deploy Eigenstate before publishing a listing that links to it. Both repositories build independently. Cloudflare hosting configuration follows the [Static Assets documentation](https://developers.cloudflare.com/workers/static-assets/) and [Custom Domains documentation](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

## Privacy

Simulation and sound run on your device. Eigenstate has no accounts, analytics, API calls, or telemetry reporting. It does not inspect your files or hardware usage, execute shell commands, or upload universe state. Import reads only the JSON file you explicitly select.

The browser requests this site's static assets and checks its service worker for updates. Ordinary hosting access logs may exist at the hosting provider. Once the production shell is cached, the app can reopen offline. External links navigate only when selected. The app bundles its code and uses system fonts.

## Screenshots

Screenshots of the original Eigenstate UI can be added here before release. Capture the default theme and at least one alternate theme at desktop size. Do not add third-party film or television assets.

## License

MIT License. Copyright (c) 2026 Matthew Williamson. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). This project has no affiliation with any film, television series, broadcaster, or streaming service.
