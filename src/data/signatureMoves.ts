import type { StepCalling } from './tracks';

/**
 * The signature moves of jumping fitness. A move name that contains one of
 * these words counts as that signature (so "Stomping Scissors Double" is both
 * Stomp and Scissors). The order doubles as the tie-break priority when a
 * track spends equal time on two signatures.
 */
export const SIGNATURE_MOVES = ['Scissors', 'Kick', 'Stomp', 'Rebound', 'Pony', 'Side to side'] as const;
export type SignatureMove = (typeof SIGNATURE_MOVES)[number];

// Case-, punctuation- and whitespace-insensitive: "Side-to-Side" and
// "side  to side" both match "Side to side"; "Stomping" matches "Stomp".
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const NEEDLES = SIGNATURE_MOVES.map((label) => ({ label, needle: normalize(label) }));

/** All signature moves whose word(s) appear in the given move name. */
export function signaturesOf(stepName: string): SignatureMove[] {
  const hay = normalize(stepName);
  if (!hay) return [];
  return NEEDLES.filter(({ needle }) => hay.includes(needle)).map(({ label }) => label);
}

export function isSignatureMove(stepName: string): boolean {
  return signaturesOf(stepName).length > 0;
}

/**
 * The track's most important signature move: the one covering the most
 * measures across the routine (a step naming two signatures credits both).
 * Null when no step is a signature move.
 */
export function primarySignature(steps: StepCalling[]): SignatureMove | null {
  const weights = new Map<SignatureMove, number>();
  for (const s of steps) {
    for (const sig of signaturesOf(s.step)) {
      weights.set(sig, (weights.get(sig) ?? 0) + s.measures);
    }
  }
  let best: SignatureMove | null = null;
  let bestWeight = 0;
  for (const label of SIGNATURE_MOVES) {
    const w = weights.get(label) ?? 0;
    if (w > bestWeight) {
      best = label;
      bestWeight = w;
    }
  }
  return best;
}
