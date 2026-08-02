import { useEffect, useState } from 'react'
import { useStore, uid } from '../../store/useStore'
import { songSlides, songComposedSlides } from '../slides'
import { ensureComposerFont } from '../compose'
import { buildSongArrangement } from '../songArrange'
import { remoteToSong, type SongLang } from '../songsRemote'
import { SongEditor } from './SongEditor'
import { SongStructureDialog, type AddSongChoice } from './SongStructureDialog'
import { LangToggle } from './LangToggle'
import { Icon } from '../../shared/Icon'
import type { Background, RemoteSong, SlideContent, Song } from '@shared/types'

type AddMode = 'slides' | 'canvas'

/**
 * The song's own Telugu line, shown under the transliterated name in the online
 * list. Every song in the catalogue opens its main stanza with it, and it is the
 * title as the congregation actually knows the song — the transliteration alone
 * ("Yehovaa Naa Kaapari") is the searchable spelling, not the name they sing.
 * A trailing "(2)" is a sing-it-twice marker rather than part of the line.
 */
function teluguTitle(r: RemoteSong): string {
  const line = r.main_stanza?.telugu?.[0] ?? r.stanzas?.[0]?.telugu?.[0] ?? ''
  return line.replace(/\s*\(\d+\)\s*$/, '').trim()
}

function newSong(): Song {
  return {
    id: uid(),
    title: '',
    sections: [{ id: uid(), kind: 'verse', label: 'Verse 1', lines: [] }],
    linesPerSlide: 2
  }
}

