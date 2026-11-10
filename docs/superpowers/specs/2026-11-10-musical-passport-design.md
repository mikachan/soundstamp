# Soundstamp — Design

Date: 2026-11-10
Status: Draft, awaiting approval

## Intent

Soundstamp (working title was "Musical Passport") turns someone's last.fm listening history into a passport: a world map of where their music comes from, a stamp for every country they've "visited", and a suggestion for somewhere new to go.

The why: Sarah loves discovering new music but doesn't want discovery to always come from Spotify's algorithm. last.fm is her preferred tool, and this builds on it. Success means it's useful to her from day one, fun enough that people share their passport link, and unique enough to be worth buying a domain for.

A second idea, "taste pen pals" (matching people by listening taste), is parked. last.fm's terms say not to use their data "to identify or contact any user", so Sarah will ask last.fm whether opt-in matching is allowed before any work starts. If it goes ahead it will be a separate, unlinked site that reuses this project's last.fm code.

## Goals

- Type in a last.fm username and get a passport. No login.
- A map-first main page (layout "A", chosen from mockups):
  1. **ID strip** at the top: passport photo (see the image constraint below), username, country count, continent count, and the year they joined last.fm.
  2. **World map** as the centrepiece. Countries you've listened to are filled in, and the colour gets stronger the more you've listened.
  3. **Stamps** below the map, one per country, showing that country's top artists from your listening. Tapping a stamp shows your top tracks from that country.
  4. **Next destination:** a country you've never listened to, with an artist from there who sounds close to your taste.
- Every passport has its own shareable URL, `/<username>`. It's rendered on the server so link previews show the username and stats.
- The first load shows clear progress ("stamping your passport…") while artist countries are looked up. It never looks frozen.

## Non-goals (v1)

