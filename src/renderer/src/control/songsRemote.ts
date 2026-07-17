import type { RemoteSong, Song, SongSection } from '@shared/types'
import { uid } from '../store/useStore'

export type SongLang = 'telugu' | 'english' | 'both'

/** Pick lyric lines for a section in the chosen language. "both" lays out each
 *  slide as a block of up to 2 Telugu lines followed by their up to 2 English
 *  lines (so a 4-line slide reads: 2 Telugu on top, 2 English below), rather than
 *  interleaving line-by-line. Chunked 4-per-slide downstream. */
function pickLines(telugu: string[] = [], english: string[] = [], lang: SongLang): string[] {
  if (lang === 'telugu') return telugu
  if (lang === 'english') return english
  const out: string[] = []
  const n = Math.max(telugu.length, english.length)
  for (let i = 0; i < n; i += 2) {
    // Telugu block (this slide's 2 lines), then the matching English block.
    if (telugu[i]) out.push(telugu[i])
    if (telugu[i + 1]) out.push(telugu[i + 1])
    if (english[i]) out.push(english[i])
    if (english[i + 1]) out.push(english[i + 1])
  }
  return out
}

/** Map a backend song into Lumen's Song model. */
export function remoteToSong(r: RemoteSong, lang: SongLang): Song {
  const sections: SongSection[] = []
  if (r.main_stanza && (r.main_stanza.telugu?.length || r.main_stanza.english?.length)) {
    sections.push({
      id: uid(),
      kind: 'chorus',
      label: 'Pallavi',
      lines: pickLines(r.main_stanza.telugu, r.main_stanza.english, lang)
    })
  }
  let verseNo = 0
  for (const st of r.stanzas ?? []) {
    verseNo++
    sections.push({
      id: uid(),
      kind: 'verse',
      label: `Stanza ${st.stanza_number ?? verseNo}`,
      lines: pickLines(st.telugu, st.english, lang)
    })
  }
  // Bilingual slides carry 2 Telugu + 2 English lines (4); single-language keep 2.
  const both = lang === 'both'
  return {
    id: uid(),
    title: String(r.song_name ?? 'Untitled'),
    sections,
    linesPerSlide: both ? 4 : 2,
    bilingual: both
  }
}
