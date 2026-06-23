import { useMemo, useState } from 'react';
import type { Track } from '../data/tracks';
import type { SpotifyAccount, TrackInfo } from '../spotify/api';
import type { RoutineSourceRow } from '../data/routineSources';
import type { useSetlist } from '../hooks/useSetlist';
import TrackList from './TrackList';
import DevicePicker from './DevicePicker';
import RoutinesManager from './RoutinesManager';
import InstallPrompt from './InstallPrompt';
import SetlistPanel from './SetlistPanel';
import Settings from './Settings';
import { AlertTriangle } from './icons';

/**
 * The track-list home screen: search + favorites filter, the routine list, the
 * setlist queue, the routine-source manager and settings. Purely presentational
 * — all persistence and navigation flow in as props. List-local search state
 * lives here since nothing else needs it.
 */
export default function ListScreen({
  tracks,
  trackInfos,
  online,
  infosError,
  account,
  resumeIndex,
  onOpenTrack,
  onLogout,
  deviceId,
  onSelectDevice,
  favorites,
  onToggleFavorite,
  setlist,
  onStartSession,
  onEdit,
  onNew,
  onSeed,
  sourceRows,
  onToggleSource,
  onAddCustom,
  onRemoveCustom,
  onReset,
}: {
  tracks: Track[];
  trackInfos: Record<string, TrackInfo>;
  online: boolean;
  infosError: string | null;
  account: SpotifyAccount | null;
  resumeIndex: number | null;
  onOpenTrack: (index: number, asResume?: boolean) => void;
  onLogout: () => void;
  deviceId: string | null;
  onSelectDevice: (id: string | null) => void;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  setlist: ReturnType<typeof useSetlist>;
  onStartSession: () => void;
  onEdit: (index: number) => void;
  onNew: () => void;
  onSeed: () => void;
  sourceRows: RoutineSourceRow[];
  onToggleSource: (key: string) => Promise<void>;
  onAddCustom: (label: string, data: Track[]) => void;
  onRemoveCustom: (id: string) => void;
  onReset: () => void;
}) {
  const [query, setQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const visibleTracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tracks
      .map((track, index) => ({ track, index }))
      .filter(({ track }) => {
        if (favoritesOnly && !favorites.has(track.id)) return false;
        if (!q) return true;
        const info = trackInfos[track.spotifyUri];
        const title = (track.title ?? info?.title ?? '').toLowerCase();
        const artist = (track.artist ?? info?.artist ?? '').toLowerCase();
        return title.includes(q) || artist.includes(q);
      });
  }, [tracks, query, favoritesOnly, favorites, trackInfos]);

  return (
    <>
      <header className="topbar">
        <h1>Tracks</h1>
        <div className="topbar-end">
          {account?.displayName && (
            <span className="topbar-user" title={account.displayName}>
              {account.displayName}
            </span>
          )}
          <button className="link" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>
      {account && account.product != null && account.product !== 'premium' && (
        <div className="premium-banner" role="alert">
          <AlertTriangle size={18} />
          <span>
            This account isn’t Spotify <strong>Premium</strong>. Playback control needs Premium —
            search and authoring still work, but Play/Pause/Seek will fail.
          </span>
        </div>
      )}
      <InstallPrompt />
      {resumeIndex != null && tracks[resumeIndex] && (
        <button className="resume-btn primary big" onClick={() => onOpenTrack(resumeIndex, true)}>
          ▶ Go back to your last session —{' '}
          {tracks[resumeIndex].title ??
            trackInfos[tracks[resumeIndex].spotifyUri]?.title ??
            'current track'}
        </button>
      )}
      <DevicePicker selectedDeviceId={deviceId} onSelect={onSelectDevice} />
      {infosError && online && <p className="error">Couldn’t load track info: {infosError}</p>}
      <div className="list-toolbar">
        <input
          className="search-input"
          type="search"
          value={query}
          placeholder="Search title or artist…"
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className={`chip ${favoritesOnly ? 'chip-active' : ''}`}
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly((v) => !v)}
        >
          ★ {favorites.size}
        </button>
      </div>
      <TrackList
        items={visibleTracks}
        infos={trackInfos}
        favorites={favorites}
        setlist={setlist.setlistSet}
        onSelect={(i) => onOpenTrack(i)}
        onEdit={onEdit}
        onToggleFavorite={onToggleFavorite}
        onToggleSetlist={setlist.toggle}
      />
      <SetlistPanel
        tracks={setlist.sessionTracks}
        infos={trackInfos}
        onMove={setlist.move}
        onRemove={setlist.remove}
        onClear={setlist.clear}
        onStart={onStartSession}
      />
      <div className="new-routine-row">
        <button className="ghost" onClick={onNew}>
          + New routine
        </button>
        <button className="ghost" onClick={onSeed}>
          Seed from playlist
        </button>
      </div>
      <RoutinesManager
        tracks={tracks}
        sources={sourceRows}
        onToggleSource={onToggleSource}
        onAddCustom={onAddCustom}
        onRemoveCustom={onRemoveCustom}
        onReset={onReset}
      />
      <Settings />
    </>
  );
}
