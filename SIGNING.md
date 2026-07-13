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

## Step 3 — Swap the Windows job in `.github/workflows/release.yml`

Replace the Windows half of the matrix build with a build → sign → publish flow
(the mac job is unchanged). Ping me and I'll wire it, or paste this:

```yaml
  release-win:
    runs-on: windows-latest
    permissions: { contents: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - name: Build unsigned installer
        run: |
          npm run build
          npx electron-builder --win --publish never
      - uses: actions/upload-artifact@v4
        id: unsigned
        with: { name: unsigned, path: release/*.exe }
      - name: Sign with SignPath (free OSS)
        uses: signpath/github-action-submit-signing-request@v1
        with:
          api-token: ${{ secrets.SIGNPATH_API_TOKEN }}
          organization-id: ${{ vars.SIGNPATH_ORGANIZATION_ID }}
          project-slug: ${{ vars.SIGNPATH_PROJECT_SLUG }}
          signing-policy-slug: ${{ vars.SIGNPATH_POLICY_SLUG }}
          github-artifact-id: ${{ steps.unsigned.outputs.artifact-id }}
          wait-for-completion: true
          output-artifact-directory: signed
      - name: Attach signed installer + update feed to the release
        env: { GH_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
        run: |
          gh release upload ${{ github.ref_name }} signed/*.exe release/latest.yml --clobber
```

That's it — signed Windows installers, $0, forever. Exact input names can drift
between SignPath action versions; check their README if a field is renamed.

## macOS — see the plan in RELEASING.md

There is **no $0 notarization** (it needs the $99/yr Apple account). For a handful
of machines the free path is unsigned + a one-time **right-click ▸ Open**. Details
and the reasoning are in [RELEASING.md](./RELEASING.md).
