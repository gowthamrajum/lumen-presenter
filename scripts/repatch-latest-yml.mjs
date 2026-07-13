// Recompute electron-updater's latest.yml against a (re-)signed installer.
//
// electron-builder writes latest.yml (the Windows auto-update feed) while the
// .exe is still UNSIGNED. SignPath then modifies the .exe to embed the
// signature, which changes its bytes — so the sha512/size recorded in
// latest.yml no longer match and electron-updater would reject the update.
// Run this after signing to rewrite those fields against the signed file.
//
//   node scripts/repatch-latest-yml.mjs release/Lumen-Presenter-Setup-x.y.z.exe release/latest.yml
//
// Note: the differential-download .blockmap is left as-is; if it no longer
// matches, electron-updater simply falls back to a full download (still valid,
// just not delta). No external deps — latest.yml's sha512/size fields are
// replaced textually.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, statSync } from 'node:fs'

const [, , exePath, ymlPath] = process.argv
if (!exePath || !ymlPath) {
  console.error('usage: repatch-latest-yml.mjs <signed.exe> <latest.yml>')
  process.exit(1)
}

const sha512 = createHash('sha512').update(readFileSync(exePath)).digest('base64')
const size = statSync(exePath).size

// latest.yml carries the installer sha512 twice (files[].sha512 + top-level
// sha512) and its size once — both refer to the same installer, so a global
// field replace is correct here.
let text = readFileSync(ymlPath, 'utf8')
text = text.replace(/^(\s*)sha512: .*/gm, `$1sha512: ${sha512}`)
text = text.replace(/^(\s*)size: .*/gm, `$1size: ${size}`)
writeFileSync(ymlPath, text)

console.log(`repatched ${ymlPath} for ${exePath} (size=${size})`)
