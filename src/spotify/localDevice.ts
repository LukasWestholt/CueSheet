// Heuristic: is a given Spotify Connect device most likely the *same physical
// device* the app is running on? A browser can't read its own OS device name,
// so we derive hints from the user agent and look for them in the Spotify
// device name. This is best-effort by design (the keep-awake ping only fires
// when it's reasonably sure it's our own device).

/**
 * Name fragments a Spotify device on THIS machine would likely contain, derived
 * from the user agent:
 *  - Android embeds the model in the UA ("…; Android 13; Pixel 7)") — usually
 *    the default Spotify device name too. We emit the full model and its first
 *    token ("Pixel 7" + "Pixel").
 *  - iOS only exposes "iPhone"/"iPad" (no model), which Spotify names usually
 *    include ("Lukas's iPhone").
 * Returns [] when nothing usable can be derived — e.g. a desktop whose Spotify
 * name is its hostname, or a privacy-frozen Android UA reporting the model as
 * "K".
 */
export function deviceHintsFromUserAgent(ua: string): string[] {
  const hints: string[] = [];
  const android = /Android[^;]*;\s*([^;)]+?)(?:\s+Build\/|\)|;)/i.exec(ua);
  if (android) {
    const model = android[1].trim();
    const frozen = /^(android|wv|k)$/i.test(model); // bare/webview/privacy-frozen
    if (model.length >= 2 && !frozen) {
      hints.push(model);
      const first = model.split(/\s+/)[0];
      if (first.length >= 2 && first.toLowerCase() !== model.toLowerCase()) hints.push(first);
    }
  }
  if (/\biPhone\b/i.test(ua)) hints.push('iPhone');
  if (/\biPad\b/i.test(ua)) hints.push('iPad');
  return hints;
}

/**
 * Spotify device `type` values that plausibly correspond to the platform this
 * UA runs on. Used as a *secondary* signal — `type` isn't unique (an account
 * can have several smartphones), so it only helps when the name gives nothing
 * (e.g. a privacy-frozen Android UA reporting the model as "K"). Returns [] for
 * a platform Spotify wouldn't map cleanly.
 */
export function deviceTypesFromUserAgent(ua: string): string[] {
  if (/\bAndroid\b/i.test(ua)) return /\bMobile\b/i.test(ua) ? ['Smartphone'] : ['Tablet', 'Smartphone'];
  if (/\biPhone\b/i.test(ua)) return ['Smartphone'];
  if (/\biPad\b/i.test(ua)) return ['Tablet'];
  if (/\b(Macintosh|Mac OS X|Windows|Linux|CrOS)\b/i.test(ua)) return ['Computer'];
  return [];
}

/**
 * True when a Spotify device plausibly *is* the machine this UA runs on. The
 * name is the strong signal (`deviceHintsFromUserAgent`); the device `type` is
 * a secondary fallback for when the name yields no hint. Pass `deviceType` as
 * null/undefined to match on name only.
 */
export function isLikelyLocalDevice(
  deviceName: string | null | undefined,
  deviceType: string | null | undefined,
  userAgent: string,
): boolean {
  const name = deviceName?.toLowerCase();
  const nameMatch =
    name != null &&
    deviceHintsFromUserAgent(userAgent).some((h) => name.includes(h.toLowerCase()));
  if (nameMatch) return true;
  if (!deviceType) return false;
  return deviceTypesFromUserAgent(userAgent).some(
    (t) => t.toLowerCase() === deviceType.toLowerCase(),
  );
}
