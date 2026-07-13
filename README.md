# Cantica

An open, cross-platform **worship / church presentation app** in the spirit of
ProPresenter and Worship Tools *Presenter*. Built with **Electron + React +
TypeScript** (electron-vite).

Made for [Telugu Community Church](https://teluguchurchdfw.org) · © 2026 Telugu
Community Church. (Repo/updates still ship under the `lumen-presenter` GitHub
name for continuity.)

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
| `F` (in output window) | Toggle fullscreen |
| `Esc` (in output window) | Exit fullscreen, or close output |

Navigation/control keys also work while the audience window has focus — they're
forwarded to the operator.

## Output on a single screen

If a second display is connected, **Go Live** opens the audience view
**fullscreen** on it. If only one display is present (e.g. a laptop with no
projector), Go Live opens the audience view as a **movable, resizable window**
instead of taking over your screen — so your controls stay visible. Press `F`
in that window for fullscreen, `Esc` to close it, or drag it onto a projector
once connected.

## Bible data

Pick a translation from the dropdown in the **Bible** tab. Two ship in the box:

- **తెలుగు బైబిల్ (Telugu)** — the full 66-book Telugu Bible (31,102 verses).
  Book names and slide captions are shown in Telugu.
- **WEB (English sample)** — a small public-domain World English Bible subset
  in `src/shared/bible/sample.ts`, instant and offline.

The Telugu text lives in [`resources/bible/telugu.json`](resources/bible/telugu.json)
and is read by the **main process** on demand and sent to the renderer over IPC,
so the ~12 MB file never enters the renderer bundle. Internally every
translation is normalized to:

```ts
{
  name: string,
  language?: string,
  order?: string[],                 // English book keys, canonical order
  names?: Record<string, string>,   // English key -> localized display name
  verses: { book, chapter, verse, text }[]   // book = English key; text = translation
}
```

Adding another full translation: drop a `resources/bible/<id>.json` of that
shape, whitelist `<id>` in `src/main/index.ts` (`BUNDLED_TRANSLATIONS`), and add
an entry to `TRANSLATIONS` in `src/renderer/src/control/translations.ts`.

**Telugu source & attribution:** converted from
[aruljohn/Bible-telugu](https://github.com/aruljohn/Bible-telugu) (one JSON per
book) into Lumen's translation shape.

## Services (setlists)

A **Service** is the plan for a gathering — an ordered collection of **items**,
where each item is a titled group of slides: an imported PowerPoint, a video, a
scripture reading, or some text. Build it ahead of time and present straight
through.

- Anything you add from the left panel becomes an **item** in the current
  service (one item per imported `.pptx` file, per video, per scripture range,
  per text block). The center **program** view shows items as labelled groups.
- The **Services** tab (left) lets you **name**, **Save**, start a **New**
  service, and **open** or **delete** saved ones. Services are stored as JSON
  under the app's user-data folder (`services/`), so they survive restarts.
- Saved media/PowerPoint slides reference their files by path (PowerPoint images
  live in the app cache), so reopening a service restores its media too.
- Press-through works across item boundaries — arrow keys advance through the
  whole service.

## Look: font, backgrounds & themes

- **Font** — the app UI and slide text use **Anek Telugu** (variable, weights
  100–800), bundled locally as woff2 subsets in
  `src/renderer/src/assets/fonts/` (SIL Open Font License, see `OFL.txt`). It
  renders Telugu and Latin, works offline, and satisfies the app CSP.
- **Backgrounds** — the **Media** tab has a gallery of worship-ready background
  presets (Worship, Sanctuary, Dawn, Golden Hour, Living Water, Advent, Crimson,
  Grace, Midnight, Charcoal, Black, Light) plus a custom color picker and your
  own images/videos. Presets are offline CSS gradients (a new `gradient`
  background type). Edit `src/renderer/src/control/presets.ts` to add your own.
- **Themes** — the **Look** panel (right) has one-click theme presets (Classic,
  Bold, High Contrast, Warm, Light) that set slide text color, scrim,
  emphasis, and — for Light — a matching background. Fine-tune with the size /
  scrim / align / color controls below.
- **Animated backgrounds** — the first two background presets (**Aurora**,
  **Worship Flow**, marked ✦) are motion gradients: the gradient slowly flows
  with a drifting glow, giving a looping "video" feel with no video file
  (honours `prefers-reduced-motion`).
- **Quick scenes** — the **Text** tab has one-click starter scenes
  (**Welcome**, **Announcements**, **Blessing**). *Welcome* drops in a
  ready-made "Welcome to Telugu Church / Glad you are with us today! / Lets
  worship together" screen on the animated Aurora background and puts it live —
  a self-contained welcome loop. The text is editable like any slide.

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
