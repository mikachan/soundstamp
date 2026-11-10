import { assemblePassport, READY_COVERAGE } from '../passport/assemble';
import { DEFAULT_PERIOD, type Period } from '../passport/periods';
import type { Passport, Snapshot } from '../passport/types';
import { artistKey } from './artist-key';
import type { createLastfmClient } from './lastfm/client';
import type { createMusicBrainzClient } from './musicbrainz/client';
import { BULK_LIMIT, DeadlineReached, MusicBrainzUnavailable } from './musicbrainz/client';
import { ThrottleBusy } from './store/throttle';
import type { ArtistRecord, KV } from './store/types';

export const SNAPSHOT_TTL_MS = 24 * 3600 * 1000;
const TOP_ARTISTS = 500;
const TOP_TRACKS = 500;
const SIMILAR_SEEDS = 10;
const SIMILAR_PER_SEED = 20;
const MAX_CANDIDATES = 50;
// Every MusicBrainz request also checks this deadline, so a batch ends within ~15 s:
// well inside Netlify's 60 s synchronous limit, and short enough for frequent progress updates.
const DEFAULT_BUDGET_MS = 12_000;
const READ_CONCURRENCY = 50;

export interface StampingDeps {
	lastfm: ReturnType<typeof createLastfmClient>;
	mb: ReturnType<typeof createMusicBrainzClient>;
	/** Shared artist → country cache, across all users. */
	artists: KV<ArtistRecord>;
	/** last.fm data per user. Only getSnapshot writes it. */
	snapshots: KV<Snapshot>;
	/** Resolved records per user, merged on write so concurrent batches don't lose each other's work. */
	records: KV<Record<string, ArtistRecord>>;
	/** MBIDs a bulk search couldn't answer, so later batches look them up one by one instead. */
	bulkMisses: Set<string>;
	now: () => number;
}

export type BatchResult =
	| { status: 'ok'; passport: Passport; remaining: number }
	| { status: 'queued'; passport: Passport; remaining: number }
	| { status: 'unavailable'; passport: Passport; remaining: number };

type QueueItem = { name: string; mbid?: string };

/** Snapshots and records are stored per user and period, e.g. "rj:12month". */
const storeKey = (username: string, period: Period) => `${username.toLowerCase()}:${period}`;

function candidates(s: Snapshot): QueueItem[] {
	const own = new Set(s.artists.map(artistKey));
	const best = new Map<string, { item: QueueItem; match: number }>();
	for (const { artists } of s.similar) {
		for (const c of artists) {
			const key = artistKey(c);
			if (own.has(key) || (best.get(key)?.match ?? -1) >= c.match) continue;
			best.set(key, { item: { name: c.name, mbid: c.mbid }, match: c.match });
		}
	}
	return [...best.values()]
		.sort((a, b) => b.match - a.match)
		.slice(0, MAX_CANDIDATES)
		.map((c) => c.item);
}

async function mergeRecords(deps: StampingDeps, s: Snapshot, fresh: Record<string, ArtistRecord>) {
	if (Object.keys(fresh).length === 0) return;
	const key = storeKey(s.username, s.period);
	const latest = (await deps.records.get(key)) ?? {};
	await deps.records.set(key, { ...latest, ...fresh });
}

export async function getSnapshot(
	deps: StampingDeps,
	username: string,
	opts: { refresh?: boolean; period?: Period } = {}
): Promise<Snapshot> {
	const period = opts.period ?? DEFAULT_PERIOD;
	const existing = await deps.snapshots.get(storeKey(username, period));
	if (existing && !opts.refresh && deps.now() - existing.createdAt < SNAPSHOT_TTL_MS) return existing;

	const user = await deps.lastfm.getUser(username);
	const [artists, tracks] = await Promise.all([
		deps.lastfm.getTopArtists(user.name, TOP_ARTISTS, period),
		deps.lastfm.getTopTracks(user.name, TOP_TRACKS, period)
	]);
	const similar = await Promise.all(
		artists.slice(0, SIMILAR_SEEDS).map(async (seed) => ({
			seed: seed.name,
			// A missing similar list only weakens next destination; don't fail the passport.
			artists: await deps.lastfm.getSimilar(seed, SIMILAR_PER_SEED).catch(() => [])
		}))
	);
	const snapshot: Snapshot = {
		username: user.name,
		period,
		createdAt: deps.now(),
		user,
		artists,
		tracks,
		similar
	};

	// Pick up countries already resolved for other users.
	const keys = [...new Set([...artists.map(artistKey), ...candidates(snapshot).map(artistKey)])];
	const known: Record<string, ArtistRecord> = {};
	for (let i = 0; i < keys.length; i += READ_CONCURRENCY) {
		const chunk = keys.slice(i, i + READ_CONCURRENCY);
		const found = await Promise.all(chunk.map((k) => deps.artists.get(k)));
		chunk.forEach((k, j) => {
			if (found[j]) known[k] = found[j];
		});
	}

	await deps.snapshots.set(storeKey(user.name, period), snapshot);
	await mergeRecords(deps, snapshot, known);
	return snapshot;
}

