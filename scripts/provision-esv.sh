#!/usr/bin/env bash
# Provision the ESV API key onto THIS machine for a packaged Cantica install
# (macOS / Linux). The key is written to Cantica's app-data dir, which the app
# reads at runtime — so end users get the ESV with zero setup.
#
# The key is NOT stored in the repo or the app bundle (Crossway forbids
# publishing it, and the repo/releases are public). This just places it locally
# on the one machine you run it on. Copy this file to each church machine and run:
#
#   ./provision-esv.sh <ESV_API_KEY>
#   ESV_API_KEY=<key> ./provision-esv.sh
#   ./provision-esv.sh            # prompts, input hidden
#
# To remove it later:  ./provision-esv.sh --remove
set -euo pipefail

case "$(uname -s)" in
  Darwin) dir="$HOME/Library/Application Support/Cantica" ;;
  Linux)  dir="${XDG_CONFIG_HOME:-$HOME/.config}/Cantica" ;;
  *) echo "Unsupported OS. On Windows use provision-esv.ps1." >&2; exit 1 ;;
esac
file="$dir/esv.json"

if [ "${1:-}" = "--remove" ]; then
  rm -f "$file" && echo "Removed $file" || true
  exit 0
fi

key="${1:-${ESV_API_KEY:-}}"
if [ -z "$key" ]; then
  read -rs -p "Paste your ESV API key: " key; echo
fi
key="$(printf '%s' "$key" | tr -d '[:space:]')"
[ -n "$key" ] || { echo "No key given." >&2; exit 1; }

mkdir -p "$dir"
umask 177
printf '{"key":"%s"}\n' "$key" > "$file"
chmod 600 "$file"
echo "Wrote ESV key to: $file"
echo "Restart Cantica — the ESV option in the Psalms tab now works, no in-app setup."