export function SongsPanel(): JSX.Element {
  const songs = useStore((s) => s.songs)
  const addSong = useStore((s) => s.addSong)
  const deleteSong = useStore((s) => s.deleteSong)
  const saveSong = useStore((s) => s.saveSong)
  const remoteSongs = useStore((s) => s.remoteSongs)
  const remoteState = useStore((s) => s.remoteState)
  const remoteError = useStore((s) => s.remoteError)
  const loadRemoteSongs = useStore((s) => s.loadRemoteSongs)
  const currentBackground = useStore((s) => s.background)

  // Adding a song lands on Online (the Telugu catalog) by default; the local
  // Library is a click away.
  const [mode, setMode] = useState<'library' | 'online'>('online')
  const [query, setQuery] = useState('')
  const [lang, setLang] = useState<SongLang>('both')
  const [editing, setEditing] = useState<Song | null>(null)
  const [note, setNote] = useState('')
  /** a song awaiting the "which section repeats?" prompt before it's added */
  const [structure, setStructure] = useState<{ song: Song; mode: AddMode; goLive: boolean } | null>(null)

  useEffect(() => {
    if (mode === 'online') void loadRemoteSongs()
  }, [mode, loadRemoteSongs])

  const q = query.trim().toLowerCase()

  // Build slides (arrangement already applied), optionally stamp a background, add.
  const doAdd = async (
    song: Song,
    mode: AddMode,
    goLive: boolean,
    bg: Background | null = null
  ): Promise<void> => {
    setNote('') // start each add from a clean slate
    const stamp = (slides: SlideContent[]): SlideContent[] =>
      bg ? slides.map((s) => ({ ...s, background: bg })) : slides
    if (mode === 'canvas') {
      await ensureComposerFont()
      const slides = stamp(songComposedSlides(song))
      if (!slides.length) {
        setNote(`No lyrics in the selected language for “${song.title}”.`)
        return
      }
      addSong({ title: song.title, slides })
      setNote(`Added “${song.title}” to Canvas (${slides.length} slides), wrapped with Praise & Worship. Use the edit icon on a slide to compose it.`)
    } else {
      const slides = stamp(songSlides(song))
      if (!slides.length) {
        setNote(`No lyrics in the selected language for “${song.title}”.`)
        return
      }
      addSong({ title: song.title, slides }, goLive)
      setNote(`Added “${song.title}” (${slides.length} slides), wrapped with Praise & Worship.`)
    }
  }

  // Deliberate add via a button -> open the chooser (stanzas / repeat / background).
  const queueAdd = (song: Song, mode: AddMode): void => setStructure({ song, mode, goLive: false })
  const confirmStructure = (choice: AddSongChoice): void => {
    if (!structure) return
    const { song, mode, goLive } = structure
    let arrangement = buildSongArrangement(song, choice.includedIds, choice.recurringId)
    // Apply any edited/broken lines to the recurring section (whole stanza plays first).
    let sections =
      choice.recurringId && choice.recurringLines
        ? song.sections.map((s) => (s.id === choice.recurringId ? { ...s, lines: choice.recurringLines! } : s))
        : song.sections
    // Lines reordered by moving units in the grouping editor (a Telugu line and
    // its transliteration always move as one). Applied before the grouping so
    // the two describe the same section.
    if (choice.sectionLines) {
      sections = sections.map((s) =>
        choice.sectionLines?.[s.id] ? { ...s, lines: choice.sectionLines[s.id] } : s
      )
    }
    // Stamp on the operator's slide grouping (units per slide). songSlides drops
    // any that no longer fits its section, so an edited stanza just reverts to
    // the automatic split rather than mis-slicing.
    if (choice.groups) {
      sections = sections.map((s) => (choice.groups?.[s.id] ? { ...s, groups: choice.groups[s.id] } : s))
    }
    // Partial repeat: keep the FIRST occurrence of the recurring section whole,
    // and swap every LATER occurrence for a synthetic section holding only the
    // ticked lines — e.g. Pallavi in full, then just its first line each repeat.
    if (choice.recurringId && (choice.repeatLineIndices || choice.repeatLines)) {
      const rec = sections.find((s) => s.id === choice.recurringId)
      if (rec) {
        // `repeatLines` is the exact order the operator dragged the repeat into;
        // it wins over the tick indices, which only describe which lines repeat.
        const rptLines =
          choice.repeatLines ??
          (choice.repeatLineIndices ?? []).map((i) => rec.lines[i]).filter((l): l is string => l != null)
        const rptId = `${rec.id}__rpt`
        // The repeat holds a subset of the lines, so the stanza's own grouping
        // doesn't describe it — it carries the repeat's grouping instead (chosen
        // in the repeat's split editor), or falls back to the automatic split.
        sections = [...sections, { ...rec, id: rptId, lines: rptLines, groups: choice.repeatGroups }]
        let seenFirst = false
        arrangement = arrangement.map((id) => {
          if (id !== choice.recurringId) return id
          if (seenFirst) return rptId
          seenFirst = true
          return id
        })
      }
    }
    setStructure(null)
    void doAdd({ ...song, sections, arrangement }, mode, goLive, choice.background)
  }

  // ----- local library -----
  const localFiltered = q
    ? songs.filter((s) => `${s.title} ${s.author ?? ''} ${s.telugu ?? ''}`.toLowerCase().includes(q))
    : songs
  const openLocal = async (id: string, mode: AddMode): Promise<void> => {
    const song = await window.lumen.loadSong(id)
    if (song) queueAdd(song, mode)
  }
  const presentLocal = async (id: string): Promise<void> => {
    const song = await window.lumen.loadSong(id)
    if (song) void doAdd(song, 'slides', true) // double-click: quick add & present, written order
  }
  const edit = async (id: string): Promise<void> => {
    const song = await window.lumen.loadSong(id)
    if (song) setEditing(song)
  }

  // ----- remote catalog -----
  // Match the Telugu line as well as the transliteration: it's on screen now, so
  // typing (or pasting) "యెహోవా" should find the song the same way "Yehovaa" does.
  const remoteFiltered = (
    q
      ? remoteSongs.filter(
          (r) =>
            String(r.song_name ?? '').toLowerCase().includes(q) || teluguTitle(r).toLowerCase().includes(q)
        )
      : remoteSongs
  ).slice(0, 400)
  const openRemote = (r: RemoteSong, mode: AddMode): void => queueAdd(remoteToSong(r, lang), mode)
  const presentRemote = (r: RemoteSong): void => void doAdd(remoteToSong(r, lang), 'slides', true)
  const importRemote = async (r: RemoteSong): Promise<void> => {
    try {
      await saveSong(remoteToSong(r, lang))
      setNote(`Imported “${r.song_name}” to your library.`)
    } catch (e) {
      setNote(`Could not import: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <div className="source songs-source">
      <div className="seg full">
        <button
          className={`seg-btn ${mode === 'library' ? 'active' : ''}`}
          onClick={() => {
            setMode('library')
            setNote('')
          }}
        >
          Library
        </button>
        <button
          className={`seg-btn ${mode === 'online' ? 'active' : ''}`}
          onClick={() => {
            setMode('online')
            setNote('')
          }}
        >
          Online
        </button>
      </div>

      {mode === 'library' && (
        <button className="btn btn-primary full" onClick={() => setEditing(newSong())}>
          + New song
        </button>
      )}

      <input
        className="search"
        placeholder={mode === 'online' ? 'Search the online catalog' : 'Search your songs'}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (note) setNote('')
        }}
      />

      {mode === 'online' && (
        <div className="lang-row">
          <LangToggle
            value={lang}
            onChange={(l) => {
              setLang(l as SongLang)
              setNote('')
            }}
            title="Lyric language on the slide"
          />
          {remoteState === 'ready' && (
            <button className="btn tiny icon-btn" onClick={() => void loadRemoteSongs(true)} title="Reload catalog">
              <Icon name="refresh" />
            </button>
          )}
        </div>
      )}

      {note && <div className="empty-note">{note}</div>}

      {mode === 'library' ? (
        <>
          {songs.length === 0 && (
            <div className="empty-note">No songs yet. Create one, or grab some from <b>Online</b>.</div>
          )}
          {songs.length > 0 && localFiltered.length === 0 && <div className="empty-note">No matches.</div>}
          <div className="song-list">
            {localFiltered.map((s) => (
              <div key={s.id} className="song-row">
                <div className="song-row-main" onDoubleClick={() => void presentLocal(s.id)} title="Double-click to add & present">
                  <div className="song-title">{s.title || 'Untitled Song'}</div>
                  {s.telugu && <div className="song-telugu">{s.telugu}</div>}
                </div>
                <div className="song-meta">
                  {s.author && <div className="song-author">{s.author}</div>}
                  <div className="song-actions">
                    <button className="btn tiny song-add" onClick={() => void openLocal(s.id, 'slides')} title="Add to service">Add</button>
                    <button className="btn tiny" onClick={() => void openLocal(s.id, 'canvas')} title="Add as editable Canvas slides">Canvas</button>
                    <button className="btn tiny" onClick={() => void edit(s.id)} title="Edit song">Edit</button>
                    <button className="btn tiny icon-btn" onClick={() => void deleteSong(s.id)} title="Delete">
                      <Icon name="close" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="source-hint">Double-click a song to present · Add drops it into the current service.</div>
        </>
      ) : (
        <>
          {(remoteState === 'loading' || remoteState === 'idle') && (
            <div className="empty-note">Loading catalog… (first load can take a moment)</div>
          )}
          {remoteState === 'error' && (
            <div className="empty-note">
              Couldn&apos;t reach the catalog ({remoteError}).{' '}
              <button className="btn tiny" onClick={() => void loadRemoteSongs(true)}>Retry</button>
            </div>
          )}
          {remoteState === 'ready' && remoteFiltered.length === 0 && <div className="empty-note">No matches.</div>}
          <div className="song-list">
            {remoteFiltered.map((r) => (
              <div key={r.song_id} className="song-row">
                <div className="song-row-main" onDoubleClick={() => presentRemote(r)} title="Double-click to add & present">
                  <div className="song-title">{r.song_name}</div>
                  {teluguTitle(r) && <div className="song-telugu">{teluguTitle(r)}</div>}
                </div>
                <div className="song-meta">
                  <div className="song-author">{(r.stanzas?.length ?? 0) + (r.main_stanza ? 1 : 0)} sections</div>
                  <div className="song-actions">
                    <button className="btn tiny song-add" onClick={() => openRemote(r, 'slides')} title="Add to service">Add</button>
                    <button className="btn tiny" onClick={() => openRemote(r, 'canvas')} title="Add as editable Canvas slides">Canvas</button>
                    <button className="btn tiny" onClick={() => void importRemote(r)} title="Save to your library">Import</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {remoteState === 'ready' && (
            <div className="source-hint">
              {remoteSongs.length} songs online · showing {remoteFiltered.length}. Language applies on add/import.
            </div>
          )}
        </>
      )}

      {editing && <SongEditor song={editing} onClose={() => setEditing(null)} />}
      {structure && (
        <SongStructureDialog
          song={structure.song}
          currentBackground={currentBackground}
          onCancel={() => setStructure(null)}
          onConfirm={confirmStructure}
        />
      )}
    </div>
  )
}
