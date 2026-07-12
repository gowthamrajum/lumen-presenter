// Pure-JS PowerPoint (.pptx) importer.
//
// A .pptx is a zip (Open Packaging Convention). We unzip it, walk the slides in
// order, and for each slide pull out (a) the text runs, in reading order, and
// (b) a background — image OR color — resolved through PowerPoint's inheritance
// chain: slide -> slide layout -> slide master, with theme colors resolved via
// the master's color map. No external tools (LibreOffice / poppler) are needed.
//
// Why the chain matters: real decks almost never set a background on the slide
// itself. A lyrics template puts the image/color on the master, and every slide
// inherits it. Reading only the slide XML (as a naive importer does) yields
// "text with no background" and, for content-less slides, "blank" slides.
//
// This is deliberately a *content* importer, not a pixel-perfect renderer:
// fonts, exact positions, and animations are not reproduced. For worship decks
// — lyrics/text over a background — that is exactly what Lumen wants, and the
// resulting text stays fully editable inside the app.

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { basename, extname, join } from 'path'
import { unzipSync } from 'fflate'
import type { ImportedSlide, PptxImport } from '../shared/types'

// Default 16:9 slide in EMUs, used only if presentation.xml omits the size.
const DEFAULT_SLIDE_CX = 12192000
const DEFAULT_SLIDE_CY = 6858000

// A picture becomes a background when it covers at least this fraction of the
// slide. The bar is lower for text-less slides so a photo isn't dropped as blank.
const COVERAGE_WITH_TEXT = 0.5
const COVERAGE_NO_TEXT = 0.15

type Zip = Record<string, Uint8Array>

const decoder = new TextDecoder('utf-8')
const textOf = (files: Zip, name: string): string | undefined =>
  files[name] ? decoder.decode(files[name]) : undefined

// ---- text ------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&') // last, so escaped entities above aren't double-decoded
}

/** Extract text lines from a slide's XML — one entry per non-empty paragraph. */
function extractLines(xml: string): string[] {
  const lines: string[] = []
  for (const para of xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) ?? []) {
    // A hard line break (<a:br/>) splits a paragraph into multiple visual lines.
    for (const segment of para.split(/<a:br\b[^>]*\/?>/)) {
      const runs = segment.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g) ?? []
      const text = runs
        .map((r) => decodeEntities(r.replace(/^<a:t\b[^>]*>/, '').replace(/<\/a:t>$/, '')))
        .join('')
        .trim()
      if (text) lines.push(text)
    }
  }
  return lines
}

// ---- relationships ---------------------------------------------------------

interface Rel {
  target: string
  type: string
  external: boolean
}

/** Collapse `..` / `.` segments in a forward-slash zip path. */
function normalizeZipPath(path: string): string {
  const out: string[] = []
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') out.pop()
    else out.push(seg)
  }
  return out.join('/')
}

/** Parse the .rels file that sits beside `xmlPath`, resolving targets to zip paths. */
function relMap(files: Zip, xmlPath: string): Record<string, Rel> {
  const slash = xmlPath.lastIndexOf('/')
  const dir = xmlPath.slice(0, slash)
  const base = xmlPath.slice(slash + 1)
  const rels = textOf(files, `${dir}/_rels/${base}.rels`)
  const map: Record<string, Rel> = {}
  if (!rels) return map
  for (const rel of rels.match(/<Relationship\b[^>]*\/?>/g) ?? []) {
    const id = /Id="([^"]+)"/.exec(rel)?.[1]
    const target = /Target="([^"]+)"/.exec(rel)?.[1]
    if (!id || !target) continue
    const external = /TargetMode="External"/.test(rel)
    map[id] = {
      type: /Type="([^"]+)"/.exec(rel)?.[1] ?? '',
      external,
      target: external ? target : normalizeZipPath(`${dir}/${target}`)
    }
  }
  return map
}

/** First relationship target whose Type ends with `suffix` (e.g. "slideLayout"). */
function relByType(files: Zip, xmlPath: string, suffix: string): string | undefined {
  for (const rel of Object.values(relMap(files, xmlPath))) {
    if (!rel.external && rel.type.endsWith(suffix)) return rel.target
  }
  return undefined
}

// ---- colors (theme + modifiers) --------------------------------------------

const PRESET_COLORS: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  gray: '#808080',
  grey: '#808080',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00'
}

