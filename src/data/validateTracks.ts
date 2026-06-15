import type { StepCalling, Track } from './tracks';
import { checkRoutineLength, lengthWarning } from './routineLength';

export type IssueLevel = 'error' | 'warning';

export interface ValidationIssue {
  level: IssueLevel;
  /** Human-readable location, e.g. "track #2 (Low)" or "track #2, step 3". */
  where: string;
  message: string;
}

export interface ValidationResult {
  /** True when there are no errors (warnings are allowed). */
  ok: boolean;
  issues: ValidationIssue[];
  trackCount: number;
}

const URI_RE = /^spotify:track:[A-Za-z0-9]{22}$/;

/**
 * Validates arbitrary data (e.g. imported JSON) as a `Track[]`. Errors block an
 * import; warnings are advisory. Checks structure (types, required fields) and
 * semantics (positive measures, sane BPM/first-beat, duplicate ids/URIs).
 */
export function validateTracks(data: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const add = (level: IssueLevel, where: string, message: string) =>
    issues.push({ level, where, message });

  if (!Array.isArray(data)) {
    add('error', 'root', 'Expected a JSON array of tracks.');
    return { ok: false, issues, trackCount: 0 };
  }

  const idCounts = new Map<string, number>();
  const uriCounts = new Map<string, number>();

  data.forEach((raw, i) => {
    if (typeof raw !== 'object' || raw === null) {
      add('error', `track #${i + 1}`, 'Not an object.');
      return;
    }
    const t = raw as Record<string, unknown>;
    const name = typeof t.title === 'string' ? t.title : typeof t.id === 'string' ? t.id : '';
    const where = `track #${i + 1}${name ? ` (${name})` : ''}`;

    if (typeof t.id !== 'string' || !t.id) add('error', where, 'Missing string "id".');
    else idCounts.set(t.id, (idCounts.get(t.id) ?? 0) + 1);

    if (typeof t.spotifyUri !== 'string' || !t.spotifyUri) {
      add('error', where, 'Missing "spotifyUri".');
    } else {
      if (!URI_RE.test(t.spotifyUri)) {
        add('warning', where, `"${t.spotifyUri}" is not a spotify:track:<22-char id> URI.`);
      }
      uriCounts.set(t.spotifyUri, (uriCounts.get(t.spotifyUri) ?? 0) + 1);
    }

    if (!Array.isArray(t.steps) || t.steps.length === 0) {
      add('error', where, 'Needs a non-empty "steps" array.');
    } else {
      t.steps.forEach((s, si) => {
        const sWhere = `${where}, step ${si + 1}`;
        if (typeof s !== 'object' || s === null) {
          add('error', sWhere, 'Step is not an object.');
          return;
        }
        const step = s as Record<string, unknown>;
        if (typeof step.step !== 'string' || !step.step.trim()) {
          add('error', sWhere, 'Missing step name.');
        }
        if (typeof step.measures !== 'number' || !(step.measures > 0)) {
          add('error', sWhere, `"measures" must be a positive number (got ${JSON.stringify(step.measures)}).`);
        } else if (Math.abs(step.measures * 2 - Math.round(step.measures * 2)) > 1e-9) {
          add('warning', sWhere, `"measures" ${step.measures} is not a multiple of 0.5.`);
        }
        if (step.cue != null && typeof step.cue !== 'string') {
          add('error', sWhere, '"cue" must be a string.');
        }
      });
    }

    if (t.bpm != null) {
      if (typeof t.bpm !== 'number' || t.bpm <= 0) add('error', where, '"bpm" must be a positive number.');
      else if (t.bpm < 40 || t.bpm > 220) add('warning', where, `"bpm" ${t.bpm} is outside the usual 40–220 range.`);
    }
    if (t.firstBeatSec != null && (typeof t.firstBeatSec !== 'number' || t.firstBeatSec < 0)) {
      add('error', where, '"firstBeatSec" must be a number ≥ 0.');
    }
    if (t.durationMs != null && (typeof t.durationMs !== 'number' || t.durationMs <= 0)) {
      add('error', where, '"durationMs" must be a positive number.');
    }
    if (t.title != null && typeof t.title !== 'string') add('error', where, '"title" must be a string.');
    if (t.artist != null && typeof t.artist !== 'string') add('error', where, '"artist" must be a string.');
    if (t.wip != null && typeof t.wip !== 'boolean') add('error', where, '"wip" must be a boolean.');

    // Routine-vs-track length: only when both BPM and duration are authored and
    // every step has a valid measure (so we don't pile on top of step errors).
    const cleanSteps =
      Array.isArray(t.steps) &&
      t.steps.length > 0 &&
      t.steps.every((s) => typeof (s as Record<string, unknown>)?.measures === 'number' && (s as { measures: number }).measures > 0);
    if (typeof t.bpm === 'number' && t.bpm > 0 && typeof t.durationMs === 'number' && t.durationMs > 0 && cleanSteps) {
      const firstBeat = typeof t.firstBeatSec === 'number' ? t.firstBeatSec : 0;
      const warn = lengthWarning(
        checkRoutineLength(t.steps as StepCalling[], firstBeat, t.bpm, t.durationMs),
      );
      if (warn && t.wip !== true) add('warning', where, warn);
    }
  });

  for (const [id, n] of idCounts) {
    if (n > 1) add('error', `id "${id}"`, `Duplicate id used by ${n} tracks (ids must be unique).`);
  }
  for (const [uri, n] of uriCounts) {
    if (n > 1) {
      add('warning', `uri "${uri}"`, `${n} tracks share this Spotify URI (fine if intentional — e.g. two routines for one song).`);
    }
  }

  return {
    ok: !issues.some((x) => x.level === 'error'),
    issues,
    trackCount: data.length,
  };
}

/** Convenience: imported data narrowed to Track[] when valid. */
export function parseTracks(data: unknown): { tracks: Track[]; result: ValidationResult } | { tracks: null; result: ValidationResult } {
  const result = validateTracks(data);
  return result.ok ? { tracks: data as Track[], result } : { tracks: null, result };
}
