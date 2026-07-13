# Lumen Presenter — Parity with WorshipTools *Presenter* + Streaming Broadcast Addon

_Analysis + implementation plan. Two parts: (A–D) an "apples‑to‑apples" parity
roadmap against WorshipTools Presenter, and (E) a detailed design for the
requested **streaming broadcast addon** (live slide state → web service → OBS
browser source → YouTube)._

---

## A. Snapshot — what WorshipTools *Presenter* is

Free, volunteer‑friendly church presentation app (macOS/Windows) with mobile
companions. Cloud sync is "at the core." Headline capabilities:

- **Songs / lyrics** — song library; import lyrics, chords, and lyric videos
  from **CCLI SongSelect**; **Loop Connect™** auto‑builds lyric slides with
  "perfect spacing, spelling & timing"; choose lines‑per‑slide.
- **Bibles** — 65+ built‑in translations; display scripture "with just the
  reference."
- **Media / motions** — images, videos, motion backgrounds.
- **Presentations** — slide decks; imports from other tools (PowerPoint /
  ProPresenter / EasyWorship class of formats).
- **Multiple output screens, each a different layout** — "as many displays as
  you have connected"; you can make an audience screen, a **stage‑display
  confidence monitor**, and a **live‑stream lyrics output** independently.
- **Stage Display app** (active + next slide) and **Presenter Remote app**
  (control from phone/tablet).
- **Schedules / Services** — worship planning & scheduling.
- **Cloud sync** across devices (WorshipTools account).

**Streaming today (important):** Presenter has **no built‑in NDI**; it is a
long‑standing, heavily‑requested gap. Users get lyrics into OBS by either
(1) capturing a dedicated lower‑third output screen, or (2) NDI Scan Converter
screen‑capture. The community's preferred ask is literally *"send the text to a
lower third via a local HTTP server so OBS can browser‑source it with alpha —
crisper and lighter than chroma key."* **That is the addon in section E, and it
leapfrogs Presenter.**

