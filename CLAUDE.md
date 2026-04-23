# CLAUDE.md

> Brief for future Claude sessions working on this repo. Read this first.

## What this is

**opentrader** is a self-hosted desktop trading dashboard inspired by Robinhood
Legend. It lets the operator (Mark) view portfolios and trade across multiple
brokerage platforms from one workspace, switching accounts via a Legend-style
dropdown. Initial brokers: **Alpaca** (official API), **Robinhood**, **Fidelity**
(both unofficial / Playwright-driven).

Mark is a senior full-stack web programmer and active US options trader. He
uses Robinhood Legend daily and expects this UI to feel like Legend with
extras Legend lacks (OCO/brackets, paper trading, net Greeks on multi-leg,
auras, etc.). Skip beginner explanations of trading concepts.

## ⚠ Hard architectural constraint — read this before designing anything

> **For any broker without an official API (Robinhood, Fidelity), all HTTP
> requests to the broker MUST originate from the user's machine in a way
> that looks indistinguishable from a real human using their own browser.**

Brokers actively flag and ban accounts running through datacenter IPs or
third-party tools. Pattern we use: **Playwright with persistent context** on
the user's machine, all API calls via `context.request.fetch()` so they
inherit the real browser's cookies / UA / fingerprint. This is the
[kennyboy106/fidelity-api](https://github.com/kennyboy106/fidelity-api) and
[jmfernandes/robin_stocks](https://github.com/jmfernandes/robin_stocks)
pattern. The sidecar runs locally (loopback only) and orchestrates the
Playwright contexts; the actual HTTP requests come from the embedded
Chromium, not from Node.

Alpaca has an official API, so its requests can come from anywhere — the
sidecar talks to Alpaca via plain `fetch`.

## Architecture in one diagram

```
┌─ Tauri 2 desktop shell (Rust, ~5MB) ────────────────────────────┐
│                                                                   │
│  React 19 UI  ──►  KLineChart v10 + dockview 5 + Tailwind v4      │
│      │                                                            │
│      │ HTTP+JSON (bearer token)                                   │
│      ▼                                                            │
│  Node sidecar @ 127.0.0.1:1421 (Hono 4)                           │
│      ├─ broker-alpaca   (native fetch + zod, no SDK dep)          │
│      ├─ broker-robinhood (Playwright persistent context)          │
│      ├─ broker-fidelity  (Playwright persistent context)          │
│      └─ SQLite (better-sqlite3 + Drizzle 0.45)                    │
│                                                                   │
│  Tauri Rust commands: keychain bridge (cross-platform via         │
│      `keyring` crate; not yet wired into the sidecar)             │
└───────────────────────────────────────────────────────────────────┘
```

## Repository layout

pnpm monorepo. Workspaces:

```
apps/
  desktop/                     # Tauri 2 app (Rust shell + React UI)
    src/                       # React frontend
      lib/                     # sidecarClient, brokerClient, queries, format, occ, hotkeys, etc.
      store/workspace.ts       # zustand store + selectors
      widgets/                 # dockview panels (Chart, Watchlist, Positions, Orders, Snapshot, OptionsChain, AccountSummary, Placeholder)
      workspace/               # shell pieces (TopBar, AccountDropdown, ConnectAlpacaModal, OrderTicketModal, ShortcutsModal, GlobalHotkeys, AuraSync, AccountSync, Workspace)
      styles/                  # tailwind v4 + theme tokens (auras override these)
    src-tauri/                 # Rust shell, tauri.conf.json, capabilities, icons
packages/
  broker-core/                 # Broker interface, types (Quote/Candle/Order/Position/etc), PaperBroker wrapper
  broker-alpaca/               # Alpaca adapter — REST + zod schemas + feed probing (sip/delayed_sip/iex)
  broker-robinhood/            # Playwright scaffold; only getQuote + listAccounts wired
  broker-fidelity/             # Playwright scaffold; lifecycle only, all data methods stubbed
  db/                          # Drizzle schema (accounts, layouts, prefs, paper_orders, paper_positions, symbol_cache)
  sidecar/                     # Hono server, /broker + /layouts routes, registry, env validation
```

## Tech stack and versions (all pinned to current latest stable)

| Layer         | Choice                       | Version          | Why                                                     |
| ------------- | ---------------------------- | ---------------- | ------------------------------------------------------- |
| Desktop shell | Tauri 2                      | 2.10.x           | tiny bundle, OS keychain, real popout windows           |
| Frontend      | React + TypeScript           | 19.2 / 6.0       | React 19's `useEffect` cleanup semantics, TS 6 strict   |
| Build         | Vite                         | 8.0              | rolldown rollup-incompatible mode                       |
| Charts        | klinecharts                  | **10.0.0-beta1** | indicators + drawing tools built-in (LWC ships neither) |
| Layout        | dockview 5                   | 5.2              | IDE-style tabs/popouts, JSON serialize for persistence  |
| Styles        | Tailwind 4 + CSS vars        | 4.2              | the auras feature swaps CSS vars, not classes           |
| State         | Zustand                      | 5.0              | scalar selectors, no provider                           |
| Server state  | TanStack Query               | 5.99             | refetchInterval drives the live polling                 |
| Sidecar       | Hono on @hono/node-server    | 4.12 / 2.0       | tiny, ergonomic                                         |
| DB            | better-sqlite3 + drizzle-orm | 12.9 / 0.45      | single-user, sync-style                                 |
| Broker auto   | Playwright                   | 1.59             | persistent contexts for Robinhood/Fidelity              |
| Tests         | Vitest                       | 4.1              | workspace projects mode; happy-dom for desktop          |

**No Alpaca SDK** — the official `@alpacahq/typescript-sdk` is self-marked
deprecated; the also-official `@alpacahq/alpaca-trade-api@3.1.3` is
auto-generated TS-with-`any` from JS, depends on `axios@0.21` (CVEs) and
`dotenv@6`, last released Jan 2025. We own ~150 LOC of native fetch + zod
in `packages/broker-alpaca/src/rest.ts` instead.

## Commands

```bash
pnpm install                  # one-time
pnpm dev                      # sidecar + tauri concurrently (canonical desktop dev)
pnpm dev:web                  # sidecar + vite, no Tauri shell (fast UI iteration in browser)
pnpm sidecar:dev              # just the Hono sidecar (curl/Postman against the API)

pnpm test                     # vitest run, all workspaces (~500ms, 117+ tests)
pnpm test:cov                 # + coverage (v8)
pnpm typecheck                # tsc --noEmit across all 7 workspaces
pnpm format                   # prettier --write
pnpm format:check             # CI check

pnpm tauri:build              # production .dmg/.exe/.AppImage (slow; release build)
```

The sidecar reads env from `packages/sidecar/.env` (gitignored). Required:
`OPENTRADER_SIDECAR_TOKEN` (≥8 chars, shared with the frontend via
`VITE_SIDECAR_TOKEN`). Defaults work for dev — see `.env.example`.

## Broker capabilities snapshot

| Broker    | Connect mechanism                                                | Live methods                                                                                                                       | Stubbed methods                                                                                  |
| --------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Alpaca    | API key + secret modal → `connect()` validates via `/v2/account` | account, balances, quote, candles, snapshot, options chain, list/place/cancel orders (incl. multi-leg + brackets), data-feed probe | streaming (planned, alpaca WS)                                                                   |
| Robinhood | Playwright window → user logs in → cookies captured              | listAccounts, getQuote                                                                                                             | getCandles, balances, positions, orders, place/cancel — all throw with the target endpoint noted |
| Fidelity  | Playwright window → user logs in → context persisted             | nothing yet (lifecycle only)                                                                                                       | everything beyond connect/disconnect — DOM scraping selectors deferred until live testing        |

The broker abstraction (`packages/broker-core/src/broker.ts`) is the spine.
Optional methods (`getOptionsChain`, `streamQuotes`, `getSnapshot`,
`listDataFeeds` / `setActiveDataFeed` / `refreshDataFeeds`) let adapters
opt in; the UI hides affordances when the active broker doesn't implement.

## Frontend highlights

- **Widgets** are dockview panels listed in `widgets/registry.tsx`.
  Each receives `IDockviewPanelProps`; data widgets read
  `selectWidgetBroker(props.api.id)` so the per-panel data-source
  override (DataSourcePicker) works without prop drilling.
- **Order ticket** lives in `workspace/OrderTicketModal.tsx` and reads a
  `OrderTicketDraft { legs[] }` from the store. Single-equity legs render
  the buy/sell tab UI; option legs / multi-leg render a leg-list with
  net Greeks (Δ Γ Θ ν) computed from `optionLegSnapshots` populated when
  legs are added from the OptionsChain widget.
- **Auras** are CSS-variable swaps keyed on `[data-aura=…]` set by
  `AuraSync`. Priority: focus (manual lock) > profit/loss (day P&L sign,
  ±$0.50 deadband) > extended (pre/after/overnight) > regular.
  `marketSession()` in `lib/marketClock.ts` does best-effort America/
  New_York classification; holidays not modeled.
- **Hotkeys** are defined once in `lib/hotkeys.ts` (HOTKEYS array) and
  bound by `GlobalHotkeys.tsx`. `ShortcutsModal` renders the same table
  so they can never drift. Legend grammar:
  - `Shift+B` / `Shift+S` — market buy/sell active symbol
  - `Shift+Alt+B` / `Shift+Alt+S` — limit at ask/bid
  - `Shift+Alt+F` — flatten active-symbol position
  - `Cmd/Ctrl+/` — shortcuts overlay
  - `Esc` — close shortcuts > order ticket > connect modal

## Layout persistence

- Sidecar exposes `/layouts` CRUD (GET list / GET id / PUT id upsert /
  DELETE id) backed by SQLite (`packages/sidecar/src/db.ts` runs the
  CREATE-IF-NOT-EXISTS on startup).
- Workspace.tsx restores the `'default'` layout via `api.fromJSON()` on
  ready, debounce-saves (1s) on every `onDidLayoutChange`.

## Conventions (also in memory)

- **Always pin latest stable.** Verify with `pnpm view <pkg> version` at
  install time. Preview/beta only when ≥2 yrs of dev OR substantial
  community usage AND the stable line is dead. Memo:
  `feedback_versions_and_tooling.md`.
- **pnpm only.** Never `npm install` / `yarn add`. Workspaces in
  `pnpm-workspace.yaml`.
- **Tests live next to source** as `*.test.ts(x)`. Use `vitest`. happy-dom
  for desktop, node for backend packages.
- **Comments**: only when the WHY is non-obvious. Don't narrate WHAT.
- **Mark's `client-side-only` constraint** is non-negotiable (see top).

## Where to look for / extend things

| Need                    | File                                                                                |
| ----------------------- | ----------------------------------------------------------------------------------- |
| Add a broker            | `packages/broker-<name>/` + register in `packages/sidecar/src/registry.ts`          |
| Add a sidecar route     | `packages/sidecar/src/routes/<name>.ts` + mount in `index.ts`                       |
| Add a widget            | `apps/desktop/src/widgets/<Name>Widget.tsx` + register in `widgets/registry.tsx`    |
| Add a hotkey            | `apps/desktop/src/lib/hotkeys.ts` + bind in `workspace/GlobalHotkeys.tsx`           |
| Add a Broker capability | `packages/broker-core/src/broker.ts` (interface) + `paper.ts` (forwarding)          |
| Add Alpaca endpoint     | `packages/broker-alpaca/src/rest.ts` + `schemas.ts` (zod) + `adapter.ts`            |
| Add a DB table          | `packages/db/src/schema/<name>.ts` + add to `packages/sidecar/src/db.ts` SCHEMA_SQL |

## Known gaps / TODO

- **Sidecar packaging for distribution.** Today `pnpm dev` runs the sidecar
  as `tsx`; `pnpm tauri:build` doesn't bundle it. End-user distribution
  needs Node SEA + Tauri's `externalBin` config (phase 8).
- **Streaming quotes** are polling on a 2s/5s refetch interval; Alpaca WS
  - a useStreamingQuotes hook would replace.
- **Sub-account multi-account dropdown.** Alpaca only has one account per
  key today; the dropdown shows the active account but doesn't list
  multiples. Needs work when RH (multiple accounts per login) lands.
- **OS-keychain → sidecar bridge.** Tauri commands exist
  (`apps/desktop/src-tauri/src/keychain.rs`); the sidecar still uses an
  in-memory secrets stub. Wire when the credentials need to survive
  restarts.
- **Robinhood / Fidelity endpoint coverage.** Both adapters are
  scaffolding — extend per the in-file TODOs (each method throws with
  the target endpoint named).
- **Snapshot widget — Volatility / Fundamentals tabs** show "render once
  a connected broker exposes options snapshots" / "connect a fundamentals
  provider in Settings" placeholders. Real implementations TBD.
- **Layout templates / multi-tab workspaces.** Backend supports many
  layouts (`/layouts` is keyed by id); UI only restores `'default'`.
  A tab strip in TopBar would expose this.

## Operator notes

- **Mark's Alpaca subscription**: he has Algo Trader Plus, so the
  data-feed probe should pick `sip`. Free users will land on
  `delayed_sip` (15-min delayed full SIP — strictly better than
  IEX-only). See `project_alpaca_data_feeds.md` memory.
- **Repo lives at** `/workspace/home/nas/opentrader` in the build
  sandbox; on Mark's Windows machine it's at
  `C:\Users\mark\Projects\Personal\opentrader`.
- **Windows toolchain footgun**: VS C++ Build Tools must be installed
  AND the dev shell must source `vcvars64.bat` so `link.exe` resolves
  to MSVC, not Git Bash's GNU coreutils `link`.
