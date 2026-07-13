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
  const addItem = useStore((s) => s.addItem)
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
      addItem({ title: song.title, kind: 'song', slides })
      setNote(`Added “${song.title}” to Canvas (${slides.length} slides). Use the edit icon on a slide to compose it.`)
    } else {
      const slides = stamp(songSlides(song))
      if (!slides.length) {
        setNote(`No lyrics in the selected language for “${song.title}”.`)
        return
      }
      addItem({ title: song.title, kind: 'song', slides }, goLive)
      setNote(`Added “${song.title}” (${slides.length} slides).`)
    }
  }

  // Deliberate add via a button -> open the chooser (stanzas / repeat / background).
  const queueAdd = (song: Song, mode: AddMode): void => setStructure({ song, mode, goLive: false })
  const confirmStructure = (choice: AddSongChoice): void => {
    if (!structure) return
    const { song, mode, goLive } = structure
    const arrangement = buildSongArrangement(song, choice.includedIds, choice.recurringId)
    setStructure(null)
    void doAdd({ ...song, arrangement }, mode, goLive, choice.background)
  }

  // ----- local library -----
  const localFiltered = q ? songs.filter((s) => `${s.title} ${s.author ?? ''}`.toLowerCase().includes(q)) : songs
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
  const remoteFiltered = (
    q ? remoteSongs.filter((r) => String(r.song_name ?? '').toLowerCase().includes(q)) : remoteSongs
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
                  {s.author && <div className="song-author">{s.author}</div>}
                </div>
                <div className="song-actions">
                  <button className="btn tiny" onClick={() => void openLocal(s.id, 'slides')} title="Add to service">Add</button>
                  <button className="btn tiny" onClick={() => void openLocal(s.id, 'canvas')} title="Add as editable Canvas slides">Canvas</button>
                  <button className="btn tiny" onClick={() => void edit(s.id)} title="Edit song">Edit</button>
                  <button className="btn tiny icon-btn" onClick={() => void deleteSong(s.id)} title="Delete">
                    <Icon name="close" />
                  </button>
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
                  <div className="song-author">{(r.stanzas?.length ?? 0) + (r.main_stanza ? 1 : 0)} sections</div>
                </div>
                <div className="song-actions">
                  <button className="btn tiny" onClick={() => openRemote(r, 'slides')} title="Add to service">Add</button>
                  <button className="btn tiny" onClick={() => openRemote(r, 'canvas')} title="Add as editable Canvas slides">Canvas</button>
                  <button className="btn tiny" onClick={() => void importRemote(r)} title="Save to your library">Import</button>
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
