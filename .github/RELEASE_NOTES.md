## Install

**Windows** — download `Cantica-Setup-<version>.exe` and run it. If a blue
**SmartScreen** box appears, click **More info → Run anyway** (one time). The app
auto-updates from then on.

**macOS** — download `…-arm64.dmg` (Apple Silicon / M-series) or `….dmg` (Intel),
open it, and drag **Cantica** to Applications. First launch, macOS warns
about an unidentified developer — **right-click the app → Open → Open** (one time),
or run once in Terminal:

```
xattr -dr com.apple.quarantine "/Applications/Cantica.app"
```

These builds are unsigned (free / open-source), so the one-time step above is
expected and safe. Details: see `RELEASING.md` in the repo.
