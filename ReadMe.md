# JogJoy

A basic, reliable running tracker built for the PlexQo RUN hiring assignment: start a run, track distance/duration/pace live, pause/resume, finish, and view a summary with route map. No gamification, social features, AI coaching, or backend — by design, per the assignment brief.

## Setup

```bash
npm install
npm run dev       # local dev server, open the printed URL on your phone for real GPS
```

To build and host:

```bash
npm run build      # outputs static files to dist/
npm run preview    # sanity-check the production build locally
```

Deploy the `dist/` folder to any static host (Vercel, Netlify, GitHub Pages). No environment variables, no API keys, no backend required.

Run the test suite:

```bash
npm test
```

**Note:** GPS accuracy on a laptop/desktop is usually poor or simulated. For a real test, open the dev server URL on a phone browser (same Wi-Fi network, or deploy and open the live link) and grant location permission. Chrome DevTools' "Sensors" panel can simulate a moving location for a quick desktop smoke test without going outside.

## Tech Stack

- Vanilla TypeScript + Vite (no framework — kept deliberately small)
- Browser Geolocation API (`watchPosition`) for GPS
- Leaflet + OpenStreetMap for the route map (no API key needed)
- `localStorage` for persistence — no backend, no accounts
- Vitest for unit tests

## Architecture

```
src/
├── state/              # Run lifecycle: typed state machine + shared types
├── tracking/            # Pure logic, no DOM: GPS wrapper, distance calc,
│                          point filtering, duration timer
├── storage/              # The only code touching localStorage:
│                          run history + in-progress-run recovery
├── ui/
│   ├── screens/          # Renders a snapshot; computes nothing itself
│   ├── components/        # GPS badge, finish-confirm sheet, permission prompt
│   └── formatters.ts     # distance/duration/pace/date → display strings
├── map/routeMap.ts       # Leaflet wrapper, isolated from the rest of the app
├── utils/                # Unit + theme preference (localStorage-backed)
└── main.ts               # RunController: wires GPS + timer + state machine +
                            storage together, then a DOM bootstrap that connects
                            it to index.html
```

**Design principle:** logic and rendering are fully separated. Everything under `tracking/`, `state/`, and `storage/` has zero DOM dependency and is unit-tested directly. The UI layer only ever calls into `RunController` — it never touches GPS, the state machine, or storage on its own.

### Run lifecycle

```
IDLE → CALIBRATING → RUNNING ⇄ PAUSED → FINISHED
```

Invalid transitions (e.g. resuming from `IDLE`) throw — the UI never has a path to trigger them since only the buttons valid for the current state are shown.

### How distance, duration, and pace are calculated

- **Distance**: Haversine great-circle distance summed between consecutive *accepted* GPS points.
- **Point acceptance**: a raw GPS point is rejected if its reported accuracy is worse than 30m, or if the implied speed from the last accepted point exceeds ~25 km/h (an impossible running speed) — this filters GPS noise and jump artifacts before they inflate distance.
- **Duration**: an active-duration accumulator, not wall-clock time. It only advances while state is `RUNNING`, so paused time never counts.
- **Pace**: `duration / distance`, computed fresh from current totals — always internally consistent with what's displayed.

### Pause/resume correctness

This was the trickiest edge case and got the most deliberate handling:

- On `pause()`, the "last accepted point" anchor is cleared.
- On `resume()`, the anchor stays cleared until the *next* GPS point is accepted — that point becomes the new anchor with zero distance added.
- This prevents a large phantom "distance"/"sprint" being calculated across the paused time gap (e.g. pausing for 10 minutes and moving 50m before resuming would otherwise register as a burst of impossible speed).
- Verified directly in `runStateMachine.test.ts`.

### GPS reliability

- **Calibration before start**: on Start, the app waits briefly (up to 10s) for an acceptably accurate first fix before beginning distance tracking, so a run doesn't open with a bogus jump from a cold GPS fix. If no good fix arrives in time, it falls back to the best fix seen.
- **Live status indicator**: a GPS pill (Good / Weak / Lost) is shown during Running/Paused, driven by the accuracy of the last accepted point.
- **Signal-loss watchdog**: a separate timer (independent of point arrival) flags "GPS Lost" if no point has been accepted for 10 seconds — this catches total silence, not just weak points.

