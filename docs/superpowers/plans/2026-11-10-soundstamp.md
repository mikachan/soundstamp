# Soundstamp v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A SvelteKit site where entering a last.fm username produces a shareable "passport" page at `/<username>`. The page shows an ID strip, a world map shaded by listening per country, a stamp per country, and one next destination.

**Architecture:**
- **Framework-free core.** Plain TypeScript modules hold the logic: API clients, stores, aggregation, ranking and batch stamping. Every dependency (`fetch`, clock, stores) is passed in, so all of it is unit-testable with fakes.
- **Thin SvelteKit layer.** Routes and Svelte 5 components sit on top of that core.
- **Storage.** Netlify Blobs holds three stores: a shared artist→country cache, a per-user last.fm snapshot, and a throttle key.
- **Stamping.** MusicBrainz lookups run in small batches driven by the open page, which polls a POST endpoint.

**Tech Stack:**
- SvelteKit 2 with Svelte 5 runes, TypeScript and Vite
- `@sveltejs/adapter-netlify`, `@netlify/blobs`
- Vitest, `@testing-library/svelte`, jsdom
- Map: `d3-geo`, `topojson-client`, `world-atlas` (110m)
- Country data: `i18n-iso-countries`, `countries-list`

**Spec:** `docs/superpowers/specs/2026-11-10-musical-passport-design.md`

## Global Constraints

- **Name and branding:**
  - The product name is **Soundstamp** and the npm package name is `soundstamp`. The repo folder stays `musical-passport`.
  - The text "lastfm" or "last.fm" never appears in the site name or in any logo.
- **Network and keys:**
  - The last.fm API key (`LASTFM_API_KEY`) is used only in `src/lib/server/**`, never sent to the browser.
  - The browser never calls last.fm or MusicBrainz directly.
- **MusicBrainz requests:**
  - Every request sends `User-Agent: Soundstamp/0.1 ( ${MB_CONTACT} )`, where `MB_CONTACT` is an env var holding a contact URL or email.
  - Requests are spaced at least **1100 ms** apart across the whole site, using the shared throttle.
  - A 503 response makes the current batch stop. It never marks an artist as unknown.
- **No last.fm images anywhere.** The ID strip uses a generated initials "passport photo" instead of an avatar or artist image.
- **Attribution on every page:**
  - The layout footer has a "powered by AudioScrobbler" link to `https://www.last.fm` and a "Country data from MusicBrainz" link to `https://musicbrainz.org`.
  - The username links to the user's last.fm profile URL.
  - Artist and track names link to their last.fm `url`.
- **Fetch sizes:** top **500** artists (`period=overall`), top **500** tracks, similar artists for the top **10** artists, and at most **50** destination candidates.
- **Readiness and freshness:**
  - A passport is `ready` when resolved artists cover at least **0.9** of the plays across the top-500 artists.
  - Snapshots refresh after **24 h**.
  - Stored snapshots older than **7 days** are deleted daily.
- **Stamp contents:** the top **5** artists and top **10** tracks for that country.
- **Stamping batches:** each call has an **8000 ms** time budget.
- **Polling:** the client polls with a **3 s** delay while queued, and on errors backs off exponentially up to a **30 s** cap.
- **No analytics, ads, tracking scripts or Spotify anything.**

## Review Focus

1. **Odd usernames.** Usernames in mixed case, with spaces, dots or unicode (`/RJ`, `/rj`, `/Some%20One`) must all land on the same passport, using last.fm's canonical name. Snapshots are keyed by the lowercased username, and mixed-case URLs redirect to the canonical-case URL. Covered in Task 8.
2. **Unknown users and empty accounts.** A user that doesn't exist (last.fm error 6), or an account with zero scrobbles, should show a friendly page with a 404 or an empty-passport message, never a 500. Covered in Tasks 3 and 8.
3. **Stale MBIDs.** When last.fm gives an MBID that MusicBrainz no longer recognises and returns 404, fall back to a name search. Mark the artist unknown only if that search also fails. Covered in Task 4.
4. **MusicBrainz outages mid-batch.** A 503 or network failure ends the batch with the artist still pending, never recorded as unknown, and the client retries with backoff. Covered in Tasks 4, 7 and 9.
5. **Codes that aren't real countries.** MusicBrainz uses pseudo-codes `XW` (Worldwide), `XE` (Europe) and `XU` (unknown), which count as unknown. A real country missing from the 110m map, such as `SG`, still gets a stamp even though no shape is drawn for it. Covered in Tasks 2 and 10.

