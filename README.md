# Lumen Presenter

An open, cross-platform **worship / church presentation app** in the spirit of
ProPresenter and Worship Tools *Presenter*. Built with **Electron + React +
TypeScript** (electron-vite).

It drives a live audience screen (projector / second display) from an operator
control window: build a deck of slides from **scripture**, **media
backgrounds**, or **free text/lyrics**, then click or arrow-key through them
live. Includes instant **Black / Clear / Logo** controls.

## Architecture

Two windows, one source of truth.

```
┌─────────────────────┐     IPC (setLive / onLiveState)     ┌──────────────────┐
│  Control window      │  ─────────────────────────────▶    │  Output window    │
│  (operator UI)       │        main process holds           │  (audience/full   │
│  React + Zustand     │        the canonical LiveState       │   screen)         │
│  deck · previews ·   │  ◀─────────────────────────────    │  <Stage/> only    │
│  look controls       │        output:changed / displays    │                  │
└─────────────────────┘                                      └──────────────────┘
```

- **`src/main`** — window management, multi-display detection, the
  `lumen-media://` protocol that serves local image/video files safely, and the
  `LiveState` broadcast to the output window.
- **`src/preload`** — a small `window.lumen` bridge (contextIsolation on).
- **`src/renderer/src/control`** — the operator app (library tabs, deck grid,
  live/next previews, look controls).
- **`src/renderer/src/output`** — the audience window: renders `LiveState` and
  nothing else.
- **`src/renderer/src/shared/Stage.tsx`** — the one presentation surface, used
  full-screen on output *and* small in every operator preview/thumbnail. Text
  auto-fits its box (`useFitText`).
- **`src/shared`** — the cross-process contract: `types.ts`, `ipc.ts`, and the
  bundled Bible (`bible/`).

## Run it

```bash
npm install
npm run dev
```

The control window opens. Plug in a second display (or use your primary), pick
it in the top bar, and hit **Go Live** to open the audience window.

> **Note:** the `dev` / `start` scripts clear `ELECTRON_RUN_AS_NODE` (`ELECTRON_RUN_AS_NODE= electron-vite …`).
> If that variable is set to `1` in your shell environment, Electron launches as
> plain Node and crashes with `Cannot read properties of undefined (reading 'isPackaged')`.
> Clearing it in the script makes the app immune. On Windows, run
> `set ELECTRON_RUN_AS_NODE=` first, or use `cross-env` in the scripts.

### Try it in 30 seconds
1. **Bible** tab → search `John 3:16` or browse Psalms 23 → **Add & Present**.
2. **Media** tab → *Add image/video…* → **Background** to set a stage backdrop.
3. **Text** tab → paste lyrics (blank line = new slide) → **Add slides**.
4. Click any slide, or use **→ / ←** to move; **B** black, **C** clear, **L** logo.

## Keyboard

| Key | Action |
| --- | --- |
| `→` `↓` `Space` `PgDn` | Next slide |
| `←` `↑` `PgUp` | Previous slide |
| `B` | Blackout on/off |
| `C` | Clear text (keep background) |
| `L` | Show logo |

## Bible data

A small public-domain **World English Bible (WEB)** sample ships in
`src/shared/bible/sample.ts` so search/browse work immediately. To use a full
translation, replace/extend that file (or wire an importer) with JSON of the
shape:

```ts
{ name: string, verses: { book, chapter, verse, text }[] }
```

## Build installers

```bash
npm run build       # typecheck + bundle to out/
npm run dist:mac    # or dist:win / dist:linux (electron-builder)
```

## Roadmap ideas

- Full bundled Bible + multiple translations, verse-range selection
- Playlists / setlists saved to disk, drag-to-reorder deck
- Slide themes & templates, per-slide fonts
- Live video/NDI output, stage-display monitor with clock & notes
- ProPresenter / OpenLP / .pro import

MIT licensed.
