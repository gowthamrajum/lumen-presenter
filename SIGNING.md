# Free Windows code-signing (SignPath OSS) — the $0 way to kill SmartScreen

Unsigned builds trigger Windows SmartScreen ("unknown publisher"). **SignPath.io
gives free code-signing certificates to open-source projects** — a real,
CA-trusted cert at $0. It's the one piece you have to *apply* for; once approved,
CI signs every release automatically.

## Step 1 — Apply (you, once, ~a few days)

1. Go to <https://about.signpath.io/product/open-source> and request the OSS plan
   for `github.com/gowthamrajum/lumen-presenter` (public repo, OSI license — this
   repo is MIT ✓).
2. When approved, SignPath sets up an **Organization**, a **Project**, and a
   **Signing Policy**, and gives you four values:
   - `SIGNPATH_API_TOKEN` (a CI-user API token — **secret**)
   - Organization ID, Project slug, Signing-policy slug (**not secret**)

## Step 2 — Add them to the repo (you, once)

- **Settings ▸ Secrets and variables ▸ Actions ▸ Secrets** → add
  `SIGNPATH_API_TOKEN`.
- Same page ▸ **Variables** → add `SIGNPATH_ORGANIZATION_ID`,
  `SIGNPATH_PROJECT_SLUG`, `SIGNPATH_POLICY_SLUG`.

That's the whole remaining to-do. **The CI is already wired** (Step 3 below is
done) — the moment those four values exist, signed Windows builds start happening
on the next release. Until then the pipeline is a strict no-op and the unsigned
installer keeps publishing as before.

## Step 3 — CI wiring (already done ✅)

`.github/workflows/release.yml` has a gated **`sign-windows`** job that runs after
the normal build only when `SIGNPATH_API_TOKEN` is set. It:

1. rebuilds the installer unsigned and uploads it as a workflow artifact,
2. submits it to SignPath (`signpath/github-action-submit-signing-request@v1`)
   using your org/project/policy variables, and waits for the signed result,
3. **repatches `latest.yml`** against the signed `.exe`
   (`scripts/repatch-latest-yml.mjs`) so electron-updater's sha512/size still
   match — signing changes the file's bytes, and without this auto-update would
   reject the release, and
4. replaces the release's `.exe` + `latest.yml` with the signed versions
   (`gh release upload --clobber`).

You don't touch the workflow. Two caveats, both expected:

- **First run needs a live SignPath project to validate.** The wiring can't be
  exercised until your OSS plan is approved and the four values are in — so treat
  the first signed release as the smoke test.
- SignPath occasionally **renames the action's inputs** between versions; if a run
  fails on an unknown input, check the action's README and adjust the `with:`
  block in the `sign-windows` job.

That's it — signed Windows installers, $0, forever.

## macOS — see the plan in RELEASING.md

There is **no $0 notarization** (it needs the $99/yr Apple account). For a handful
of machines the free path is unsigned + a one-time **right-click ▸ Open**. Details
and the reasoning are in [RELEASING.md](./RELEASING.md).