---

## File Structure

```
src/lib/geo/countries.ts             # alpha-2 ↔ numeric, names, continents, pseudo-code filter
src/lib/server/lastfm/client.ts      # framework-free last.fm client (copyable to pen pals)
src/lib/server/lastfm/types.ts
src/lib/server/musicbrainz/client.ts # resolveArtistCountry
src/lib/server/store/types.ts        # KV interface + memory impl
src/lib/server/store/blobs.ts        # Netlify Blobs KV impl
src/lib/server/store/throttle.ts     # shared MB throttle
src/lib/server/artist-key.ts         # artistKey + name normalisation
src/lib/passport/types.ts            # Passport, Stamp, Destination (shared with UI)
src/lib/passport/assemble.ts         # pure: snapshot + records → Passport
src/lib/passport/destination.ts      # pure: rank destinations
src/lib/server/stamping.ts           # snapshot load/create, pending queue, stampNextBatch
src/lib/server/deps.ts               # builds real deps from env + Blobs
src/routes/+layout.svelte            # shell + attribution footer
src/routes/+page.svelte              # username form
src/routes/+page.server.ts           # form action → redirect
src/routes/[username]/+page.server.ts
src/routes/[username]/+page.svelte
src/routes/api/[username]/stamp/+server.ts
src/routes/api/[username]/refresh/+server.ts
src/lib/components/IdStrip.svelte
src/lib/components/WorldMap.svelte
src/lib/components/Stamps.svelte
src/lib/components/NextDestination.svelte
src/lib/components/StampingStatus.svelte
src/lib/client/poll.ts               # polling loop with backoff
netlify/functions/cleanup.mts        # daily scheduled cleanup
tests/…                              # mirrors src paths; fixtures in tests/fixtures/
```

---

### Task 1: Scaffold, tooling, repo

**Files:**
- Create: the SvelteKit skeleton via `npx sv create . --template minimal --types ts --no-add-ons`
- Create: `svelte.config.js` (adapter-netlify), `netlify.toml`, `vitest.config.ts`, `.gitignore`, `.env.example`, `README.md`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm test` (vitest run), `npm run build`, `npm run check`

- [ ] **Step 1:** Run `git init` in `/Users/sarahnorris/Source/Personal/musical-passport`. Scaffold SvelteKit into the existing folder, keeping `docs/`. Set the `package.json` name to `soundstamp`.
- [ ] **Step 2:** Install the dev and runtime dependencies listed under Tech Stack. Configure `adapter({ edge: false, split: false })`. In `netlify.toml`, set `[build] command = "npm run build"` and `publish = "build"`.
- [ ] **Step 3:** `.gitignore` must include `.superpowers/`, `.env`, `.env.*` (except `.env.example`), `.netlify/`, `node_modules/` and `build/`. `.env.example` contains `LASTFM_API_KEY=` and `MB_CONTACT=`.
- [ ] **Step 4:** Configure Vitest with the `jsdom` environment for `*.svelte.test.ts` and `node` for the rest. Write `tests/smoke.test.ts` with `expect(1 + 1).toBe(2)`.
- [ ] **Step 5:** Run `npm test`, `npm run check` and `npm run build`. Expected: all pass, and the build produces Netlify output without errors.
- [ ] **Step 6:** The README covers the env vars, `netlify dev` for local work, the reminder that each production deploy costs 15 credits, and a pre-launch checklist: email partners@last.fm for page approval, ask about avatars, ask about opt-in pen pals.
- [ ] **Step 7: Commit:** `git add -A && git commit -m "chore: scaffold Soundstamp (SvelteKit + Netlify)"`

### Task 2: Country data

**Files:**
- Create: `src/lib/geo/countries.ts`
- Test: `tests/lib/geo/countries.test.ts`

**Interfaces:**
- Produces:
  - `isRealCountry(code: string | null | undefined): code is string`. False for `XW`, `XE`, `XU`, empty strings, and anything `i18n-iso-countries` doesn't know.
  - `countryName(code: string): string` (English)
  - `toNumericId(code: string): string | null`. Returns the zero-padded 3-digit id matching world-atlas feature ids, e.g. `GB → "826"`.
  - `continentOf(code: string): string | null`. Uses `countries-list` continent codes (`EU`, `AS`, …).

- [ ] **Step 1: Write failing tests:**
  - `isRealCountry('GB')` → true. `'XW'`, `'XE'`, `'XU'`, `''`, `null` and `'ZZ'` → false.
  - `countryName('IS')` → `'Iceland'`.
  - `toNumericId('GB')` → `'826'`, `toNumericId('JP')` → `'392'`.
  - `continentOf('JP')` → `'AS'`, `continentOf('GB')` → `'EU'`.
- [ ] **Step 2:** Run `npx vitest run tests/lib/geo`. Expected: FAIL (module missing).
- [ ] **Step 3:** Implement using `i18n-iso-countries` (register `en`) and `countries-list`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: country helpers`

