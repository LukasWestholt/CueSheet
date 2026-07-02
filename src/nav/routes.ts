// Tiny URL routing without a router library. The app is otherwise state-driven;
// these helpers map between window.location.pathname and the views that deserve
// their own address (the per-track detail/player page) so links are shareable
// and the browser back button works.
//
// Everything is base-path aware: on a sub-path deploy (e.g. GitHub Pages at
// /CueSheet/) callers pass import.meta.env.BASE_URL so paths resolve correctly.

export type Route =
  | { name: 'list' }
  | { name: 'callback' }
  | { name: 'track'; id: string }
  /** A setlist session: ids from a shared '/session/a,b,c' link, or empty for
      the bare '/session' (= the coach's own saved setlist, e.g. a PWA shortcut). */
  | { name: 'session'; ids: string[] };

/** Removes the deploy base prefix, yielding a root-relative path ('/...'). */
function stripBase(pathname: string, base: string): string {
  if (!base || base === '/') return pathname;
  const b = base.replace(/\/$/, ''); // '/CueSheet/' -> '/CueSheet'
  if (pathname === b) return '/';
  if (pathname.startsWith(`${b}/`)) return pathname.slice(b.length);
  return pathname;
}

/** Derives the route from a pathname. Unknown paths fall back to the list. */
export function parsePath(pathname: string, base = '/'): Route {
  const p = stripBase(pathname, base);
  if (p === '/callback') return { name: 'callback' };
  const m = p.match(/^\/track\/([^/]+)\/?$/);
  if (m) return { name: 'track', id: decodeURIComponent(m[1]) };
  const s = p.match(/^\/session(?:\/([^/]+))?\/?$/);
  if (s) {
    return {
      name: 'session',
      ids: s[1] ? s[1].split(',').filter(Boolean).map(decodeURIComponent) : [],
    };
  }
  return { name: 'list' };
}

/** Path for a track's detail page, e.g. '/CueSheet/track/main-1' under a base. */
export function trackPath(id: string, base = '/'): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  return `${b}track/${encodeURIComponent(id)}`;
}

/**
 * Path for a setlist session, e.g. '/session/a,b,c' — an ordered id list, so a
 * whole class plan is shareable with any coach who has the same routine
 * sources. Empty ids → the bare '/session' (the saved setlist).
 */
export function sessionPath(ids: string[], base = '/'): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  const list = ids.map(encodeURIComponent).join(',');
  return `${b}session${list ? `/${list}` : ''}`;
}

/** The list/home path for the given base. */
export function listPath(base = '/'): string {
  return base.endsWith('/') ? base : `${base}/`;
}
