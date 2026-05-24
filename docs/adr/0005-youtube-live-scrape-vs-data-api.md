# ADR-0005 — Scrape YouTube `/channel/<CID>/live` instead of using Data API v3

- **Status:** Accepted
- **Date:** 2026-05-24 (Phase 1 boundary)

## Context

The Live panel needs to embed the current live broadcast of several YouTube
channels (NASA, NSF, SpaceX, ESA, …). Two ways exist to find that broadcast:

1. **`youtube.com/embed/live_stream?channel=<CID>`** — official "let YouTube
   pick the current live" selector. We tried this first. It silently breaks
   any time the channel's current live has `embed=disabled`, returning
   "video unavailable" inside the iframe even when the channel is visibly
   live elsewhere. We can't introspect the iframe cross-origin, so the user
   just sees a black box.
2. **`youtube.googleapis.com/youtube/v3/search?eventType=live&channelId=...`**
   — official Data API. Requires an API key, costs 100 quota units per call
   (so single-VM defaults rate-limit fast), and is a new secret to manage.

For a free-tier portfolio project where the panel is "nice to have, not
load-bearing", neither option is acceptable.

## Decision

Backend `proxy/youtube.ts` ships `YouTubeLiveClient.live(channelId)` that
fetches `https://www.youtube.com/channel/<CID>/live` with a desktop
User-Agent and the `CONSENT=YES+1` cookie (to bypass the EU GDPR consent
wall) and extracts the current live videoId by, in order:

1. The redirect URL's `?v=...` parameter (when YouTube 302s straight to the
   watch page).
2. `<link rel="canonical" href="https://www.youtube.com/watch?v=...">` in
   the HTML.
3. `<meta property="og:url" content="https://www.youtube.com/watch?v=...">`.
4. Inline JSON `"videoId":"..."` gated on `"isLive":true` /
   `"isLiveContent":true` (so we never surface a recent VOD instead).

The lookup is cached for 60 s and surfaced as
`GET /api/live/youtube/:channelId → { videoId, isLive }`. The frontend
embeds `https://www.youtube.com/embed/<videoId>?autoplay=1` directly. When
`videoId === null`, the tab renders a "not live right now" card with a
channel link instead of a broken iframe.

## Consequences

- No API key, no quota worries, no new secret.
- Lookups stay server-side, so we never expose any private upstream details
  to the SPA bundle.
- Embedding `/embed/<videoId>` works whenever the broadcast permits it. When
  the uploader has individually disabled embedding for that live we still
  fall back to a "watch on YouTube" link — that's an upload-time choice we
  can't override.
- The parser is **brittle by design**: a YouTube HTML redesign will break
  videoId extraction. The 60 s TTL bounds the blast radius, and the file
  has four progressively-laxer extraction strategies so a single one
  changing isn't fatal.

## Alternatives considered

- **Data API v3.** Works but adds a secret + quota cap; rejected.
- **`live_stream?channel=…` selector.** Already tried; rejected for the
  "video unavailable" silent-failure mode.
- **Manual videoId per channel.** Would need an operator to update IDs at
  every campaign. Wrong shape for a portfolio app.