const clampByte = (x: number): number => Math.max(0, Math.min(255, Math.round(x)))
const toRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const toHex = ([r, g, b]: number[]): string =>
  '#' + [r, g, b].map((v) => clampByte(v).toString(16).padStart(2, '0')).join('')

/** OOXML value like "60000" -> 0.6, or null when absent. */
function pct(m: RegExpExecArray | null): number | null {
  return m ? Number(m[1]) / 100000 : null
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255]
  const hue = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue(p, q, h + 1 / 3) * 255, hue(p, q, h) * 255, hue(p, q, h - 1 / 3) * 255]
}

// OOXML color modifiers (approximations good enough for a background):
const applyShade = (hex: string, v: number): string => toHex(toRgb(hex).map((c) => c * v))
const applyTint = (hex: string, v: number): string => toHex(toRgb(hex).map((c) => c * v + 255 * (1 - v)))
function applyLum(hex: string, mod: number, off: number): string {
  const [r, g, b] = toRgb(hex)
  const [h, s, l] = rgbToHsl(r, g, b)
  return toHex(hslToRgb(h, s, Math.max(0, Math.min(1, l * mod + off))))
}

interface Theme {
  scheme: Record<string, string> // dk1, lt1, dk2, lt2, accent1..6, hlink, folHlink
  clrMap: Record<string, string> // bg1 -> lt1, tx1 -> dk1, ...
}

const EMPTY_THEME: Theme = { scheme: {}, clrMap: {} }

/** Build the theme color scheme from a theme part. */
function buildScheme(themeXml: string | undefined): Record<string, string> {
  const scheme: Record<string, string> = {}
  const block = themeXml && /<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/.exec(themeXml)?.[0]
  if (!block) return scheme
  const re = /<a:(dk1|lt1|dk2|lt2|accent[1-6]|hlink|folHlink)>([\s\S]*?)<\/a:\1>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(block))) {
    const inner = m[2]
    const srgb = /<a:srgbClr\b[^>]*val="([0-9a-fA-F]{6})"/.exec(inner)
    const sys = /<a:sysClr\b[^>]*lastClr="([0-9a-fA-F]{6})"/.exec(inner)
    const hex = srgb?.[1] ?? sys?.[1]
    if (hex) scheme[m[1]] = '#' + hex.toLowerCase()
  }
  return scheme
}

/** Read `<p:clrMap>` from a master (maps bg1/tx1/... to theme slots). */
function buildClrMap(masterXml: string | undefined): Record<string, string> {
  const tag = masterXml && /<p:clrMap\b[^>]*>/.exec(masterXml)?.[0]
  const map: Record<string, string> = {}
  if (!tag) return map
  for (const a of tag.matchAll(/(\w+)="([^"]+)"/g)) map[a[1]] = a[2]
  return map
}

function resolveScheme(val: string, theme: Theme): string | undefined {
  if (val === 'phClr') return undefined
  const slot = theme.clrMap[val] ?? val // bg1 -> lt1, accent1 -> accent1
  return theme.scheme[slot] ?? theme.scheme[val]
}

/** Resolve a color from a fill/color fragment, applying shade/tint/lum modifiers. */
function colorFrom(fragment: string, theme: Theme): string | undefined {
  let base: string | undefined
  let m: RegExpExecArray | null
  if ((m = /<a:srgbClr\b[^>]*val="([0-9a-fA-F]{6})"/.exec(fragment))) base = '#' + m[1].toLowerCase()
  else if ((m = /<a:sysClr\b[^>]*lastClr="([0-9a-fA-F]{6})"/.exec(fragment))) base = '#' + m[1].toLowerCase()
  else if ((m = /<a:schemeClr\b[^>]*val="([^"]+)"/.exec(fragment))) base = resolveScheme(m[1], theme)
  else if ((m = /<a:prstClr\b[^>]*val="([^"]+)"/.exec(fragment))) base = PRESET_COLORS[m[1]]
  if (!base) return undefined

  const shade = pct(/<a:shade\b[^>]*val="(\d+)"/.exec(fragment))
  const tint = pct(/<a:tint\b[^>]*val="(\d+)"/.exec(fragment))
  const lumMod = pct(/<a:lumMod\b[^>]*val="(\d+)"/.exec(fragment))
  const lumOff = pct(/<a:lumOff\b[^>]*val="(\d+)"/.exec(fragment))
  let c = base
  if (shade != null) c = applyShade(c, shade)
  if (tint != null) c = applyTint(c, tint)
  if (lumMod != null || lumOff != null) c = applyLum(c, lumMod ?? 1, lumOff ?? 0)
  return c
}

