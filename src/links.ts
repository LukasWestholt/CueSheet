// External links surfaced in the UI (landing page footer, etc.).
export const REPO_URL = 'https://github.com/LukasWestholt/CueSheet';
export const ISSUES_URL = `${REPO_URL}/issues`;
export const KOFI_URL = 'https://ko-fi.com/lukaswestholt';

// GetSongBPM requires a visible backlink when its API is used (see
// src/beatdata/getsongbpm.ts). Shown in the footer only when a key is set.
export const GETSONGBPM_URL = 'https://getsongbpm.com';
export const GETSONGBPM_ENABLED = (import.meta.env.VITE_GETSONGBPM_API_KEY ?? '').length > 0;
