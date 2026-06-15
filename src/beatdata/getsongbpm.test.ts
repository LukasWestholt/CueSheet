import { describe, it, expect, vi, afterEach } from 'vitest';
import { testGetsongbpmKey } from './getsongbpm';

// Builds a minimal fetch Response stand-in. `testGetsongbpmKey` only reads
// `.ok`, `.status` and `.text()`, so we don't need a full Response.
function mockResponse(status: number, body: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  } as Response;
}

describe('testGetsongbpmKey', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects an empty key without hitting the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await testGetsongbpmKey('   ');

    expect(result).toEqual({ ok: false, reason: 'Enter a key first.' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('calls the official getsong.co host with the api_key param', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(mockResponse(200, '{"search":[{"id":"x","tempo":"120"}]}'));
    vi.stubGlobal('fetch', fetchSpy);

    await testGetsongbpmKey('mykey');

    const url = fetchSpy.mock.calls[0][0] as string;
    expect(url).toContain('https://api.getsong.co/search/');
    expect(url).toContain('api_key=mykey');
  });

  it('returns ok for a valid key (200 with a search array)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse(200, '{"search":[{"id":"x","tempo":"120"}]}')),
    );

    expect(await testGetsongbpmKey('goodkey')).toEqual({ ok: true });
  });

  it('surfaces the API error message for an invalid/inactive key (HTTP 401, JSON)', async () => {
    // The real backend mislabels this JSON body as text/html — we parse anyway.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse(401, '{"error":"Invalid API Key, or inactive."}')),
    );

    expect(await testGetsongbpmKey('badkey')).toEqual({
      ok: false,
      reason: 'Invalid API Key, or inactive.',
    });
  });

  it('reports a bot/connectivity block when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockResponse(403, '<!DOCTYPE html><html>Just a moment…</html>')),
    );

    expect(await testGetsongbpmKey('anykey')).toEqual({
      ok: false,
      reason:
        'Could not reach the GetSongBPM API (blocked or unavailable). Try again from the app on your device.',
    });
  });

  it('reports a network error when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    expect(await testGetsongbpmKey('anykey')).toEqual({
      ok: false,
      reason: 'Network error — check your connection.',
    });
  });
});