- last.fm login/OAuth. Only public data is read by username.
- Any Spotify or other streaming-service data or integration.
- Taste pen pals, or any link between the two projects.
- WordPress. This is a standalone app.
- The "passport book" and "travel log" layouts (B and C). Either could become a secondary view later.
- Generated map images for social link previews. Text metadata is enough for v1.
- **"First listened" dates on stamps (Sarah's decision: deferred).** last.fm has no first-listen date, so it needs a walk through weekly charts. A per-country "first visited" date is the likely v2 version.
- **Travel guide (Sarah's decision: v2).** Next destination grows into several unvisited countries, each with a few artists close to your taste. v1 shows a single next destination, but its ranking code should return a ranked list so v2 can show more without a rewrite.

## Anti-goals (failure even if it technically works)

- **It feels like a copy of a last.fm profile.** Top tracks and top artists support the stamps. They never become the main event.
- **Suggestions come from a streaming algorithm.** Next destination must be built from last.fm's similar-artist data plus MusicBrainz, nothing else.
- **A slow first load with no feedback.**
- **Silently wrong data.** Artists without a known country are counted and shown, not hidden or guessed.
- Ads, tracking, or selling data.

## Decided by Sarah

- Standalone app built with **SvelteKit**.
- Hosting on **Netlify's free tier** using the official `@sveltejs/adapter-netlify` (server routes run as Netlify Functions).
- Storage in **Netlify Blobs**. Postgres (Netlify Database) is only worth revisiting for pen pals.
- Map-first layout A, and the content of each section as listed under Goals.
- Files live in `~/Source/Personal/musical-passport`.

## Constraints

- **The MusicBrainz rate limit is about 1 request per second per client**, with a meaningful `User-Agent` that includes contact details. A user with a few hundred artists therefore takes minutes on first load. This shapes the whole data flow below.
- **Netlify function time limits:** each request has to finish within a few seconds, so lookups happen in small batches over many requests.
- **Netlify free credits:** 300 credits, and each production deploy costs 15, which allows about 20 production deploys. Develop locally with `netlify dev` and deploy in batches.
- **last.fm API terms** (https://www.last.fm/api/tos, checked 2026-11-10; not legal advice):
  - The API is free for **non-commercial use only** (cl. 3.1). No ads and no paid tier. Ask partners@last.fm before adding donations.
  - **Attribution:** show the "powered by AudioScrobbler" badge linking to last.fm. Passport pages link to the user's last.fm profile, and artist and track names link to their last.fm pages (cl. 2.7, 4.2.2).
  - **Approval:** public pages using the API need last.fm's prior approval (cl. 2.7). Using last.fm trademarks, including in the domain name, needs written approval (cl. 7.1). The domain must therefore not contain "last.fm" or "lastfm". Email partners@last.fm describing the site before launch.
  - **Images:** clause 5.1.8 excludes using last.fm images and artwork. Until last.fm confirms avatars are OK, the ID strip uses a generated passport "photo" (for example the user's initials in a stamp-style frame) instead of the last.fm avatar. If last.fm approves, swap the real avatar in.
  - **Storage:** keep stored last.fm data under the 100 MB "Reasonable Usage Cap" (cl. 4.3.4). Respect the cache headers in API responses. Passports therefore expire, and old ones get deleted.
  - The API key stays on the server.
- **MusicBrainz:**
  - Core data, including artist country and area, is CC0. Credit MusicBrainz in the footer anyway.
  - The API is free. Stay at about 1 request per second per IP, and send a `User-Agent` like `Soundstamp/0.1 ( <contact url> )`, otherwise requests get throttled.
- **Libraries and map data:** `d3-geo` and `world-atlas` use permissive licences (ISC), and world-atlas is built on Natural Earth data, which is public domain.

## How it works (Claude's proposed design; the builder may refine it)

### Data sources

- **last.fm API** (server only):
  - `user.getInfo` for the avatar, registration date and total scrobbles.
  - `user.getTopArtists` (period `overall`) for artists, play counts and MusicBrainz IDs.
  - `user.getTopTracks` for per-country track lists.
  - `artist.getSimilar` for next destination.
- **MusicBrainz API:** artist lookup by MBID gives a `country` (ISO 3166-1 alpha-2). When that's missing, fall back to resolving the artist's `area` up to its country. Artists with no MBID from last.fm are looked up with a name search, and only very-high-confidence matches are accepted. Anything else counts as unknown.

### Storage (Netlify Blobs)

- `artists` store: key is the MBID (or a normalised name when there's no MBID). The value is the country code, or "unknown", plus a lookup timestamp. This store is shared by every user, so popular artists only get looked up once.
- `passports` store: one assembled passport per username. It's refreshed when older than about 24 hours, or when the user presses a refresh button.

### First-load flow

1. `/<username>` loads. The server fetches last.fm data and checks which artists already have a stored country.
2. If everything's known, the full passport renders immediately.
3. If not, the page renders the ID strip and a partial map, then repeatedly calls a "stamp next batch" endpoint. Each call looks up a handful of unknown artists, staying inside the function time limit and about 1 request per second, and returns progress. The map and stamps fill in live.
4. When the batch loop finishes, the assembled passport is saved.

### Concurrency (builder to finalise)

Separate function instances serving different visitors could together go over MusicBrainz's 1 request per second limit. The builder should add a simple shared throttle (for example a timestamp in Blobs), and back off whenever MusicBrainz returns a 503.

### "Good enough" passports (Claude's call)

- Look up artists in play-count order, biggest first.
- A passport counts as **ready** once artists covering about 90% of the user's plays have a resolved country (known or unknown). The long tail keeps filling in afterwards.
- Lookups only progress while someone has a passport open; there's no background worker in v1. Anyone opening the same passport, including someone following a shared link, helps it carry on filling in.
- An incomplete passport is still viewable and shareable, with a small "still stamping: N artists to go" badge.
- If the shared throttle is busy because several new users arrived at once, show a plain "busy, you're in the queue" message instead of a stalled progress bar.

### Reuse for pen pals (Claude's call)

Keep the last.fm client in its own module with no SvelteKit dependencies, so it can be copied into the pen pals project later. Don't build a monorepo or a package now, and don't share the Blobs stores across sites.

### Next destination

- Take the user's top ~10 artists and pull their similar artists from last.fm.
- Look up the candidates' countries (they share the same artist cache), keep those from countries the user hasn't visited, and rank by similarity score.
- Show the best one. If none qualifies, show "no suggestion yet" rather than a weak pick.

### Map

- An SVG world map rendered in a Svelte component (for example `d3-geo` with the `world-atlas` TopoJSON). Map IDs are mapped to ISO alpha-2 codes.
- Colour strength is based on each country's share of the user's plays. The continent count comes from a static country-to-continent table.
- The UK shows up in MusicBrainz as `GB`, and Scotland and England are not split out.


## Left to the builder

- Project structure, component breakdown, and styling (while keeping the passport feel).
- How many artists and tracks to fetch (a sensible default is about the top 500 artists).
- Error states: unknown user, a user with no scrobbles, last.fm or MusicBrainz being down.
- Testing approach. Aggregation, country resolution and next-destination ranking should be unit tested against mocked API responses.
- Adding `.superpowers/` to `.gitignore` when the repo is created.
