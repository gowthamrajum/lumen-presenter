import type { RemoteSong, Song, SongSection } from '@shared/types'
import { uid } from '../store/useStore'

export type SongLang = 'telugu' | 'english' | 'both'

/** Pick lyric lines for a section in the chosen language. "both" interleaves
 *  each Telugu line with its transliteration. */
function pickLines(telugu: string[] = [], english: string[] = [], lang: SongLang): string[] {
  if (lang === 'telugu') return telugu
  if (lang === 'english') return english
  const out: string[] = []
  const n = Math.max(telugu.length, english.length)
  for (let i = 0; i < n; i++) {
    if (telugu[i]) out.push(telugu[i])
    if (english[i]) out.push(english[i])
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
  return { id: uid(), title: String(r.song_name ?? 'Untitled'), sections, linesPerSlide: 2 }
}