### Task 3: last.fm client

**Files:**
- Create: `src/lib/server/lastfm/types.ts`, `src/lib/server/lastfm/client.ts`
- Test: `tests/lib/server/lastfm/client.test.ts`, plus fixtures `tests/fixtures/lastfm/{userinfo,topartists,toptracks,similar,error6}.json`

**Interfaces:**
- Produces (this module must not import anything from `$app`, `$env` or `@sveltejs/*`):

```ts
export interface LastfmUser { name: string; url: string; registeredYear: number; playcount: number }
export interface LastfmArtist { name: string; mbid?: string; playcount: number; url: string }
export interface LastfmTrack { name: string; url: string; playcount: number; artist: { name: string; mbid?: string } }
export interface SimilarArtist { name: string; mbid?: string; match: number; url: string }
export class LastfmUserNotFound extends Error {}
export class LastfmUnavailable extends Error {}
export function createLastfmClient(opts: { apiKey: string; fetch: typeof fetch }): {
  getUser(username: string): Promise<LastfmUser>;
  getTopArtists(username: string, limit: number): Promise<LastfmArtist[]>;
  getTopTracks(username: string, limit: number): Promise<LastfmTrack[]>;
  getSimilar(artist: { name: string; mbid?: string }, limit: number): Promise<SimilarArtist[]>;
};
```

