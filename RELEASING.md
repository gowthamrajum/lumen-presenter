# Releasing Lumen Presenter — the $0 / open-source pipeline

No paid services. GitHub Actions builds every platform on GitHub's own runners,
GitHub Releases hosts the downloads **and** doubles as the auto-update feed.

## Cut a release

```bash
# 1. bump the version in package.json (e.g. 0.1.0 -> 0.1.1)
# 2. tag it and push the tag — that's the whole trigger:
git tag v0.1.1
scripts/push.sh v0.1.1        # or: git push origin v0.1.1
```

`.github/workflows/release.yml` then, in parallel:

- **macOS runner** → `Lumen Presenter-<v>.dmg` (Intel x64) + `-arm64.dmg` (Apple Silicon)
- **Windows runner** → `Lumen Presenter Setup <v>.exe` (NSIS installer, built natively — no Wine)

…and uploads them to a **draft** GitHub Release for that tag. Review it and click
**Publish** (or set `releaseType: "release"` under `build.publish` to auto-publish).

You can also run it from the **Actions ▸ Release ▸ Run workflow** button.

## Auto-update (free)

- **Windows** self-updates via `electron-updater` from GitHub Releases — works
  even unsigned. Downloads in the background, installs on quit.
- **macOS / Linux** builds are unsigned and can't self-apply, so the app checks
  the Releases API on launch and offers to open the download page.

## Signing — the honest $0 picture

Builds ship **unsigned**. Here's the no-money plan per platform.

### Windows — fully free ✅
Use **[SignPath.io](https://about.signpath.io/product/open-source)'s OSS program**:
a real CA-trusted cert at $0, so SmartScreen goes away. It's the one thing you
apply for once. Full walkthrough + the exact CI change: **[SIGNING.md](./SIGNING.md)**.
Until then, unsigned works — users click **More info ▸ Run anyway** once.

### macOS — the $0 reality (no $99 needed for your case)
There is **no free notarization** — Apple only sells it via the $99/yr Developer
account. But you almost certainly don't need it:

- The builds are **ad-hoc signed** (electron-builder does this automatically), so
  they *run* fine — Apple Silicon requires a signature and they have one.
- The only cost of being unsigned is a **one-time trust step per machine**:
  **right-click the app ▸ Open ▸ Open**, or once in Terminal:
  ```
  xattr -dr com.apple.quarantine "/Applications/Lumen Presenter.app"
  ```
- After that, it launches normally forever. Auto-updates aren't self-applying on
  unsigned macOS, so the app instead nudges you to the Releases page.

**When $99 is actually worth it:** only if you're shipping to *many* non-technical
Mac users who won't do the one-time right-click. For a few church projection Macs,
the free path is completely fine — set it up once and forget it.

**Every download already carries these instructions** — they're written into each
GitHub Release's notes automatically (see the publish step).

### macOS via Homebrew — one command, no right-click ✨
For anyone comfortable with a terminal, the **Homebrew tap** is the smoothest $0
path — the cask's `postflight` clears the quarantine, so it opens with **no
Gatekeeper prompt at all**:

```sh
brew install --cask gowthamrajum/lumen/lumen-presenter   # install
brew upgrade --cask lumen-presenter                       # update
```

Tap repo: [`gowthamrajum/homebrew-lumen`](https://github.com/gowthamrajum/homebrew-lumen).

**Keeping the cask current:** every release must update the cask's version +
sha256. That's automated by the `homebrew` job in `release.yml` once you add a
**`HOMEBREW_TAP_TOKEN`** secret — a PAT (or fine-grained token) with **write access
to `homebrew-lumen`**. Add it under Settings ▸ Secrets ▸ Actions. Until then, bump
it by hand after a release:

```sh
HOMEBREW_TAP_TOKEN=<pat> scripts/bump-cask.sh v0.1.2
```

## The broadcast overlay is single-sourced

`broadcast/obs.html` is the one source of truth. The relay (grey-gratis-ice)
fetches it live from this repo (cached 5 min) — **just push the app; the overlay
updates itself.** No more copying it into two repos.

## App icon (optional)

Currently the default Electron icon. To brand: add `build/icon.icns` (macOS,
1024×1024) and `build/icon.ico` (Windows), then re-release.
