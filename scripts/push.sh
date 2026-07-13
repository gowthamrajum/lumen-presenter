#!/usr/bin/env bash
# Push to origin as the repo owner (gowthamrajum) without leaving that GitHub
# account active — replaces the manual `gh auth switch` dance.
#
#   scripts/push.sh              # push current branch -> origin main
#   scripts/push.sh HEAD:develop # push to another branch
#
# Works from any repo (uses `origin`), so copy it into grey-gratis-ice too.
set -euo pipefail

ref="${1:-HEAD:main}"
owner="gowthamrajum"

# Remember whoever is active now, so we can restore it afterwards.
prev="$(gh api user --jq .login 2>/dev/null || true)"

gh auth switch --user "$owner" >/dev/null 2>&1 || true
git -c credential.helper='!gh auth git-credential' push origin "$ref"

if [ -n "${prev:-}" ] && [ "$prev" != "$owner" ]; then
  gh auth switch --user "$prev" >/dev/null 2>&1 || true
fi
