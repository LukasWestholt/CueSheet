import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { Track } from '../data/tracks';
import type { PlayerEngine, Phase } from '../hooks/usePlayerEngine';
import type { ResolvedMeta } from '../data/meta';

// The overlays we want to test are driven purely by the engine's phase, so we
// mock the hooks PlayerScreen depends on and feed it a controlled engine. This
// also keeps the Spotify network modules (pulled in by the real hooks) out of
// the test entirely.
const state = vi.hoisted(() => ({ engine: null as unknown as PlayerEngine }));

vi.mock('../hooks/usePlayerEngine', () => ({
  usePlayerEngine: () => state.engine,
}));
vi.mock('../hooks/useWakeLock', () => ({ useWakeLock: () => {} }));
vi.mock('../hooks/useCalibration', () => ({
  useCalibration: () => ({ cal: null, update: vi.fn(), clear: vi.fn() }),
}));
const meta: ResolvedMeta = {
  title: 'Test Track',
  artist: 'Tester',
  durationMs: 60_000,
  bpm: null,
  firstBeatSec: 0,
  imageUrl: null,
};
vi.mock('../hooks/useTrackMeta', () => ({ useTrackMeta: () => meta }));

import PlayerScreen from './PlayerScreen';

const track: Track = {
  id: 'a',
  spotifyUri: 'spotify:track:a',
  steps: [{ step: 'Jumping Jacks', measures: 1 }],
};

/** A fully-populated engine with every method stubbed; override per test. */
function makeEngine(overrides: Partial<PlayerEngine> = {}): PlayerEngine {
  return {
    index: 0,
    track,
    phase: 'playing' as Phase,
    positionMs: 1_000,
    durationMs: 60_000,
    gapRemaining: 0,
    autoContinue: true,
    deviceName: 'Tablet',
    keepAwake: false,
    noDevice: false,
    hijacked: false,
    error: null,
    start: vi.fn(),
    attach: vi.fn(),
    select: vi.fn(),
    togglePlayPause: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    seekTo: vi.fn(),
    skipGap: vi.fn(),
    extendGap: vi.fn(),
    holdNow: vi.fn(),
    setAutoContinue: vi.fn(),
    recover: vi.fn(),
    ...overrides,
  };
}

function renderPlayer(props: Partial<ComponentProps<typeof PlayerScreen>> = {}) {
  return render(
    <PlayerScreen
      tracks={[track]}
      startIndex={0}
      deviceId="d"
      onBack={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  // jsdom's localStorage isn't available on an opaque origin; stub the bits
  // PlayerScreen reads (the sync-offset persistence).
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  state.engine = makeEngine();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PlayerScreen gap overlay', () => {
  it('shows the countdown and actions while in the gap phase', () => {
    state.engine = makeEngine({ phase: 'gap', gapRemaining: 12 });
    const { container } = renderPlayer();
    expect(container.querySelector('.overlay')).not.toBeNull();
    expect(screen.getByText('Next track in')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('+5s')).toBeTruthy();
    expect(screen.getByText('Start now')).toBeTruthy();
  });

  it('wires the gap buttons to the engine', () => {
    state.engine = makeEngine({ phase: 'gap', gapRemaining: 8 });
    renderPlayer();

    fireEvent.click(screen.getByText('+5s'));
    expect(state.engine.extendGap).toHaveBeenCalledWith(5);

    fireEvent.click(screen.getByText('Start now'));
    expect(state.engine.skipGap).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Hold'));
    expect(state.engine.holdNow).toHaveBeenCalledTimes(1);
  });
});

describe('PlayerScreen held overlay', () => {
  it('shows the paused-between-tracks card while held', () => {
    state.engine = makeEngine({ phase: 'held' });
    const { container } = renderPlayer();
    expect(container.querySelector('.overlay')).not.toBeNull();
    expect(screen.getByText('Paused between tracks')).toBeTruthy();
    expect(screen.getByText('Continue')).toBeTruthy();
  });

  it('continues via the engine and aborts back to the list', () => {
    const onBack = vi.fn();
    state.engine = makeEngine({ phase: 'held' });
    renderPlayer({ onBack });

    fireEvent.click(screen.getByText('Continue'));
    expect(state.engine.skipGap).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('End session · back to list'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('PlayerScreen overlay absence', () => {
  it('renders no overlay during normal playback', () => {
    state.engine = makeEngine({ phase: 'playing' });
    const { container } = renderPlayer();
    expect(container.querySelector('.overlay')).toBeNull();
    expect(screen.queryByText('Next track in')).toBeNull();
    expect(screen.queryByText('Paused between tracks')).toBeNull();
  });
});