- [ ] **Step 1: Write failing tests** against a fake `fetch` that returns the fixtures:
  - The request URL targets `https://ws.audioscrobbler.com/2.0/` with `method`, `user`, `api_key`, `format=json`, and `limit`.
  - `getUser` maps `registered.unixtime` to `registeredYear` and parses string numbers into numbers.
  - An empty-string `mbid` becomes `undefined`.
  - A response body of `{"error":6}` throws `LastfmUserNotFound`.
  - HTTP 5xx, other error codes and network failures throw `LastfmUnavailable`.
  - A user with zero top artists returns `[]`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `getSimilar` passes `mbid` when present, otherwise `artist`, and uses `autocorrect=1`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: last.fm client`

### Task 4: MusicBrainz country resolution

**Files:**
- Create: `src/lib/server/musicbrainz/client.ts`
- Test: `tests/lib/server/musicbrainz/client.test.ts`, plus fixtures in `tests/fixtures/mb/`

**Interfaces:**
- Consumes:
  - `isRealCountry` (Task 2)
  - `throttle.wait(): Promise<void>` (Task 5). It's passed in as `beforeRequest`, so this task's tests use a no-op.
- Produces:

```ts
export class MusicBrainzUnavailable extends Error {}   // 503, 5xx, network
export function createMusicBrainzClient(opts: {
  fetch: typeof fetch; contact: string; beforeRequest: () => Promise<void>;
}): {
  resolveArtistCountry(artist: { name: string; mbid?: string }): Promise<string | null>; // real alpha-2 or null = unknown
};
```

- [ ] **Step 1: Write failing tests:**
  - **MBID lookup.** An artist with an MBID calls `https://musicbrainz.org/ws/2/artist/<mbid>?fmt=json` and sends `User-Agent: Soundstamp/0.1 ( <contact> )`. A `country` of `IS` returns `'IS'`.
  - **Area fallback.** If `country` is missing but there's an `area`, the client follows `area/<id>?inc=area-rels&fmt=json`. It walks backward "part of" relations until it reaches an area with `iso-3166-1-codes`, stopping after **3** hops. Example: an area with code `GB` returns `'GB'`.
  - **Pseudo-codes.** A `country` of `XW` returns `null`.
  - **Stale MBID.** A 404 on the MBID falls back to a name search: `artist?query=artist:"<name>"&limit=5&fmt=json`. A top result with `score === 100` and a case-insensitively equal name is used. Any other result returns `null`.
  - **No MBID.** The client goes straight to the name search.
  - **Outages.** A 503, or a network rejection on any request, throws `MusicBrainzUnavailable`.
  - **Throttle.** `beforeRequest` is called once before every HTTP request, so an MBID lookup plus an area hop calls it twice.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: MusicBrainz country resolution`

### Task 5: Stores, artist keys and throttle

**Files:**
- Create: `src/lib/server/store/types.ts`, `src/lib/server/store/blobs.ts`, `src/lib/server/store/throttle.ts`, `src/lib/server/artist-key.ts`
- Test: `tests/lib/server/store/throttle.test.ts`, `tests/lib/server/artist-key.test.ts`, `tests/lib/server/store/memory.test.ts`

**Interfaces:**
- Produces:

```ts
// types.ts
export interface KV<T> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  list(): Promise<string[]>;
}
export function memoryKV<T>(): KV<T>;
export interface ArtistRecord { country: string | null; resolvedAt: number }   // null = unknown
// blobs.ts
export function blobsKV<T>(storeName: 'artists' | 'snapshots' | 'meta'): KV<T>; // getStore({ name, consistency: 'strong' }), JSON values
// throttle.ts
export class ThrottleBusy extends Error {}
export function createThrottle(opts: {
  kv: KV<number>; now: () => number; sleep: (ms: number) => Promise<void>;
  intervalMs?: number /* 1100 */; maxWaitMs?: number /* 2000 */;
}): { wait(): Promise<void> };
// artist-key.ts
export function normaliseName(name: string): string;           // NFKC, lowercase, trim, collapse whitespace
export function artistKey(a: { name: string; mbid?: string }): string; // mbid ? `mbid:${mbid}` : `name:${normaliseName(name)}`
```

- [ ] **Step 1: Write failing tests:**
  - **Throttle.** With a fake clock, consecutive `wait()` calls are spaced 1100 ms apart, and the stored key `mb-next` advances each time. If the required wait is more than 2000 ms, `wait()` throws `ThrottleBusy` without sleeping.
  - **Artist keys.** `artistKey({name:' Sigur  Rós '})` → `'name:sigur rós'`. `artistKey({name:'x', mbid:'abc'})` → `'mbid:abc'`.
  - **Memory store.** `memoryKV` handles get, set, delete and list round-trips.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `blobsKV` isn't unit-tested, because it's a thin wrapper and gets exercised in the Task 11 smoke test.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: stores, artist keys, shared throttle`

### Task 6: Passport assembly and next destination (pure)

**Files:**
- Create: `src/lib/passport/types.ts`, `src/lib/passport/assemble.ts`, `src/lib/passport/destination.ts`
- Test: `tests/lib/passport/assemble.test.ts`, `tests/lib/passport/destination.test.ts`

**Interfaces:**
- Consumes:
  - Task 2: `isRealCountry`, `countryName`, `continentOf`
  - Task 3: the last.fm types
  - Task 5: `artistKey`, `ArtistRecord`
- Produces:

```ts
// types.ts
export interface Snapshot {
  username: string; createdAt: number;
  user: LastfmUser; artists: LastfmArtist[]; tracks: LastfmTrack[];
  similar: { seed: string; artists: SimilarArtist[] }[];   // seed = seed artist name
}
export interface Stamp {
  country: string; countryName: string; plays: number; share: number;   // share of total top-artist plays
  artists: { name: string; url: string; playcount: number }[];          // top 5
  tracks: { name: string; url: string; artist: string; playcount: number }[]; // top 10
}
export interface Destination { country: string; countryName: string; artist: { name: string; url: string }; becauseOf: string; match: number }
export interface Passport {
  username: string; profileUrl: string; joinedYear: number; totalScrobbles: number;
  countryCount: number; continentCount: number; stamps: Stamp[];        // sorted by plays desc
  unknownArtists: number; pendingArtists: number; coverage: number; ready: boolean;
  destinations: Destination[];                                         // ranked; UI shows [0]
}
// assemble.ts
export function assemblePassport(s: Snapshot, records: Map<string, ArtistRecord>): Passport;
// destination.ts
export function rankDestinations(s: Snapshot, records: Map<string, ArtistRecord>, visited: Set<string>): Destination[];
```