export async function loadRecords(deps: StampingDeps, s: Snapshot): Promise<Map<string, ArtistRecord>> {
	return new Map(Object.entries((await deps.records.get(storeKey(s.username, s.period))) ?? {}));
}

/**
 * Lookup order: the user's own artists until resolved plays reach 90%, then
 * next-destination candidates by match, then the rest of the user's artists.
 */
export function pendingQueue(s: Snapshot, records: Map<string, ArtistRecord>): QueueItem[] {
	const total = s.artists.reduce((sum, a) => sum + a.playcount, 0);
	let resolvedPlays = s.artists.reduce((sum, a) => sum + (records.has(artistKey(a)) ? a.playcount : 0), 0);
	const unresolved = s.artists
		.filter((a) => !records.has(artistKey(a)))
		.sort((a, b) => b.playcount - a.playcount);

	const first: QueueItem[] = [];
	const rest: QueueItem[] = [];
	for (const a of unresolved) {
		const item = { name: a.name, mbid: a.mbid };
		if (total && resolvedPlays / total < READY_COVERAGE - 1e-9) {
			first.push(item);
			resolvedPlays += a.playcount;
		} else {
			rest.push(item);
		}
	}

	const seen = new Set(s.artists.map(artistKey));
	const middle = candidates(s).filter((c) => {
		const key = artistKey(c);
		if (records.has(key) || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	return [...first, ...middle, ...rest];
}

/** How a failed lookup affects the batch: stop with a status, or (null) mark the artist unknown and continue. */
function stopStatus(error: unknown): BatchResult['status'] | 'stop' | null {
	if (error instanceof DeadlineReached) return 'stop';
	if (error instanceof ThrottleBusy) return 'queued';
	if (error instanceof MusicBrainzUnavailable) return 'unavailable';
	return null;
}

export async function stampNextBatch(
	deps: StampingDeps,
	username: string,
	budgetMs = DEFAULT_BUDGET_MS,
	period: Period = DEFAULT_PERIOD
): Promise<BatchResult> {
	const s = await getSnapshot(deps, username, { period });
	const records = await loadRecords(deps, s);
	const deadline = deps.now() + budgetMs;
	const fresh: Record<string, ArtistRecord> = {};
	let status: BatchResult['status'] = 'ok';
	let stopped = false;

	const keep = (key: string, record: ArtistRecord) => {
		records.set(key, record);
		fresh[key] = record;
	};
	const finish = async (): Promise<BatchResult> => {
		await mergeRecords(deps, s, fresh);
		return { status, passport: assemblePassport(s, records), remaining: pendingQueue(s, records).length };
	};

	const queue = pendingQueue(s, records);

	// One search request answers up to 100 artists that have MBIDs.
	const withIds = queue.filter((q) => q.mbid && !deps.bulkMisses.has(q.mbid)).slice(0, BULK_LIMIT);
	const cached = await Promise.all(withIds.map((q) => deps.artists.get(artistKey(q))));
	withIds.forEach((q, i) => {
		if (cached[i]) keep(artistKey(q), cached[i]);
	});
	const uncached = withIds.filter((_, i) => !cached[i]);
	if (uncached.length) {
		try {
			const answers = await deps.mb.resolveMany(uncached, { deadline });
			for (const q of uncached) {
				if (!answers.has(q.mbid!)) {
					deps.bulkMisses.add(q.mbid!);
					continue;
				}
				const record = { country: answers.get(q.mbid!)!, resolvedAt: deps.now() };
				await deps.artists.set(artistKey(q), record);
				keep(artistKey(q), record);
			}
		} catch (error) {
			const stop = stopStatus(error);
			if (stop === null) throw error;
			if (stop !== 'stop') status = stop;
			stopped = true;
		}
	}
	if (stopped) return finish();

	// Everything else, one at a time: artists without MBIDs, area walks, and stale MBIDs.
	for (const item of queue) {
		const key = artistKey(item);
		if (records.has(key)) continue;
		if (deps.now() >= deadline) break;
		try {
			let record = await deps.artists.get(key);
			if (!record) {
				record = { country: await deps.mb.resolveArtistCountry(item, { deadline }), resolvedAt: deps.now() };
				await deps.artists.set(key, record);
			}
			keep(key, record);
		} catch (error) {
			const stop = stopStatus(error);
			if (stop !== null) {
				if (stop !== 'stop') status = stop;
				break;
			}
			// Anything else would fail the same way every time: count the artist as unknown
			// for this user (not in the shared cache) so the rest of the queue can move on.
			console.error(`stamping ${item.name} failed`, error);
			keep(key, { country: null, resolvedAt: deps.now() });
		}
	}

	return finish();
}

/** The passport as it stands, plus how many lookups are still queued (including destination candidates). */
export async function currentPassport(deps: StampingDeps, s: Snapshot) {
	const records = await loadRecords(deps, s);
	return { passport: assemblePassport(s, records), remaining: pendingQueue(s, records).length };
}
