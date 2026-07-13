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
arm_sha="$(shasum -a 256 "$tmp/Lumen-Presenter-$v-arm64.dmg" | cut -d' ' -f1)"
x64_sha="$(shasum -a 256 "$tmp/Lumen-Presenter-$v.dmg" | cut -d' ' -f1)"
rm -rf "$tmp"

cask="$(cat <<CASK
# typed: strict
# frozen_string_literal: true

cask "lumen-presenter" do
  arch arm: "arm64", intel: "x64"

  version "$v"

  on_arm do
    sha256 "$arm_sha"

    url "https://github.com/$repo/releases/download/v#{version}/Lumen-Presenter-#{version}-arm64.dmg"
  end
  on_intel do
    sha256 "$x64_sha"

    url "https://github.com/$repo/releases/download/v#{version}/Lumen-Presenter-#{version}.dmg"
  end

  name "Lumen Presenter"
  desc "Open worship / church presentation app (ProPresenter style)"
  homepage "https://github.com/$repo"

  app "Lumen Presenter.app"

  # Unsigned open-source build: clear the download quarantine so it launches
  # without a Gatekeeper prompt (no \$99 Apple account needed).
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/Lumen Presenter.app"]
  end

  zap trash: [
    "~/Library/Application Support/lumen-presenter",
    "~/Library/Logs/Lumen Presenter",
    "~/Library/Preferences/com.lumen.presenter.plist",
  ]
end
CASK
)"

if [ -z "${HOMEBREW_TAP_TOKEN:-}" ]; then
  printf '%s\n' "$cask"
  echo "--- HOMEBREW_TAP_TOKEN not set: printed cask, did not push ---" >&2
  exit 0
fi

work="$(mktemp -d)"
git clone --depth 1 "https://x-access-token:${HOMEBREW_TAP_TOKEN}@github.com/$tap.git" "$work" 2>/dev/null
mkdir -p "$work/Casks"
printf '%s\n' "$cask" > "$work/Casks/lumen-presenter.rb"
cd "$work"
git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add Casks/lumen-presenter.rb
git commit -m "lumen-presenter $v" 2>/dev/null && git push || echo "cask already up to date"