// ---- backgrounds -----------------------------------------------------------

/** The `<p:bg>` block's blip r:embed id, if it is an image fill. */
function bgImageEmbed(xml: string): string | undefined {
  const bg = /<p:bg>[\s\S]*?<\/p:bg>/.exec(xml)?.[0]
  return bg ? /<a:blip\b[^>]*r:embed="([^"]+)"/.exec(bg)?.[1] : undefined
}

/** The `<p:bg>` block's solid/gradient/reference color, if any. */
function bgColor(xml: string, theme: Theme): string | undefined {
  const bg = /<p:bg>[\s\S]*?<\/p:bg>/.exec(xml)?.[0]
  if (!bg) return undefined
  const solid = /<a:solidFill>([\s\S]*?)<\/a:solidFill>/.exec(bg)?.[1]
  if (solid) {
    const c = colorFrom(solid, theme)
    if (c) return c
  }
  const gs = /<a:gs\b[^>]*>([\s\S]*?)<\/a:gs>/.exec(bg)?.[1] // first gradient stop
  if (gs) {
    const c = colorFrom(gs, theme)
    if (c) return c
  }
  const ref = /<p:bgRef\b[^>]*>([\s\S]*?)<\/p:bgRef>/.exec(bg)?.[1] // themed fill reference
  if (ref) {
    const c = colorFrom(ref, theme)
    if (c) return c
  }
  return undefined
}

/**
 * Embed ids of every `<p:pic>` that covers >= minCoverage of the slide, in
 * paint order (DOM order = z-order, bottom first). Pre-rendered decks stack a
 * photo and a transparent text PNG this way, so we keep them all rather than
 * picking one and losing the words.
 */
function fullBleedEmbeds(xml: string, area: number, minCoverage: number): string[] {
  const ids: string[] = []
  for (const pic of xml.match(/<p:pic\b[\s\S]*?<\/p:pic>/g) ?? []) {
    const id = /<a:blip\b[^>]*r:embed="([^"]+)"/.exec(pic)?.[1]
    if (!id) continue
    const ext = /<a:ext\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/.exec(pic)
    const coverage = ext && area > 0 ? (Number(ext[1]) * Number(ext[2])) / area : 0
    if (coverage >= minCoverage) ids.push(id)
  }
  return ids
}

// ---- import ----------------------------------------------------------------

interface Deck {
  files: Zip
  area: number
  safeName: string
  cacheDir: string
  toMediaUrl: (absPath: string) => string
  /** source media zip-path -> extracted url, so shared master images write once */
  mediaCache: Map<string, string>
  themeCache: Map<string, Theme>
}

/** Extract an embedded image (dedup by source path) and return its media url. */
function extractImage(deck: Deck, embedId: string, ownerPath: string): string | undefined {
  const target = relMap(deck.files, ownerPath)[embedId]?.target
  if (!target) return undefined
  const cached = deck.mediaCache.get(target)
  if (cached) return cached
  const bytes = deck.files[target]
  if (!bytes) return undefined
  const outName = `${deck.safeName}-${deck.mediaCache.size + 1}-${basename(target)}`
  const outPath = join(deck.cacheDir, outName)
  writeFileSync(outPath, bytes)
  const url = deck.toMediaUrl(outPath)
  deck.mediaCache.set(target, url)
  return url
}

/**
 * Resolve+extract this level's background image layers, bottom to top: the
 * `<p:bg>` fill first (if any), then every full-bleed picture in paint order.
 * Returns [] when the level contributes no background imagery.
 */
function levelImages(deck: Deck, xml: string, ownerPath: string, minCoverage: number): string[] {
  const embeds: string[] = []
  const bgEmbed = bgImageEmbed(xml)
  if (bgEmbed) embeds.push(bgEmbed)
  embeds.push(...fullBleedEmbeds(xml, deck.area, minCoverage))

  const urls: string[] = []
  for (const embed of embeds) {
    const url = extractImage(deck, embed, ownerPath)
    if (url) urls.push(url)
  }
  return urls
}