- [ ] **Step 1: Write failing assemble tests** (fixture: a snapshot with 4 artists totalling 1000 plays: IS 400, GB 300, unknown 200, pending 100):
  - `stamps` has IS then GB, with `share` values 0.4 and 0.3.
  - `unknownArtists` = 1, `pendingArtists` = 1.
  - `coverage` = 0.9 and `ready` = true. With the pending artist at 200 plays and the unknown at 100, `coverage` = 0.8 and `ready` = false.
  - **Track matching.** Tracks are attached to stamps by matching the track artist to a snapshot artist by MBID, falling back to the normalised name. Tracks by artists not in the snapshot are ignored.
  - **Limits.** A stamp lists at most 5 artists and 10 tracks.
  - **Counts.** `continentCount` counts distinct continents.
  - **Empty account.** A snapshot with zero artists gives `coverage = 1`, `ready = true` and empty stamps.
  - **Pseudo-codes.** A record with country `XE` counts as unknown.
- [ ] **Step 2: Write failing destination tests:**
  - Candidates are kept only if their country is real and not in `visited`.
  - Candidates are ranked by `match` descending, and each country appears once, with its best candidate.
  - Candidates that are already among the user's own top artists are excluded.
  - `becauseOf` holds the seed name.
  - If no candidates qualify, the result is `[]`.
- [ ] **Step 3:** Run the tests. Expected: FAIL.
- [ ] **Step 4:** Implement. `assemblePassport` calls `rankDestinations` with the set of stamp countries.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6: Commit:** `feat: passport assembly and destination ranking`

### Task 7: Stamping service

**Files:**
- Create: `src/lib/server/stamping.ts`, `src/lib/server/deps.ts`
- Test: `tests/lib/server/stamping.test.ts`

**Interfaces:**
- Consumes: Tasks 3–6
- Produces:

```ts
export interface StampingDeps {
  lastfm: ReturnType<typeof createLastfmClient>;
  mb: ReturnType<typeof createMusicBrainzClient>;
  artists: KV<ArtistRecord>; snapshots: KV<Snapshot>; now: () => number;
}
export function getSnapshot(deps: StampingDeps, username: string, opts?: { refresh?: boolean }): Promise<Snapshot>;
export function pendingQueue(s: Snapshot, records: Map<string, ArtistRecord>): { name: string; mbid?: string }[];
export function loadRecords(deps: StampingDeps, s: Snapshot): Promise<Map<string, ArtistRecord>>;
export type BatchResult =
  | { status: 'ok'; passport: Passport; remaining: number }
  | { status: 'queued'; passport: Passport; remaining: number }   // ThrottleBusy
  | { status: 'unavailable'; passport: Passport; remaining: number }; // MusicBrainzUnavailable
export function stampNextBatch(deps: StampingDeps, username: string, budgetMs?: number /* 8000 */): Promise<BatchResult>;
export function createDeps(env: { LASTFM_API_KEY: string; MB_CONTACT: string }): StampingDeps; // deps.ts, real Blobs + fetch + throttle
```

