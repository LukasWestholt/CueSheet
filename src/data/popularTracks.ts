// A hard-coded palette of popular high-energy tracks shown as quick-pick
// suggestions in the editor's search box when it's empty — so a coach can start
// a routine instantly, even offline (no Spotify search call needed).
//
// Curated for jumping/trampoline fitness (energetic pop/EDM, ~115–155 BPM) and
// resolved to real Spotify track IDs via the spotify-search skill. BPMs are
// commonly-cited approximations — a sensible starting point the coach can re-tap
// and override per track. Extend or reorder to taste.

export interface PopularTrack {
  uri: string;
  title: string;
  artist: string;
  bpm?: number;
}

export const POPULAR_TRACKS: PopularTrack[] = [
  { uri: 'spotify:track:0t2w4jQazlBggyZS4axpnw', title: 'Low', artist: 'Flo Rida', bpm: 128 },
  { uri: 'spotify:track:7DnAm9FOTWE3cUvso43HhI', title: 'Sweet but Psycho', artist: 'Ava Max', bpm: 133 },
  { uri: 'spotify:track:2ThsBNtjuUEERqcpXQEoYR', title: "Don't Start Now", artist: 'Dua Lipa', bpm: 124 },
  { uri: 'spotify:track:33rh7azo556EGptA220qxT', title: 'Physical', artist: 'Dua Lipa', bpm: 147 },
  { uri: 'spotify:track:0TDLuuLlV54CkRRUOahJb4', title: 'Titanium', artist: 'David Guetta, Sia', bpm: 126 },
  { uri: 'spotify:track:0A9mHc7oYUoCECqByV8cQR', title: 'Animals', artist: 'Martin Garrix', bpm: 128 },
  { uri: 'spotify:track:5UqCQaDshqbIk3pkhy4Pjg', title: 'Levels', artist: 'Avicii', bpm: 126 },
  { uri: 'spotify:track:0nrRP2bk19rLc0orkWPQk2', title: 'Wake Me Up', artist: 'Avicii', bpm: 124 },
  { uri: 'spotify:track:0U10zFw4GlBacOy9VDGfGL', title: 'We Found Love', artist: 'Rihanna, Calvin Harris', bpm: 128 },
  { uri: 'spotify:track:3cHyrEgdyYRjgJKSOiOtcS', title: 'Timber', artist: 'Pitbull, Kesha', bpm: 130 },
  { uri: 'spotify:track:4zPVMv84MMHehLNZYIS1Zv', title: 'Barbie Girl (Tiësto Remix)', artist: 'Aqua, Tiësto', bpm: 130 },
  { uri: 'spotify:track:0pqnGHJpmpxLKifKRmU6WP', title: 'Believer', artist: 'Imagine Dragons', bpm: 125 },
  { uri: 'spotify:track:3C0nOe05EIt1390bVABLyN', title: 'On The Floor', artist: 'Jennifer Lopez, Pitbull', bpm: 130 },
  { uri: 'spotify:track:2ygMBIctKIAfbEBcT9065L', title: 'Pump It', artist: 'Black Eyed Peas', bpm: 154 },
  { uri: 'spotify:track:32OlwWuMpZ6b0aN2RZOeMS', title: 'Uptown Funk', artist: 'Mark Ronson, Bruno Mars', bpm: 115 },
  { uri: 'spotify:track:6JV2JOEocMgcZxYSZelKcc', title: "CAN'T STOP THE FEELING!", artist: 'Justin Timberlake', bpm: 113 },
  { uri: 'spotify:track:67awxiNHNyjMXhVgsHuIrs', title: 'Turn Down for What', artist: 'DJ Snake, Lil Jon', bpm: 100 },
  { uri: 'spotify:track:5QDLhrAOJJdNAmCTJ8xMyW', title: 'Dynamite', artist: 'BTS', bpm: 114 },
  { uri: 'spotify:track:3CeCwYWvdfXbZLXFhBrbnf', title: 'Love Story', artist: 'Taylor Swift', bpm: 119 },
  { uri: 'spotify:track:63Tl9k1sH8tznn3bqoMuyF', title: 'Waka Waka (This Time for Africa)', artist: 'Shakira', bpm: 127 },
];