/** The theme (scheme + color map) reachable from a slide master, cached per master. */
function themeForMaster(deck: Deck, masterPath: string): Theme {
  const hit = deck.themeCache.get(masterPath)
  if (hit) return hit
  const masterXml = textOf(deck.files, masterPath)
  const themePath = relByType(deck.files, masterPath, 'theme')
  const theme: Theme = {
    scheme: buildScheme(themePath ? textOf(deck.files, themePath) : undefined),
    clrMap: buildClrMap(masterXml)
  }
  deck.themeCache.set(masterPath, theme)
  return theme
}

function importSlide(deck: Deck, slidePath: string, index: number): ImportedSlide {
  const slideXml = textOf(deck.files, slidePath) ?? ''
  const lines = extractLines(slideXml)

  // Walk the inheritance chain: slide -> layout -> master (-> theme).
  const layoutPath = relByType(deck.files, slidePath, 'slideLayout')
  const layoutXml = layoutPath ? textOf(deck.files, layoutPath) : undefined
  const masterPath = layoutPath ? relByType(deck.files, layoutPath, 'slideMaster') : undefined
  const masterXml = masterPath ? textOf(deck.files, masterPath) : undefined
  const theme = masterPath ? themeForMaster(deck, masterPath) : EMPTY_THEME

  // Images win over colors, and nearer levels win over inherited ones. The
  // first level to contribute imagery supplies all layers (bottom -> top).
  const slideCoverage = lines.length ? COVERAGE_WITH_TEXT : COVERAGE_NO_TEXT
  let layers = levelImages(deck, slideXml, slidePath, slideCoverage)
  if (!layers.length && layoutXml && layoutPath) {
    layers = levelImages(deck, layoutXml, layoutPath, COVERAGE_WITH_TEXT)
  }
  if (!layers.length && masterXml && masterPath) {
    layers = levelImages(deck, masterXml, masterPath, COVERAGE_WITH_TEXT)
  }

  const backgroundUrl = layers[0]
  const overlayUrls = layers.slice(1)

  let backgroundColor: string | undefined
  if (!backgroundUrl) {
    backgroundColor =
      bgColor(slideXml, theme) ??
      (layoutXml ? bgColor(layoutXml, theme) : undefined) ??
      (masterXml ? bgColor(masterXml, theme) : undefined)
  }

  return {
    index,
    lines,
    backgroundUrl,
    overlayUrls: overlayUrls.length ? overlayUrls : undefined,
    backgroundColor
  }
}

/** Numeric order of slideN.xml so slide2 sorts before slide10. */
function slideNumber(name: string): number {
  const m = /slide(\d+)\.xml$/.exec(name)
  return m ? parseInt(m[1], 10) : 0
}

/** Read the presentation-wide slide size (EMUs) from presentation.xml. */
function slideArea(files: Zip): number {
  const pres = textOf(files, 'ppt/presentation.xml')
  const m = pres && /<p:sldSz\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/.exec(pres)
  const cx = m ? Number(m[1]) : DEFAULT_SLIDE_CX
  const cy = m ? Number(m[2]) : DEFAULT_SLIDE_CY
  return cx * cy
}

/**
 * Import one or more .pptx files into Lumen slide payloads.
 *
 * @param filePaths absolute paths to .pptx files
 * @param cacheDir  directory to extract background images into
 * @param toMediaUrl builds a lumen-media:// url from an absolute file path
 */
export function importPptxFiles(
  filePaths: string[],
  cacheDir: string,
  toMediaUrl: (absPath: string) => string
): PptxImport[] {
  mkdirSync(cacheDir, { recursive: true })
  const results: PptxImport[] = []

  for (const filePath of filePaths) {
    try {
      const files = unzipSync(readFileSync(filePath))
      const deckName = basename(filePath, extname(filePath))
      const deck: Deck = {
        files,
        area: slideArea(files),
        safeName: deckName.replace(/[^a-z0-9-_]+/gi, '_'),
        cacheDir,
        toMediaUrl,
        mediaCache: new Map(),
        themeCache: new Map()
      }

      const slides = Object.keys(files)
        .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a, b) => slideNumber(a) - slideNumber(b))
        .map((name, i) => importSlide(deck, name, i + 1))

      results.push({ name: deckName, slides })
    } catch (err) {
      // One bad file shouldn't abort the whole import; surface it and skip.
      console.error(`[pptx] failed to import ${filePath}:`, err)
    }
  }

  return results
}