- [ ] **Step 1: Write failing tests** using fakes (`memoryKV` and stub clients):
  - **Snapshot creation.** `getSnapshot` builds a snapshot with 500 artists, 500 tracks and similar artists for the top 10, and stores it under the lowercased username key. A second call within 24 h reuses it without calling last.fm. After 24 h, or with `refresh: true`, it refetches.
  - **Canonical name.** `snapshot.username` is last.fm's canonical `user.name`.
  - **Queue order:**
    - First, the user's unresolved artists by playcount descending, until resolved coverage would reach 0.9.
    - Then unresolved destination candidates, by `match` descending, capped at 50 in total.
    - Then the rest of the user's unresolved artists.
    - No duplicate keys.
  - **Normal batch.** `stampNextBatch` resolves queue items in order, writes an `ArtistRecord` for each, stops once `budgetMs` has elapsed according to the fake clock, and returns `status: 'ok'` with the correct `remaining`.
  - **Outage.** A `MusicBrainzUnavailable` on the 2nd item returns `status: 'unavailable'`. Item 1 is recorded and item 2 is not.
  - **Busy throttle.** A `ThrottleBusy` thrown from the MB client returns `status: 'queued'`.
  - **Unknown user.** `LastfmUserNotFound` from `getSnapshot` propagates unchanged.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `createDeps` wires `createThrottle({ kv: blobsKV('meta'), now: Date.now, sleep })` as `beforeRequest`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: batch stamping service`

### Task 8: Routes and endpoints

**Files:**
- Create: `src/routes/+page.svelte`, `src/routes/+page.server.ts`, `src/routes/[username]/+page.server.ts`, `src/routes/api/[username]/stamp/+server.ts`, `src/routes/api/[username]/refresh/+server.ts`
- Modify: `src/app.d.ts` (add `locals.deps?: StampingDeps` for test injection)
- Test: `tests/routes/username.test.ts`, `tests/routes/stamp.test.ts`

**Interfaces:**
- Consumes: Task 7
- Produces:
  - `GET /<username>` → `{ passport: Passport }` page data
  - `POST /api/<username>/stamp` → JSON `BatchResult`
  - `POST /api/<username>/refresh` → `303` to `/<canonical>`

- [ ] **Step 1: Write failing tests.** Call the exported `load` and `POST` functions directly, with `locals.deps` set to fakes:
  - **Load.** It returns an assembled passport, partial if items are still pending.
  - **Case redirect.** `/RJ`, when last.fm's canonical name is `rj`, throws a `redirect(301, '/rj')`. A URL-encoded name with spaces resolves to the same snapshot.
  - **Errors.** `LastfmUserNotFound` → `error(404, 'No last.fm user called "<name>"')`. `LastfmUnavailable` → `error(503, 'last.fm is not responding, try again shortly')`.
  - **Stamp endpoint.** It returns the `BatchResult` JSON.
  - **Refresh endpoint.** It calls `getSnapshot` with `refresh: true`, keeps the artist records, and redirects to `/<canonical>`.
  - **Home form.** The action trims the input and redirects to `/<encodeURIComponent(name)>`. An empty input fails with 400.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Routes use `locals.deps ?? createDeps(env)` with `$env/dynamic/private`. Add `src/routes/[username]/+error.svelte` with friendly copy and a link home.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: passport routes and stamping endpoints`

### Task 9: Passport page, polling and status

**Files:**
- Create: `src/routes/[username]/+page.svelte`, `src/lib/client/poll.ts`, `src/lib/components/StampingStatus.svelte`, `src/lib/components/IdStrip.svelte`, `src/routes/+layout.svelte`
- Test: `tests/lib/client/poll.test.ts`, `tests/lib/components/StampingStatus.svelte.test.ts`, `tests/lib/components/IdStrip.svelte.test.ts`

**Interfaces:**
- Consumes: `Passport` and `BatchResult` from Tasks 6–7, and the stamp endpoint from Task 8
- Produces:
  - `startPolling(opts: { username: string; fetch: typeof fetch; onUpdate: (p: Passport) => void; sleep: (ms: number) => Promise<void> }): { stop(): void }`
  - The `<IdStrip passport>`, `<StampingStatus passport status>` and layout footer components

- [ ] **Step 1: Write failing poll tests:**
  - It keeps POSTing while `remaining > 0` and stops at `remaining === 0`.
  - On `queued` it waits 3000 ms.
  - On `unavailable` or a network error it backs off 3000 → 6000 → 12000 → 24000 → 30000 ms (capped), and the backoff resets after an `ok`.
  - `stop()` halts the loop.
  - `onUpdate` receives each passport.
- [ ] **Step 2: Write failing component tests:**
  - **StampingStatus copy:**
    - `ready` false: "Stamping your passport… N%" (coverage rounded).
    - `ready` true with `pendingArtists > 0`: "Still stamping: N artists to go".
    - `queued`: "Busy right now, you're in the queue".
    - Nothing is shown when `pendingArtists === 0`.
    - When `unknownArtists > 0`: "N artists without a known home country".
  - **IdStrip:**
    - Renders the initials from the username, e.g. `sarahnorris` → `S`, `big_red_dragon` → `BR` (split on `_`, `-`, `.` and spaces, first two parts).
    - Contains no `<img>`.
    - The username links to `profileUrl`.
    - Shows "N countries · M continents · since YYYY".
