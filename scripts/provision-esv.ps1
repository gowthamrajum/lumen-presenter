# Provision the ESV API key onto THIS Windows machine for a packaged Cantica
# install. The key is written to Cantica's app-data dir (%APPDATA%\Cantica),
# which the app reads at runtime — so end users get the ESV with zero setup.
#
# The key is NOT stored in the repo or the app bundle (Crossway forbids
# publishing it). Copy this file to each church machine and run:
#
#   powershell -ExecutionPolicy Bypass -File provision-esv.ps1 -Key <ESV_API_KEY>
#   powershell -ExecutionPolicy Bypass -File provision-esv.ps1          # prompts
#   powershell -ExecutionPolicy Bypass -File provision-esv.ps1 -Remove
param(
  [string]$Key,
  [switch]$Remove
)

$dir = Join-Path $env:APPDATA "Cantica"
$file = Join-Path $dir "esv.json"

if ($Remove) {
  if (Test-Path $file) { Remove-Item $file -Force; Write-Host "Removed $file" }
  exit 0
}

if (-not $Key) { $Key = $env:ESV_API_KEY }
if (-not $Key) {
  $sec = Read-Host -AsSecureString "Paste your ESV API key"
  $Key = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
}
$Key = ($Key -replace '\s', '')
if (-not $Key) { Write-Error "No key given."; exit 1 }

New-Item -ItemType Directory -Force -Path $dir | Out-Null
$json = '{"key":"' + $Key + '"}'
Set-Content -Path $file -Value $json -NoNewline -Encoding UTF8
Write-Host "Wrote ESV key to: $file"
Write-Host "Restart Cantica - the ESV option in the Psalms tab now works, no in-app setup."
