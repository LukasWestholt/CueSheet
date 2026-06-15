import { useEffect, useRef } from 'react';
import { IMPRINT, SPOTIFY_PRIVACY_URL } from '../legal';

// Impressum + privacy page, shown as a native <dialog> modal (showModal gives
// the backdrop, Esc-to-close and focus trapping for free) — same pattern as
// RoutinesManager's ContributeHelp. Opened from the SiteFooter "Impressum" link
// and from the cookie/storage notice's "Details" button.
export default function LegalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  return (
    <dialog ref={ref} className="modal" onClose={onClose}>
      <div className="modal-head">
        <strong>Impressum &amp; privacy</strong>
        <button type="button" className="link" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <div className="legal-body">
        <h3>Impressum</h3>
        <p className="hint">Angaben gemäß § 5 DDG</p>
        <address>
          {IMPRINT.name}
          <br />
          {IMPRINT.street}
          <br />
          {IMPRINT.city}
          <br />
          {IMPRINT.country}
        </address>
        <p>
          <strong>Kontakt</strong>
          <br />
          E-Mail: <a href={`mailto:${IMPRINT.email}`}>{IMPRINT.email}</a>
        </p>
        <p className="hint">
          Verbraucherstreitbeilegung: Wir sind nicht bereit oder verpflichtet, an
          Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>

        <h3>Privacy &amp; storage</h3>
        <p>
          CueSheet has no backend of its own and stores no personal data on a server. It
          runs entirely in your browser and keeps data only in your browser&rsquo;s local
          storage: your Spotify access/refresh tokens (so you stay logged in) and your
          preferences (favorites, setlist, sync offset, tap calibration). This storage is
          strictly necessary for the app to work — there is no tracking, analytics or
          advertising.
        </p>
        <p>
          When you log in and control playback, requests go directly to Spotify under{' '}
          <a href={SPOTIFY_PRIVACY_URL} target="_blank" rel="noreferrer">
            Spotify&rsquo;s privacy policy
          </a>
          . Log out, or clear your browser storage for this site, to remove everything
          CueSheet keeps.
        </p>
      </div>

      <div className="modal-actions">
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}
