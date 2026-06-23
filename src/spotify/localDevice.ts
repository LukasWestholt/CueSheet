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

/** True when `deviceName` plausibly names the same device this UA runs on. */
export function isLikelyLocalDevice(
  deviceName: string | null | undefined,
  userAgent: string,
): boolean {
  if (!deviceName) return false;
  const name = deviceName.toLowerCase();
  return deviceHintsFromUserAgent(userAgent).some((h) => name.includes(h.toLowerCase()));
}
