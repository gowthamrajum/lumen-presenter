#!/usr/bin/env bash
# Regenerate the Homebrew cask for a released version (real sha256 from the
# published dmgs) and push it to the tap. Run by CI on each release, or by hand.
#
#   scripts/bump-cask.sh v0.1.1                    # prints the cask (no push)
#   HOMEBREW_TAP_TOKEN=<pat> scripts/bump-cask.sh v0.1.1   # writes + pushes the tap
#
# Needs: gh (authenticated with read access to the release), shasum.
set -euo pipefail

tag="${1:?usage: bump-cask.sh <vX.Y.Z>}"
v="${tag#v}"
repo="gowthamrajum/lumen-presenter"
tap="gowthamrajum/homebrew-lumen"

tmp="$(mktemp -d)"
gh release download "$tag" --repo "$repo" --pattern '*.dmg' --dir "$tmp"
arm_sha="$(shasum -a 256 "$tmp/Cantica-$v-arm64.dmg" | cut -d' ' -f1)"
x64_sha="$(shasum -a 256 "$tmp/Cantica-$v.dmg" | cut -d' ' -f1)"
rm -rf "$tmp"

cask="$(cat <<CASK
# typed: strict
# frozen_string_literal: true

cask "cantica" do
  arch arm: "arm64", intel: "x64"

  version "$v"

  on_arm do
    sha256 "$arm_sha"

    url "https://github.com/$repo/releases/download/v#{version}/Cantica-#{version}-arm64.dmg"
  end
  on_intel do
    sha256 "$x64_sha"

    url "https://github.com/$repo/releases/download/v#{version}/Cantica-#{version}.dmg"
  end

  name "Cantica"
  desc "Open worship / church presentation app (ProPresenter style)"
  homepage "https://github.com/$repo"

  app "Cantica.app"

  # Unsigned open-source build: clear the download quarantine so it launches
  # without a Gatekeeper prompt (no \$99 Apple account needed).
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/Cantica.app"]
  end

  zap trash: [
    "~/Library/Application Support/Cantica",
    "~/Library/Logs/Cantica",
    "~/Library/Preferences/org.teluguchurchdfw.cantica.plist",
  ]
end
CASK
)"

# Pick a push transport: an SSH deploy key (HOMEBREW_TAP_SSH=1, the key already
# configured in ~/.ssh or via GIT_SSH_COMMAND) or an HTTPS token. With neither,
# just print the cask so a dry run still shows what would change.
remote=""
if [ "${HOMEBREW_TAP_SSH:-}" = "1" ]; then
  remote="git@github.com:$tap.git"
elif [ -n "${HOMEBREW_TAP_TOKEN:-}" ]; then
  remote="https://x-access-token:${HOMEBREW_TAP_TOKEN}@github.com/$tap.git"
fi

if [ -z "$remote" ]; then
  printf '%s\n' "$cask"
  echo "--- no tap credential (set HOMEBREW_TAP_SSH=1 with a deploy key, or HOMEBREW_TAP_TOKEN): printed cask, did not push ---" >&2
  exit 0
fi

work="$(mktemp -d)"
git clone --depth 1 "$remote" "$work" 2>/dev/null
mkdir -p "$work/Casks"
printf '%s\n' "$cask" > "$work/Casks/cantica.rb"
cd "$work"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add Casks/cantica.rb
git commit -m "cantica $v" 2>/dev/null && git push || echo "cask already up to date"
