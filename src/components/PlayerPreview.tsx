import { useEffect, useMemo, useRef, useState } from 'react';
import { TRACKS } from '../data/tracks';
import { buildCallings } from '../data/beats';
import CallingDisplay from './CallingDisplay';
import { Play } from './icons';

/**
 * Design preview of the player UI with NO Spotify auth and NO engine.
 * Reached at `?preview` (see main.tsx). It drives the real <CallingDisplay />
 * and the real gap/held overlay markup with a mock track + a local clock, so
 * the rebrand (orange/green), Barlow Condensed display font, and 4/8 spacing
 * can be checked on a phone without logging in. Not part of the shipped flow.
 */
function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

type Overlay = 'none' | 'gap' | 'held';

export default function PlayerPreview() {
  const track = TRACKS[0];
  const bpm = track.bpm ?? 128;
  const callings = useMemo(
    () => buildCallings(track.steps, track.firstBeatSec ?? 1, bpm),
    [track, bpm],
  );
  const durationSec = (track.durationMs ?? 220_000) / 1000;

  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [gapRemaining, setGapRemaining] = useState(20);
  const posRef = useRef(pos);
  posRef.current = pos;

  // Local 100ms clock advances the position when playing (mirrors the engine
  // ticker cadence) so the ring sweeps and count-ins fire just like live.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const next = posRef.current + 0.1;
      setPos(next >= durationSec ? 0 : next);
    }, 100);
    return () => clearInterval(id);
  }, [playing, durationSec]);

  // Gap overlay counts down like the real 20s gap.
  useEffect(() => {
    if (overlay !== 'gap') return;
    const id = setInterval(
      () => setGapRemaining((r) => (r <= 1 ? 20 : r - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, [overlay]);

  // Jump to ~1.5s before the next step boundary so the count-in / announcing
  // frame + ring fill are visible immediately.
  function jumpToSwitch() {
    const upcoming = callings.find((c) => c.time > pos + 2);
    const target = upcoming ?? callings[1];
    if (target) setPos(Math.max(0, target.time - 1.5));
  }

  const progressPct = Math.min(100, (pos / durationSec) * 100);

  return (
    <div className="screen">
      <div className="player">
        <header className="topbar">
          <div>
            <h1>{track.title ?? 'Preview track'}</h1>
            <span className="muted">{track.artist ?? 'Design preview'}</span>
          </div>
          <span className="badge">PREVIEW</span>
        </header>

        <div className="progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="progress-times">
            <span>{fmt(pos)}</span>
            <span>{fmt(durationSec)}</span>
          </div>
        </div>

        <CallingDisplay callings={callings} positionSeconds={pos} bpm={bpm} />

        {/* Preview-only controls (not part of the shipped player). */}
        <div className="offline-banner" style={{ marginTop: 16 }}>
          No-auth design preview — drive it below to check colours, the Barlow
          Condensed cues, the ring sweep and the gap overlay.
        </div>
        <div className="install-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="primary" onClick={() => setPlaying((p) => !p)}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <button className="ghost" onClick={jumpToSwitch}>
            Jump to a switch
          </button>
          <button className="ghost" onClick={() => setOverlay('gap')}>
            Gap overlay
          </button>
          <button className="ghost" onClick={() => setOverlay('held')}>
            Held overlay
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={Math.floor(durationSec)}
          step={0.1}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          style={{ width: '100%', marginTop: 12 }}
          aria-label="Scrub preview position"
        />

        {/* Green = "connected / done" success states. These live behind auth on
            the list/settings screens, so they're shown here only as swatches to
            eyeball green-vs-orange on the phone. Real classes, static content. */}
        <p className="muted" style={{ marginTop: 20, marginBottom: 8 }}>
          Success states (green):
        </p>
        <div
          className="install-actions"
          style={{ flexWrap: 'wrap', gap: 8, alignItems: 'center' }}
        >
          <span className="chip chip-active">Tablet · Connected</span>
          <span className="badge rec-loaded" title="Auto-loaded on startup">
            loaded
          </span>
          <button className="track-queue is-queued" aria-pressed="true">
            ✓
          </button>
          <button className="sr-bpm-btn bpm-ok">128 BPM</button>
        </div>
        <p className="ok-note" style={{ marginTop: 8 }}>
          ✓ 30 routines, no issues.
        </p>
      </div>

      {overlay === 'gap' && (
        <div className="overlay">
          <div className="overlay-card">
            <span className="muted">Next track in</span>
            <span className="gap-num">{gapRemaining}</span>
            <button className="add-time" onClick={() => setGapRemaining((r) => r + 5)}>
              +5s
            </button>
            <div className="overlay-actions">
              <button className="ghost" onClick={() => setOverlay('held')}>
                Hold
              </button>
              <button className="primary" onClick={() => setOverlay('none')}>
                Start now
              </button>
            </div>
          </div>
        </div>
      )}

      {overlay === 'held' && (
        <div className="overlay">
          <div className="overlay-card">
            <span className="muted">Paused between tracks</span>
            <button className="primary big" onClick={() => setOverlay('none')}>
              Continue <Play size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
