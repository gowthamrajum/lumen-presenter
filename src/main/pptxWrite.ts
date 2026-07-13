// Pure-JS PowerPoint (.pptx) writer — the mirror of pptx.ts (the importer).
//
// A .pptx is a zip (Open Packaging Convention). We assemble the minimal set of
// parts PowerPoint / Keynote / LibreOffice / Google Slides all accept — content
// types, a presentation, one theme + master + (blank) layout, and one slide per
// image — then zip it with fflate (already a dependency; no pptxgenjs needed).
//
// Each slide holds a single full-bleed picture: the frame we captured from the
// live <Stage>. So the deck is pixel-faithful (Telugu, composed layouts, and the
// exact look), at the cost of being image slides rather than editable text — the
// right trade for a worship deck where fidelity + font-portability matter most.

import { zipSync, strToU8 } from 'fflate'

// 16:9 slide, in EMUs (914400 per inch → 13.333in × 7.5in).
const SLIDE_CX = 12192000
const SLIDE_CY = 6858000

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const CT = 'http://schemas.openxmlformats.org/package/2006/content-types'
const PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

const contentTypes = (slideCount: number): string => {
  const overrides: string[] = [
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
  ]
  for (let i = 1; i <= slideCount; i++) {
    overrides.push(
      `<Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    )
  }
  return (
    XML_DECL +
    `<Types xmlns="${CT}">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    overrides.join('') +
    '</Types>'
  )
}

const rootRels =
  XML_DECL +
  `<Relationships xmlns="${PKG_REL}">` +
  `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/>` +
  '</Relationships>'

const presentation = (slideCount: number): string => {
  const ids: string[] = []
  for (let i = 1; i <= slideCount; i++) {
    // sldId ids must be ≥ 256 and unique; rId slides start at rId2 (rId1 = master).
    ids.push(`<p:sldId id="${255 + i}" r:id="rId${i + 1}"/>`)
  }
  return (
    XML_DECL +
    '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
    ` xmlns:r="${REL}"` +
    ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    `<p:sldIdLst>${ids.join('')}</p:sldIdLst>` +
    `<p:sldSz cx="${SLIDE_CX}" cy="${SLIDE_CY}" type="screen16x9"/>` +
    '<p:notesSz cx="6858000" cy="9144000"/>' +
    '</p:presentation>'
  )
}

const presentationRels = (slideCount: number): string => {
  const rels: string[] = [
    `<Relationship Id="rId1" Type="${REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/>`
  ]
  for (let i = 1; i <= slideCount; i++) {
    rels.push(`<Relationship Id="rId${i + 1}" Type="${REL}/slide" Target="slides/slide${i}.xml"/>`)
  }
  // Theme rel id sits after the slides so it never collides with a slide rId.
  rels.push(
    `<Relationship Id="rId${slideCount + 2}" Type="${REL}/theme" Target="theme/theme1.xml"/>`
  )
  return XML_DECL + `<Relationships xmlns="${PKG_REL}">${rels.join('')}</Relationships>`
}

// A minimal, valid Office theme (clrScheme + fontScheme + fmtScheme with the
// required 3 fills / 3 lines / 3 effects / 3 bg-fills).
const theme1 =
  XML_DECL +
  '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme"><a:themeElements>' +
  '<a:clrScheme name="Office">' +
  '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>' +
  '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>' +
  '<a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>' +
  '<a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2>' +
  '<a:accent3><a:srgbClr val="A5A5A5"/></a:accent3><a:accent4><a:srgbClr val="FFC000"/></a:accent4>' +
  '<a:accent5><a:srgbClr val="5B9BD5"/></a:accent5><a:accent6><a:srgbClr val="70AD47"/></a:accent6>' +
  '<a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink>' +
  '</a:clrScheme>' +
  '<a:fontScheme name="Office">' +
  '<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
  '<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>' +
  '</a:fontScheme>' +
  '<a:fmtScheme name="Office">' +
  '<a:fillStyleLst>' +
  '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
  '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
  '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
  '</a:fillStyleLst>' +
  '<a:lnStyleLst>' +
  '<a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
  '<a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
  '<a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>' +
  '</a:lnStyleLst>' +
  '<a:effectStyleLst>' +
  '<a:effectStyle><a:effectLst/></a:effectStyle>' +
  '<a:effectStyle><a:effectLst/></a:effectStyle>' +
  '<a:effectStyle><a:effectLst/></a:effectStyle>' +
  '</a:effectStyleLst>' +
  '<a:bgFillStyleLst>' +
  '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
  '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
  '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' +
  '</a:bgFillStyleLst>' +
  '</a:fmtScheme>' +
  '</a:themeElements></a:theme>'

const EMPTY_SPTREE =
  '<p:spTree>' +
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
  '</p:spTree>'

const P_NS =
  ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"' +
  ` xmlns:r="${REL}"` +
  ' xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'

const slideMaster =
  XML_DECL +
  `<p:sldMaster${P_NS}>` +
  '<p:cSld><p:bg><p:bgPr><a:solidFill><a:schemeClr val="bg1"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
  EMPTY_SPTREE +
  '</p:cSld>' +
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
  '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
  '</p:sldMaster>'

const slideMasterRels =
  XML_DECL +
  `<Relationships xmlns="${PKG_REL}">` +
  `<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
  `<Relationship Id="rId2" Type="${REL}/theme" Target="../theme/theme1.xml"/>` +
  '</Relationships>'

const slideLayout =
  XML_DECL +
  `<p:sldLayout${P_NS} type="blank" preserve="1">` +
  '<p:cSld name="Blank">' +
  EMPTY_SPTREE +
  '</p:cSld>' +
  '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
  '</p:sldLayout>'

const slideLayoutRels =
  XML_DECL +
  `<Relationships xmlns="${PKG_REL}">` +
  `<Relationship Id="rId1" Type="${REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>` +
  '</Relationships>'

// One slide = one full-bleed picture (r:embed="rId2"; rId1 is the layout).
const slideXml =
  XML_DECL +
  `<p:sld${P_NS}>` +
  '<p:cSld><p:spTree>' +
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
  '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
  '<p:pic>' +
  '<p:nvPicPr><p:cNvPr id="2" name="Slide"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>' +
  '<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
  `<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_CX}" cy="${SLIDE_CY}"/></a:xfrm>` +
  '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
  '</p:pic>' +
  '</p:spTree></p:cSld>' +
  '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
  '</p:sld>'

const slideRels = (index: number): string =>
  XML_DECL +
  `<Relationships xmlns="${PKG_REL}">` +
  `<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>` +
  `<Relationship Id="rId2" Type="${REL}/image" Target="../media/image${index}.png"/>` +
  '</Relationships>'

/**
 * Pack a sequence of PNG frames (one per slide, in order) into a .pptx byte
 * array. Each PNG becomes a full-bleed 16:9 slide.
 */
export function buildPptx(pngs: Uint8Array[]): Uint8Array {
  const n = pngs.length
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypes(n)),
    '_rels/.rels': strToU8(rootRels),
    'ppt/presentation.xml': strToU8(presentation(n)),
    'ppt/_rels/presentation.xml.rels': strToU8(presentationRels(n)),
    'ppt/theme/theme1.xml': strToU8(theme1),
    'ppt/slideMasters/slideMaster1.xml': strToU8(slideMaster),
    'ppt/slideMasters/_rels/slideMaster1.xml.rels': strToU8(slideMasterRels),
    'ppt/slideLayouts/slideLayout1.xml': strToU8(slideLayout),
    'ppt/slideLayouts/_rels/slideLayout1.xml.rels': strToU8(slideLayoutRels)
  }
  for (let i = 1; i <= n; i++) {
    files[`ppt/slides/slide${i}.xml`] = strToU8(slideXml)
    files[`ppt/slides/_rels/slide${i}.xml.rels`] = strToU8(slideRels(i))
    files[`ppt/media/image${i}.png`] = pngs[i - 1]
  }
  // PNGs are already compressed; keep the zip fast (store-ish) — level 0 for the
  // images happens implicitly since fflate won't shrink them, but a low global
  // level keeps the XML small without burning CPU on the big media.
  return zipSync(files, { level: 4 })
}