Sources: [Presenter product page](https://www.worshiptools.com/en-us/presenter) ·
[Advanced Services features](https://www.worshiptools.com/en-us/docs/98-service-features) ·
[Livestream setup](https://www.worshiptools.com/en-us/docs/10-livestream) ·
[NDI/alpha requests](https://www.worshiptools.com/help/thread/4788699426455552) ·
[Lyric output for live streaming](https://www.worshiptools.com/help/thread/5681717746597888) ·
[OBS integration thread](https://www.worshiptools.com/help/thread/6327686939017216)

---

## B. Lumen today (what we've already built)

- Electron + React + TS; two‑window **control → live output**; main process owns
  the canonical `LiveState` and broadcasts it over IPC.
- **Bible** — full Telugu (66 books / 31,102 verses) + WEB sample; translation
  picker; localized book names / references; search by text or reference.
- **Media** — image/video backgrounds via a `lumen-media://` protocol; **PPTX
  import** (one item per file, text + baked backgrounds); gradient +
  **animated** backgrounds; worship background gallery.
- **Text / Scenes** — freeform text slides; one‑click **Welcome / Announcements
  / Blessing** scenes on animated backgrounds; predictive auto‑fit text; bundled
  **Anek Telugu** font.
- **Themes** — Classic / Bold / High Contrast / Warm / Light look presets + live
  size/scrim/align/color controls.
- **Services (setlists)** — grouped items, disk persistence (survives restart),
  save / open / new / delete.
- **Output** — multi‑display picker; **windowed fallback** on a single screen;
  Black / Clear / Logo; keyboard nav forwarded from the output window.

---

## C. Gap analysis (apples‑to‑apples)

| Capability | Presenter | Lumen today | Gap → work | Priority |
| --- | --- | --- | --- | --- |
| Bible by reference, many translations | ✅ 65+ | ✅ Telugu + WEB; add‑a‑translation pipeline | Bundle more translations; verse‑range picker | P2 |
| **Songs / lyrics library** | ✅ + SongSelect import, chords | ❌ (freeform text only) | Song data model, library, lines‑per‑slide, arrangement (verse/chorus order), chords | **P1** |
| Media (images/video/motions) | ✅ | ✅ (+ animated gradients) | Motion/video library mgmt, loop | P2 |
| Presentation import | ✅ PPT/Pro/EasyWorship | ✅ PPTX only | Add ProPresenter/EasyWorship/OpenLP import | P3 |
| **Multiple outputs, per‑output layout** | ✅ | ⚠️ one audience output | Independent output windows w/ per‑screen layout (audience / lower‑third / stage) | **P1** |
| **Stage display** (active + next + clock/notes) | ✅ app | ❌ | Stage‑display layout (web page via addon server — see E) | P2 |
| **Remote control** (phone) | ✅ app | ❌ | Web remote (served by addon HTTP server) | P2 |
| Schedules / services | ✅ (cloud) | ✅ (local disk) | Reorder (drag), duplicate, export/import `.lumenservice` | P2 |
| Themes / templates | ✅ | ✅ (looks) | Saveable custom templates, per‑item overrides | P3 |
| Countdowns / timers / announcements | ✅ | ⚠️ scenes only | Countdown/clock slide type | P3 |
| **Live‑stream lyrics output for OBS** | ⚠️ capture/NDI‑scan only | ❌ | **Addon in section E — a differentiator** | **P1** |
| Cloud sync across devices | ✅ core | ❌ (local) | Optional sync (later; big) | P4 |
| Platforms | Win/Mac + mobile companions | Mac/Win/Linux (electron‑builder) | Package + sign installers | P2 |

Legend: ✅ have · ⚠️ partial · ❌ missing.

---

## D. Parity roadmap (phased)

- **P1 — Differentiate & close the biggest gaps**
  1. **Streaming Broadcast Addon** (section E) — direct OBS/YouTube overlay.
  2. **Songs** — song model + library + lines‑per‑slide + arrangements.
  3. **Multiple independent outputs** with per‑output layout (audience vs
     lower‑third vs stage), reusing the windowed/fullscreen logic we have.
- **P2 — Operator power**
  - Web **Stage Display** + web **Remote** (both served by the addon's embedded
     HTTP server — one server, three surfaces).
  - Service polish: drag‑reorder, duplicate, export/import file.
  - More bundled Bible translations + verse‑range selection.
- **P3 — Breadth**
  - More import formats (ProPresenter/EasyWorship/OpenLP), countdown/clock
     slide type, saveable custom templates.
- **P4 — Ecosystem**
  - Optional cloud sync, installers/signing, auto‑update.

**Architectural keystone:** the streaming addon's embedded HTTP server is also
the foundation for the **web Remote** and **web Stage Display** — no separate
mobile apps needed; any phone/browser on the LAN opens a URL. Build the server
once (P1), reuse it three ways.

---

## E. Addon: Streaming Broadcast → OBS → YouTube  (the requested feature)

**Goal:** every presenting / slide‑state change is broadcast to a small local
web service. OBS adds it as a **Browser Source** (transparent/alpha) and
composites the current lyrics/scripture as a **section/overlay** on the YouTube
stream — crisp text, no chroma key, no screen capture.

### E.1 Architecture

```
 Control window ──IPC──▶ Main process (owns LiveState)
                              │  on every live change
                              ▼
                    Embedded HTTP + SSE server  (127.0.0.1:7590 by default)
                    ├─ GET /overlay?style=lowerthird   → transparent overlay page (for OBS)
                    ├─ GET /events                       → Server-Sent Events stream of LiveState
                    ├─ GET /state                        → current state JSON (polling fallback)
                    ├─ GET /  (help: shows copyable OBS URLs)
                    └─ (later) /remote, /stage           → web remote & stage display
                              │
                              ▼
              OBS "Browser Source" → http://localhost:7590/overlay?style=lowerthird
              (alpha composited over the camera/scene → YouTube)
```

**Why SSE, not WebSocket:** the feed is one‑way (server → overlay). SSE
(`EventSource`) needs **no extra npm dependency**, auto‑reconnects, and is
perfectly suited to a Browser Source. (A WS control channel is only needed later
for the web *Remote*.)

**Why this beats Presenter:** direct text overlay with real alpha — no NDI Scan
Converter, no capturing a whole screen, resolution‑independent, low CPU.

### E.2 Message contract

Reuse `LiveState`, stripped to what an overlay needs (background is ignored —
the overlay is transparent):

```jsonc
// event: "state"
{
  "visible": true,               // false when blackout OR clearText OR no slide
  "kind": "scripture",           // scripture | song | text | ...
  "lines": ["ఆదియందు దేవుడు..."],
  "caption": "ఆదికాండము 1:3",
  "theme": { "textColor": "#fff", "captionColor": "#ffd27f", "uppercase": false },
  "seq": 42                       // monotonic; overlay ignores stale/out-of-order
}
```

Emitted on connect (replay current) and on every `live:set` in main.

### E.3 Overlay styles (query param `style=`)

- `lowerthird` — text in the lower ~25%, with a soft gradient scrim behind it for
  legibility over video; the default for streams.
- `caption` — a single slim caption bar (reference/attribution only).
- `full` — full‑frame lyrics (for a dedicated "lyrics only" scene).

Params: `style`, `w`/`h` (safe‑area sizing), `font` (defaults to Anek Telugu,
served by the server), `align`. Text uses the same predictive fit + Anek Telugu
as the main output, so Telugu renders correctly on stream.

### E.4 Control UI (new "Stream" section)

- Toggle **Broadcast on/off** (starts/stops the server).
- Shows the **OBS URL(s)**: `http://localhost:7590/overlay?style=lowerthird`
  plus the **LAN URL** (`http://<lan-ip>:7590/…`) for a separate streaming PC —
  each with a copy button.
- Pick default **overlay style** + port; **"expose on LAN"** opt‑in.
- Live **status**: server running, # connected overlays.

### E.5 Security & reliability

- Bind **127.0.0.1 by default**; LAN bind is explicit opt‑in (church network).
- **Read‑only** broadcast (no mutation endpoints); no auth needed for localhost.
  When LAN‑exposed, gate `/remote` (later) behind a short token in the URL.
- SSE heartbeat comment every ~15 s; `EventSource` reconnects automatically;
  server replays current state on (re)connect so OBS always shows the right slide
  after a scene switch.
- Port‑in‑use fallback: try 7590→7591… and report the chosen port.

### E.6 Implementation tasks

- **BR‑0** — `src/main/streamServer.ts`: `http.Server` lifecycle (start/stop,
  port selection, bind address). Add `stream:*` IPC + preload + config in store.
- **BR‑1** — SSE `/events` + `/state`; hook `broadcastLive(state)` into the
  existing `liveState` update in `main/index.ts`; compute `visible`/`seq`.
- **BR‑2** — overlay page (`/overlay`, inline CSS/JS) with the three styles,
  transparent bg, Anek Telugu `@font-face` served from the server, fade
  transitions.
- **BR‑3** — control **Stream** panel (toggle, URLs w/ copy, style/port, LAN
  opt‑in, connection count); persist config (userData).
- **BR‑4** — polish: `prefers-reduced-motion`, resolution/safe‑area params,
  per‑style scrim, "hide when cleared" behavior, `/` help page.
- **BR‑5 (later)** — reuse the server for **web Remote** (adds a WS/POST control
  channel + token) and **web Stage Display** (`/stage`: active + next + clock).
- **BR‑6 (future)** — optional NDI output for switchers that prefer it.

**Estimated first working version (BR‑0…BR‑3):** small — no new runtime deps
(Node `http` only), reuses `LiveState`. This is the recommended immediate next
build.

---

## F. Recommendation / sequencing

1. **Build the Streaming Broadcast Addon now (BR‑0…BR‑3).** It's directly
   requested, it's a real edge over Presenter, it has no new dependencies, and
   it lays the server foundation that P2's Remote + Stage Display reuse.
2. Then **Songs** (biggest functional parity gap) and **multiple per‑layout
   outputs**.
3. Then operator polish (web remote/stage, service reorder, more translations).

Everything above is additive to the current architecture — the addon simply taps
the `LiveState` we already broadcast to the output window and re‑broadcasts it to
the web.
