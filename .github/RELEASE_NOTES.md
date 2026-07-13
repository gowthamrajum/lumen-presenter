## Install

**Windows** — download `Lumen-Presenter-Setup-<version>.exe` and run it. If a blue
**SmartScreen** box appears, click **More info → Run anyway** (one time). The app
auto-updates from then on.

**macOS** — download `…-arm64.dmg` (Apple Silicon / M-series) or `….dmg` (Intel),
open it, and drag **Lumen Presenter** to Applications. First launch, macOS warns
about an unidentified developer — **right-click the app → Open → Open** (one time),
or run once in Terminal:

```
xattr -dr com.apple.quarantine "/Applications/Lumen Presenter.app"
```

These builds are unsigned (free / open-source), so the one-time step above is
expected and safe. Details: see `RELEASING.md` in the repo.
