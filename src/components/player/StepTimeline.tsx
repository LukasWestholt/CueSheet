import { useEffect, useMemo, useRef } from 'react';
import type { Calling, StepCalling } from '../../data/tracks';
import type { Phase } from '../../hooks/usePlayerEngine';
import { beatsForStep } from '../../data/beats';
import { formatClock } from '../../data/time';
import { assignSections } from '../../data/sections';

/**
 * Coach view: the full prepared order of steps. Highlights the active row, keeps
 * it centered in the scroll area, and seeks when a row is tapped. `onSeek`
 * receives the step's start time in seconds (the caller applies the sync offset).
 */
export default function StepTimeline({
  callings,
  steps,
  activeRow,
  phase,
  onSeek,
}: {
  callings: Calling[];
  steps: StepCalling[];
  activeRow: number;
  phase: Phase;
  onSeek: (timeSeconds: number) => void;
}) {
  const stepListRef = useRef<HTMLOListElement | null>(null);
  const activeRowRef = useRef<HTMLLIElement | null>(null);
  useEffect(() => {
    const li = activeRowRef.current;
    const ol = stepListRef.current;
    if (!li || !ol) return;
    const target = li.offsetTop - (ol.clientHeight - li.offsetHeight) / 2;
    ol.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
  }, [activeRow]);

  // Also seekable between tracks (gap/held/ended): the engine restarts the
  // displayed track at the tapped step. Only idle (quiet detail view, user
  // hasn't pressed Play) and loading stay non-seekable.
  const seekable = phase !== 'idle' && phase !== 'loading';

  // Cues double as section labels ("intro"/"chorus"/…): equal cues share a
  // colour so the song's structure shows in the row edge.
  const sections = useMemo(() => assignSections(callings.map((c) => c.cue)), [callings]);

  return (
    <section className="timeline">
      <h3>Prepared steps</h3>
      <ol ref={stepListRef}>
        {callings.map((c, i) => (
          <li key={i} ref={i === activeRow ? activeRowRef : null}>
            <button
              type="button"
              className={`row-jump${i === activeRow ? ' row-active' : ''}${
                sections[i] != null ? ` section-${sections[i]}` : ''
              }`}
              onClick={() => onSeek(c.time)}
              disabled={!seekable}
            >
              <span className="row-time">
                <span className="row-secs">{formatClock(c.time * 1000)}</span>
                <span className="row-beats">{beatsForStep(steps[i]?.measures ?? 0)} beats</span>
              </span>
              <span className="row-step">{c.step}</span>
              {c.cue && <span className="row-cue">{c.cue}</span>}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
