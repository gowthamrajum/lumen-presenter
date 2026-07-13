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

Builds ship **unsigned** by default. That's fine for you and technical users; for
wider distribution:

| Platform | Free option | What users see unsigned |
|---|---|---|
| **Windows** | [SignPath.io](https://about.signpath.io/product/open-source) free **OSS** code-signing, or an EV cert (~$$) | SmartScreen "unknown publisher" until download reputation builds |
| **macOS** | No free notarization — needs the $99/yr Apple Developer account | Gatekeeper block → **right-click ▸ Open** once, or `xattr -dr com.apple.quarantine "/Applications/Lumen Presenter.app"` |

To enable free Windows signing later: apply to the SignPath OSS program, then add
the signing step to the Windows job in `release.yml`.

## The broadcast overlay is single-sourced

`broadcast/obs.html` is the one source of truth. The relay (grey-gratis-ice)
fetches it live from this repo (cached 5 min) — **just push the app; the overlay
updates itself.** No more copying it into two repos.

## App icon (optional)

Currently the default Electron icon. To brand: add `build/icon.icns` (macOS,
1024×1024) and `build/icon.ico` (Windows), then re-release.
