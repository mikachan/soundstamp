import { assemblePassport, READY_COVERAGE } from '../passport/assemble';
import type { Passport, Snapshot } from '../passport/types';
import { artistKey } from './artist-key';
import type { createLastfmClient } from './lastfm/client';
import type { createMusicBrainzClient } from './musicbrainz/client';
import { DeadlineReached, MusicBrainzUnavailable } from './musicbrainz/client';
import { ThrottleBusy } from './store/throttle';
import type { ArtistRecord, KV } from './store/types';

export const SNAPSHOT_TTL_MS = 24 * 3600 * 1000;
const TOP_ARTISTS = 500;
const TOP_TRACKS = 500;
const SIMILAR_SEEDS = 10;
const SIMILAR_PER_SEED = 20;
const MAX_CANDIDATES = 50;
// Every MusicBrainz request also checks this deadline, so a batch ends within ~8 s.
const DEFAULT_BUDGET_MS = 5000;
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
	now: () => number;
}

export type BatchResult =
	| { status: 'ok'; passport: Passport; remaining: number }
	| { status: 'queued'; passport: Passport; remaining: number }
	| { status: 'unavailable'; passport: Passport; remaining: number };

type QueueItem = { name: string; mbid?: string };

const userKey = (username: string) => username.toLowerCase();

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

async function mergeRecords(deps: StampingDeps, username: string, fresh: Record<string, ArtistRecord>) {
	if (Object.keys(fresh).length === 0) return;
	const latest = (await deps.records.get(userKey(username))) ?? {};
	await deps.records.set(userKey(username), { ...latest, ...fresh });
}

export async function getSnapshot(
	deps: StampingDeps,
	username: string,
	opts: { refresh?: boolean } = {}
): Promise<Snapshot> {
	const existing = await deps.snapshots.get(userKey(username));
	if (existing && !opts.refresh && deps.now() - existing.createdAt < SNAPSHOT_TTL_MS) return existing;

	const user = await deps.lastfm.getUser(username);
	const [artists, tracks] = await Promise.all([
		deps.lastfm.getTopArtists(user.name, TOP_ARTISTS),
		deps.lastfm.getTopTracks(user.name, TOP_TRACKS)
	]);
	const similar = await Promise.all(
		artists.slice(0, SIMILAR_SEEDS).map(async (seed) => ({
			seed: seed.name,
			// A missing similar list only weakens next destination; don't fail the passport.
			artists: await deps.lastfm.getSimilar(seed, SIMILAR_PER_SEED).catch(() => [])
		}))
	);
	const snapshot: Snapshot = { username: user.name, createdAt: deps.now(), user, artists, tracks, similar };

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

	await deps.snapshots.set(userKey(user.name), snapshot);
	await mergeRecords(deps, user.name, known);
	return snapshot;
}

export async function loadRecords(deps: StampingDeps, s: Snapshot): Promise<Map<string, ArtistRecord>> {
	return new Map(Object.entries((await deps.records.get(userKey(s.username))) ?? {}));
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

export async function stampNextBatch(
	deps: StampingDeps,
	username: string,
	budgetMs = DEFAULT_BUDGET_MS
): Promise<BatchResult> {
	const s = await getSnapshot(deps, username);
	const records = await loadRecords(deps, s);
	const deadline = deps.now() + budgetMs;
	const fresh: Record<string, ArtistRecord> = {};
	let status: BatchResult['status'] = 'ok';

	for (const item of pendingQueue(s, records)) {
		if (deps.now() >= deadline) break;
		const key = artistKey(item);
		try {
			let record = await deps.artists.get(key);
			if (!record) {
				record = { country: await deps.mb.resolveArtistCountry(item, { deadline }), resolvedAt: deps.now() };
				await deps.artists.set(key, record);
			}
			records.set(key, record);
			fresh[key] = record;
		} catch (error) {
			if (error instanceof DeadlineReached) break;
			if (error instanceof ThrottleBusy) {
				status = 'queued';
				break;
			}
			if (error instanceof MusicBrainzUnavailable) {
				status = 'unavailable';
				break;
			}
			// Anything else would fail the same way every time: count the artist as unknown
			// for this user (not in the shared cache) so the rest of the queue can move on.
			console.error(`stamping ${item.name} failed`, error);
			const unknown = { country: null, resolvedAt: deps.now() };
			records.set(key, unknown);
			fresh[key] = unknown;
		}
	}

	await mergeRecords(deps, s.username, fresh);
	return {
		status,
		passport: assemblePassport(s, records),
		remaining: pendingQueue(s, records).length
	};
}

/** The passport as it stands, plus how many lookups are still queued (including destination candidates). */
export async function currentPassport(deps: StampingDeps, s: Snapshot) {
	const records = await loadRecords(deps, s);
	return { passport: assemblePassport(s, records), remaining: pendingQueue(s, records).length };
}