- [ ] **Step 3:** Run the tests. Expected: FAIL.
- [ ] **Step 4:** Implement.
  - **Page.** It renders the server data immediately and starts polling in `onMount` when `pendingArtists > 0`, replacing its `$state` passport on each update.
  - **Head.** `<svelte:head>` has the title `<username>'s Soundstamp: N countries`, plus `og:title` and `og:description` with the stats.
  - **Refresh.** A refresh button posts to the refresh endpoint.
  - **Layout footer.** It includes the attribution links from Global Constraints.
- [ ] **Step 5:** Run the tests. Expected: PASS.
- [ ] **Step 6: Commit:** `feat: passport page with live stamping status`

### Task 10: Map, stamps, next destination

**Files:**
- Create: `src/lib/components/WorldMap.svelte`, `src/lib/components/Stamps.svelte`, `src/lib/components/NextDestination.svelte`, `src/lib/geo/shade.ts`
- Modify: `src/routes/[username]/+page.svelte` (layout A order: IdStrip, StampingStatus, WorldMap, Stamps, NextDestination)
- Test: `tests/lib/geo/shade.test.ts`, `tests/lib/components/Stamps.svelte.test.ts`, `tests/lib/components/NextDestination.svelte.test.ts`, `tests/lib/components/WorldMap.svelte.test.ts`

**Interfaces:**
- Consumes: `Passport`, `toNumericId`
- Produces: `shade(share: number, maxShare: number): number`, the fill opacity. It returns `0.25 + 0.75 * Math.sqrt(share / maxShare)`, or `0` when `share` is 0.

- [ ] **Step 1: Write failing tests:**
  - **Shade:** `shade(0.4, 0.4)` → `1`, `shade(0.1, 0.4)` → `0.625`, `shade(0, 0.4)` → `0`.
  - **WorldMap:**
    - Renders one `<path>` per world-atlas country.
    - Paths for stamp countries carry `data-country="<alpha2>"` and a non-zero fill opacity.
    - Every path has an accessible `<title>` with the country name, plus the play share if visited.
    - A stamp for `SG` (missing from the 110m map) doesn't throw.
  - **Stamps:**
    - Renders a stamp per entry, in order, each showing the country name and up to 5 artist links.
    - Clicking a stamp toggles a list of up to 10 track links (`aria-expanded` flips).
    - Artist and track links use their last.fm URLs.
  - **NextDestination:**
    - With destinations, it shows "Next destination: <country>", the artist link, and "because you like <becauseOf>".
    - With `[]`, it shows "No suggestion yet".
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. The map uses `geoEqualEarth` fitted to a 960×500 viewBox, with `world-atlas/countries-110m.json` converted via `topojson-client` `feature()`. Styling is a passport feel: off-white paper, a dark-teal ink map and rotated rubber-stamp borders, with colours as CSS custom properties and a dark-mode variant. Responsive down to 360 px.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit:** `feat: world map, stamps, next destination`

### Task 11: Cleanup job, local smoke test, deploy readiness

**Files:**
- Create: `netlify/functions/cleanup.mts`, `src/lib/server/cleanup.ts`
- Test: `tests/lib/server/cleanup.test.ts`

**Interfaces:**
- Consumes: `KV`, `Snapshot`
- Produces:
  - `cleanupSnapshots(kv: KV<Snapshot>, now: number, maxAgeMs = 7 * 24 * 3600 * 1000): Promise<number>`, which returns the number deleted
  - A scheduled function with `config = { schedule: '@daily' }`

- [ ] **Step 1: Write a failing test.** Snapshots older than 7 days are deleted, newer ones are kept, and the function returns the count. The artist cache is never touched.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Implement. The scheduled function calls `cleanupSnapshots(blobsKV('snapshots'), Date.now())`.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5: Manual smoke test** (this needs Sarah's `LASTFM_API_KEY` and `MB_CONTACT` in `.env`).
  - Run `netlify dev` and open `/<sarah's last.fm username>`.
  - Expected:
    - The ID strip appears immediately.
    - The status shows a rising percentage, and the map and stamps fill in.
    - "ready" arrives at 90% coverage.
    - Refresh works.
    - `/doesnotexist-xyz-123` shows the friendly 404 page.
- [ ] **Step 6:** Run `npm test && npm run check && npm run build`. Expected: all green.
- [ ] **Step 7: Commit:** `feat: daily snapshot cleanup`

Deploying to Netlify, connecting a domain and emailing last.fm are left to Sarah, using the README checklist.
