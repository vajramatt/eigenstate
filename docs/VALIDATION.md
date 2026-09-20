# Validation

Checked locally on macOS on September 19, 2026, using Node.js 26.3.0 and the Codex embedded browser.

## Automated checks

- `npm test`: 39 tests passed. Coverage includes seeded determinism, ten-hour reconciliation, backward clocks, entity references, normalized probabilities, all eight anomalies, bounded histories over 24 simulated years, and century-scale catch-up.
- Persistence checks cover checksum validation, version migration, atomic replacement, corrupt-state quarantine, previous-checkpoint recovery, future-version preservation, reset, import, and storage denial.
- Runtime checks cover single-writer ownership, follower takeover, stopped and paused sessions, and reset while a checkpoint is pending.
- `npm run build`: TypeScript checks and the production bundle passed. JavaScript is about 137 KB before compression and 50 KB gzipped; CSS is about 24 KB before compression.
- `wrangler deploy --dry-run`: accepted the static asset configuration. `wrangler deploy` published version `9b01bb3f-1528-4028-8ec6-0876f174ff21` with the custom domain attached. Public DNS resolved, and HTTPS returned 200 with the expected asset filenames and security headers. The initial local DNS lookup had not yet propagated; the HTTPS check used the public DNS address with normal certificate validation.
- The companion Crossing Into repository built successfully and passed all 162 tests with the new tool listing.

## Browser checks

The development and production pages rendered without reported console warnings or errors. Theme switching, the colophon, its close controls, and the hum toggle were exercised. Reloading restored the same universe ID and selected theme. A 390-pixel viewport had no horizontal document overflow. The desktop layout and Canvas text were inspected visually.

The embedded browser did not enter fullscreen when its control was activated. Fullscreen, screen wake lock, audio quality, and offline reopening still need a manual check in Safari, Chrome, and Firefox. The production build generates and registers an offline asset cache, but disconnected browsing was not tested here. Storage behavior was tested with fake-indexeddb and a normal browser reload, not with abrupt browser-process termination.

## Simulation profile

Reproduce with:

```sh
node --expose-gc --experimental-strip-types scripts/profile.ts
```

After 10,000 warm-up ticks, one local run measured 100,000 one-second simulation steps:

| Measurement | Result |
| --- | --- |
| Median simulation step | 0.0042 ms |
| 99th-percentile simulation step | 0.0095 ms |
| Heap difference after garbage collection | +68,896 bytes |
| One century of catch-up | 3.47 ms |
| Resulting JSON snapshot | 37,830 bytes |
| Final bounded records | 32 agents, 7 experiments, 80 events, 16 anomalies, 96 history samples |

These measurements cover the simulation engine, not browser rendering, battery usage, or a continuous day-long session. A single heap comparison cannot prove the absence of leaks. The updated renderer draws at up to 30 fps while visible and stops while hidden. Quiet mode retains cached output between infrequent redraws. Actual browser CPU and GPU use remains a release check.

## Publication state

The repository includes MIT licensing, dependency and palette notices, contributor documentation, and CI configuration. Its source repository is [vajramatt/eigenstate](https://github.com/vajramatt/eigenstate). The production Cloudflare site is deployed at [screensaver.crossinginto.ai](https://screensaver.crossinginto.ai). The companion listing remains a separate repository change.

## Motion and terminal update

Added render-only interpolation tests, including phase wrapping and simulation immutability. Terminal tests verify that displayed values come from the current universe. The local preview was restarted and restored universe C8744716 with its existing age. The runtime terminal and world trace were checked in the browser.

## Controls and audio update

Verified Space pauses and resumes when a toolbar button has focus. Keyboard repeats no longer repeatedly toggle controls. Unit tests cover text-input exclusions and pausing a follower without stopping its writer. The hum now includes 55, 110.06, and 165 Hz tones with an eleven-second volume swell, defaults to 35% volume, and reports playing, paused, muted, or blocked state. The preview reported a running audio context; physical speaker output was not measured.

## Simulated crash update

Nine additional tests cover seeded intervals, schedule validation, bounded archives, fresh identity after reboot, safe visual previews, pause and hidden-time behavior, follower takeover, archive failure, and restoring a crashed universe. These tests use isolated IndexedDB databases. The browser preview displayed the fault screen and countdown, then returned to universe C8744716 without changing its identity. No browser warnings or errors were reported during this check.
