// A small, hard-coded palette of popular jumping-fitness tracks shown as
// quick-pick suggestions in the editor's search box when it's empty — so a coach
// can start a routine instantly, even offline (no Spotify search call needed).
//
// These need REAL Spotify track URIs to be useful (Share → Copy Spotify URI in
// the Spotify app). Seeded with the verified tracks already in the repo; extend
// it toward the ~20 staples you reach for most. Keep BPM only when you're sure.

export interface PopularTrack {
  uri: string;
  title: string;
  artist: string;
  bpm?: number;
}

export const POPULAR_TRACKS: PopularTrack[] = [
  { uri: 'spotify:track:0t2w4jQazlBggyZS4axpnw', title: 'Low', artist: 'Flo Rida', bpm: 128 },
  { uri: 'spotify:track:3CeCwYWvdfXbZLXFhBrbnf', title: 'Love Story', artist: 'Taylor Swift', bpm: 119 },
  { uri: 'spotify:track:4zPVMv84MMHehLNZYIS1Zv', title: 'Barbie Girl (Tiësto Remix)', artist: 'Aqua, Tiësto', bpm: 130 },
];
