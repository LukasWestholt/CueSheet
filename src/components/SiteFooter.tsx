import { useState } from 'react';
import { REPO_URL, ISSUES_URL, KOFI_URL, GETSONGBPM_URL } from '../links';
import { APP_VERSION } from '../version';
import LegalModal from './LegalModal';
import CookieNotice from './CookieNotice';

// The shared site footer: source/issue/Ko-fi/BPM-credit links, the Impressum &
// privacy link, version, and the "made in Leipzig" line. Used on the landing
// page and under every in-app screen so the GetSongBPM backlink + attribution
// stay visible everywhere. It also hosts the one-time storage notice (rendered
// once, globally) since the footer is the single component present on every
// screen — including the pre-login landing page.
export default function SiteFooter() {
  const [legalOpen, setLegalOpen] = useState(false);
  return (
    <>
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
        <button type="button" className="footer-legal" onClick={() => setLegalOpen(true)}>
          Impressum &amp; privacy
        </button>
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
      <LegalModal open={legalOpen} onClose={() => setLegalOpen(false)} />
      <CookieNotice onLearnMore={() => setLegalOpen(true)} />
    </>
  );
}
