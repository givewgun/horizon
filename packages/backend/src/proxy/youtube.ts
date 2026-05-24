/**
 * Resolve the *current* live video id for a YouTube channel by scraping its
 * `/live` page server-side.
 *
 * Why scrape instead of using the embed selector
 * ----------------------------------------------
 * The classic `https://www.youtube.com/embed/live_stream?channel=...` selector
 * is unreliable: it returns "video unavailable" any time the channel's
 * currently live broadcast has `embed=disabled`, or when YouTube can't agree
 * on which video to surface. We've seen NASA visibly live yet the selector
 * blank.
 *
 * Why scrape instead of the Data API
 * ----------------------------------
 * `youtube.googleapis.com/youtube/v3/search?eventType=live&channelId=...`
 * works but needs an API key and consumes 100 quota units per call. For a
 * single-VM portfolio project that's an unnecessary cost + secret.
 *
 * What we look for
 * ----------------
 * `https://www.youtube.com/channel/<CID>/live` serves either:
 *   - the watch page of the current live broadcast (when the channel is
 *     live), with `<link rel="canonical" href="https://www.youtube.com/watch?v=VIDEOID">`
 *     and a `"videoId":"VIDEOID"` token inside the inline JSON, OR
 *   - the channel page itself (when the channel isn't live).
 *
 * We parse defensively (canonical link first, then videoId regex, then
 * og:url) and cache the result for 60s.
 *
 * Limits
 * ------
 * - Scraping HTML is brittle by definition. If YouTube ships a major redesign
 *   we fix this file. The 60s cache keeps the blast radius small if upstream
 *   changes break parsing for a few minutes.
 * - We send a desktop User-Agent and `Cookie: CONSENT=YES+1` so EU GDPR
 *   consent walls don't intercept the page.
 */

import { TtlCache } from './cache.js';
import { UpstreamError } from './http.js';

const TTL_MS = 60_000;

export interface LiveLookup {
  /** YouTube video id of the current live broadcast, or null if the channel is not live. */
  videoId: string | null;
  /** Convenience boolean for the route's JSON payload. */
  isLive: boolean;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function extractVideoId(html: string): string | null {
  // 1) canonical link — present on watch pages only.
  const canonical = html.match(
    /<link\s+rel="canonical"\s+href="https?:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})/i,
  );
  if (canonical) return canonical[1];

  // 2) og:url meta — same story.
  const og = html.match(
    /<meta\s+property="og:url"\s+content="https?:\/\/www\.youtube\.com\/watch\?v=([\w-]{11})/i,
  );
  if (og) return og[1];

  // 3) Inline JSON: look for `"videoId":"XXXXXXXXXXX"` paired with
  //    `"isLiveContent":true`. We accept a videoId only when the page also
  //    advertises live content; otherwise we'd surface a recently-uploaded VOD.
  const looksLive = /"isLive"\s*:\s*true|"isLiveContent"\s*:\s*true/.test(html);
  if (!looksLive) return null;
  const idMatch = html.match(/"videoId"\s*:\s*"([\w-]{11})"/);
  return idMatch ? idMatch[1] : null;
}

export class YouTubeLiveClient {
  private cache = new TtlCache<LiveLookup>(TTL_MS);

  async live(channelId: string): Promise<{ data: LiveLookup; ageMs: number }> {
    if (!/^[A-Za-z0-9_-]{10,40}$/.test(channelId)) {
      throw new UpstreamError('invalid YouTube channel id', 400);
    }
    return this.cache.get(`yt:${channelId}`, async () => {
      const url = `https://www.youtube.com/channel/${channelId}/live`;
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 7000);
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': UA,
            'Accept-Language': 'en-US,en;q=0.9',
            Cookie: 'CONSENT=YES+1',
          },
          redirect: 'follow',
          signal: ac.signal,
        });
        if (!res.ok) {
          throw new UpstreamError(`youtube ${res.status}`, res.status, url);
        }
        const finalUrl = res.url;
        const html = await res.text();
        const idFromUrl = finalUrl.match(/[?&]v=([\w-]{11})/);
        const videoId = idFromUrl ? idFromUrl[1] : extractVideoId(html);
        return { videoId, isLive: !!videoId };
      } finally {
        clearTimeout(timer);
      }
    });
  }

  lastGood(channelId: string): { data: LiveLookup; ageMs: number } | undefined {
    return this.cache.lastGood(`yt:${channelId}`);
  }
}
