import { useEffect, useState } from 'react'
import { useStore, uid } from '../../store/useStore'
import { songSlides, songComposedSlides } from '../slides'
import { ensureComposerFont } from '../compose'
import { remoteToSong, type SongLang } from '../songsRemote'
import { SongEditor } from './SongEditor'
import type { RemoteSong, Song } from '@shared/types'

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

  const [mode, setMode] = useState<'library' | 'online'>('library')
  const [query, setQuery] = useState('')
  const [lang, setLang] = useState<SongLang>('both')
  const [editing, setEditing] = useState<Song | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (mode === 'online') void loadRemoteSongs()
  }, [mode, loadRemoteSongs])

  const q = query.trim().toLowerCase()

  // ----- local library -----
  const localFiltered = q ? songs.filter((s) => `${s.title} ${s.author ?? ''}`.toLowerCase().includes(q)) : songs
  const addLocal = async (id: string, goLive: boolean): Promise<void> => {
    const song = await window.lumen.loadSong(id)
    if (song) addItem({ title: song.title, kind: 'song', slides: songSlides(song) }, goLive)
  }
  const edit = async (id: string): Promise<void> => {
    const song = await window.lumen.loadSong(id)
    if (song) setEditing(song)
  }

  // ----- remote catalog -----
  const remoteFiltered = (
    q ? remoteSongs.filter((r) => String(r.song_name ?? '').toLowerCase().includes(q)) : remoteSongs
  ).slice(0, 400)
  const addRemote = (r: RemoteSong, goLive: boolean): void => {
    const song = remoteToSong(r, lang)
    const slides = songSlides(song)
    if (!slides.length) {
      setNote(`No lyrics in the selected language for “${song.title}”.`)
      return
    }
    addItem({ title: song.title, kind: 'song', slides }, goLive)
  }
  const importRemote = async (r: RemoteSong): Promise<void> => {
    try {
      await saveSong(remoteToSong(r, lang))
      setNote(`Imported “${r.song_name}” to your library.`)
    } catch (e) {
      setNote(`Could not import: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ----- songs → Canvas (composed, editable slides) -----
  const canvasFromSong = async (song: Song): Promise<void> => {
    await ensureComposerFont()
    const slides = songComposedSlides(song)
    if (!slides.length) {
      setNote(`No lyrics in the selected language for “${song.title}”.`)
      return
    }
    addItem({ title: song.title, kind: 'song', slides })
    setNote(`Added “${song.title}” to Canvas (${slides.length} slides). Click ✎ on a slide to edit.`)
  }
  const canvasLocal = async (id: string): Promise<void> => {
    const song = await window.lumen.loadSong(id)
    if (song) await canvasFromSong(song)
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
        <div className="browse-row">
          <select
            value={lang}
            onChange={(e) => {
              setLang(e.target.value as SongLang)
              setNote('')
            }}
            title="Lyric language"
          >
            <option value="both">Both (తెలుగు + English)</option>
            <option value="telugu">తెలుగు only</option>
            <option value="english">English only (transliteration)</option>
          </select>
          {remoteState === 'ready' && (
            <button className="btn tiny" onClick={() => void loadRemoteSongs(true)} title="Reload catalog">
              ⟳
            </button>
          )}
        </div>
      )}

      {mode === 'library' ? (
        <>
          {songs.length === 0 && (
            <div className="empty-note">No songs yet. Create one, or grab some from <b>Online</b>.</div>
          )}
          {songs.length > 0 && localFiltered.length === 0 && <div className="empty-note">No matches.</div>}
          <div className="song-list">
            {localFiltered.map((s) => (
              <div key={s.id} className="song-row">
                <div className="song-row-main" onDoubleClick={() => void addLocal(s.id, true)} title="Double-click to add & present">
                  <div className="song-title">{s.title || 'Untitled Song'}</div>
                  {s.author && <div className="song-author">{s.author}</div>}
                </div>
                <div className="song-actions">
                  <button className="btn tiny" onClick={() => void addLocal(s.id, false)} title="Add to service">Add</button>
                  <button className="btn tiny" onClick={() => void canvasLocal(s.id)} title="Add as editable Canvas slides">Canvas</button>
                  <button className="btn tiny" onClick={() => void edit(s.id)} title="Edit song">Edit</button>
                  <button className="btn tiny" onClick={() => void deleteSong(s.id)} title="Delete">×</button>
                </div>
              </div>
            ))}
          </div>
          <div className="source-hint">Double-click a song to present · Add drops it into the current service.</div>
        </>
      ) : (
        <>
          {remoteState === 'loading' && <div className="empty-note">Loading catalog… (first load can take a moment)</div>}
          {remoteState === 'error' && (
            <div className="empty-note">
              Couldn&apos;t reach the catalog ({remoteError}).{' '}
              <button className="btn tiny" onClick={() => void loadRemoteSongs(true)}>Retry</button>
            </div>
          )}
          {note && <div className="empty-note">{note}</div>}
          {remoteState === 'ready' && remoteFiltered.length === 0 && <div className="empty-note">No matches.</div>}
          <div className="song-list">
            {remoteFiltered.map((r) => (
              <div key={r.song_id} className="song-row">
                <div className="song-row-main" onDoubleClick={() => addRemote(r, true)} title="Double-click to add & present">
                  <div className="song-title">{r.song_name}</div>
                  <div className="song-author">{(r.stanzas?.length ?? 0) + (r.main_stanza ? 1 : 0)} sections</div>
                </div>
                <div className="song-actions">
                  <button className="btn tiny" onClick={() => addRemote(r, false)} title="Add to service">Add</button>
                  <button className="btn tiny" onClick={() => void canvasFromSong(remoteToSong(r, lang))} title="Add as editable Canvas slides">Canvas</button>
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
    </div>
  )
}