### Interrupted tracking / crash recovery

The full run state (distance, duration, route points, GPS status) is persisted to `localStorage` on every change while `RUNNING`/`PAUSED`. If the tab or browser is closed or reloaded mid-run, reopening the app detects the saved state and offers to resume exactly where it left off, or discard it. This is the assignment's "interrupted tracking" edge case, solved without any backend.

### Theming

- Home, Summary, and History/Detail screens use a light theme; Start/Calibrating and the Active Run screen use a dark theme.
- Rationale: a dark background with bright numerals holds contrast better in direct sunlight than a white background (which blooms/washes out in glare), and draws less power on OLED screens — relevant for a feature that runs continuously for 30–60+ minutes outdoors. Screens meant for calm browsing (history, summary) use light for readability and a more polished, professional feel.
- A manual dark-mode toggle (top-right, "◐") overrides this and forces dark everywhere, for users who prefer it regardless of context. Preference is stored in `localStorage`.

## What's Included

- Start / Pause / Resume / Finish with a typed state machine
- Live Distance, Duration, Avg Pace
- GPS status indicator (Good / Weak / Lost)
- GPS point filtering (accuracy + implausible-jump rejection)
- Pause-correct distance and duration accounting
- Finish confirmation sheet (can't end a run with an accidental tap)
- Permission handling with an explainer before the OS prompt, and a retry flow on denial
- Post-run summary: total distance, duration, avg pace, route map with start/finish markers
- Local run history (last 50 runs) with a detail view per run
- Crash/reload recovery for an in-progress run
- Metric/Imperial unit toggle
- Contextual + manual dark mode

## Out of Scope (per assignment brief)

Gamification, points/rewards, leaderboards, challenges, social sharing, AI/voice coaching, training plans, heart-rate/wearable integration, calories, advanced analytics (splits, cadence, elevation profiles), complex animations, accounts/login, and backend sync. All were deliberately excluded — the underlying needs they might address (e.g. "don't lose a run," "see past runs") are covered by local persistence instead.

## Assumptions & Limitations

- **Background tracking**: the browser Geolocation API only tracks while the tab is open and active. If the tab is backgrounded or the phone locks, GPS updates pause — this is a platform limitation of a web app (vs. native), and is acceptable for this basic-demo scope. The crash-recovery feature means no data is lost if this happens; tracking simply resumes from where the tab left off.
- **No cross-device sync**: run history lives in `localStorage` on the device/browser it was recorded on. This was a deliberate choice (see "Out of Scope") — a backend would only add value for cross-device access, which wasn't a stated requirement.
- **Accuracy depends on device/browser GPS quality**: tested best outdoors, away from tall buildings, on mobile Chrome/Safari. Indoor or desktop testing will show poor/simulated accuracy.
- **Average pace only**: no rolling/current pace, to keep the live screen simple and avoid the added complexity (and drift toward "advanced analytics") of a rolling-window calculation.
- **Distance filtering thresholds** (30m accuracy cutoff, 25 km/h implausible-speed cutoff) are reasonable defaults for running but not user-configurable; they could be tuned further with real-world GPS log data.
- **`localStorage` capacity**: run history is capped at 50 entries to avoid unbounded growth; older runs are dropped silently past that cap.

## Testing

Unit tests cover the modules most likely to have subtle bugs:
- `distanceCalc.test.ts` — Haversine correctness, symmetry, linearity
- `pointFilter.test.ts` — accuracy rejection, GPS-jump rejection, WEAK/GOOD boundary
- `runStateMachine.test.ts` — transition guarding, duration frozen while paused, pause/resume anchor-reset (the phantom-distance fix), listener subscribe/unsubscribe
- `formatters.test.ts` — distance/duration/pace formatting and rounding edge cases

Run `npm test` for the full suite.