// The worker serves the Limner mark at /favicon.ico and /favicon.svg so the
// OAuth/consent pages (and any browser hitting the origin) get a real icon
// instead of a 404. Served before the OAuth gate — it's public, like /artifact.

import { describe, expect, test } from 'vitest';

import { serveFavicon, FAVICON_SVG } from '../src/favicon.js';

describe('serveFavicon', () => {
  test('serves the logo SVG with an svg+xml content type and a cache header', async () => {
    const res = serveFavicon();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/svg+xml');
    expect(res.headers.get('cache-control')).toContain('max-age');
    const body = await res.text();
    expect(body).toContain('<svg');
    expect(body).toBe(FAVICON_SVG);
  });

  test('the embedded mark is the gold-on-teal Limner logo', () => {
    expect(FAVICON_SVG).toContain('rgb(217,166,70)'); // gold letterform
    expect(FAVICON_SVG).toContain('rgb(0,80,98)'); // teal ground
  });
});
