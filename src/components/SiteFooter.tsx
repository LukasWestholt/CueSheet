import { REPO_URL, ISSUES_URL, KOFI_URL, GETSONGBPM_URL } from '../links';
import { APP_VERSION } from '../version';

// The shared site footer: source/issue/Ko-fi/BPM-credit links, version, and the
// "made in Leipzig" line. Used on the landing page and under every in-app screen
// so the GetSongBPM backlink + attribution stay visible everywhere.
export default function SiteFooter() {
  return (
    <footer className="landing-footer">
      <a href={REPO_URL} target="_blank" rel="noreferrer">
        Source code
      </a>
      <a href={ISSUES_URL} target="_blank" rel="noreferrer">
        Report an issue
      </a>
      <a href={KOFI_URL} target="_blank" rel="noreferrer">
        Ko-fi
      </a>
      <a href={GETSONGBPM_URL} target="_blank" rel="noreferrer">
        BPM data: GetSongBPM
      </a>
      <span className="footer-meta">
        <span className="version">CueSheet v{APP_VERSION}</span>
        <span aria-hidden="true">·</span>
        <span>
          Built with{' '}
          <span role="img" aria-label="love">
            ❤️
          </span>{' '}
          in Leipzig, Germany
        </span>
      </span>
    </footer>
  );
}
