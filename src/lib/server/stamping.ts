import { assemblePassport, READY_COVERAGE } from '../passport/assemble';
import type { Passport, Snapshot } from '../passport/types';
import { artistKey } from './artist-key';
import type { createLastfmClient } from './lastfm/client';
import type { createMusicBrainzClient } from './musicbrainz/client';
import { ThrottleBusy } from './store/throttle';
import { MusicBrainzUnavailable } from './musicbrainz/client';
import type { ArtistRecord, KV } from './store/types';

export const SNAPSHOT_TTL_MS = 24 * 3600 * 1000;
const TOP_ARTISTS = 500;
const TOP_TRACKS = 500;
const SIMILAR_SEEDS = 10;
const SIMILAR_PER_SEED = 20;
const MAX_CANDIDATES = 50;
const DEFAULT_BUDGET_MS = 6000;
const READ_CONCURRENCY = 50;

export interface StampingDeps {
	lastfm: ReturnType<typeof createLastfmClient>;
	mb: ReturnType<typeof createMusicBrainzClient>;
	artists: KV<ArtistRecord>;
	snapshots: KV<Snapshot>;
	now: () => number;
}

export type BatchResult =
	| { status: 'ok'; passport: Passport; remaining: number }
	| { status: 'queued'; passport: Passport; remaining: number }
	| { status: 'unavailable'; passport: Passport; remaining: number };

type QueueItem = { name: string; mbid?: string };

const snapshotKey = (username: string) => username.toLowerCase();

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

export async function getSnapshot(
	deps: StampingDeps,
	username: string,
	opts: { refresh?: boolean } = {}
): Promise<Snapshot> {
	const key = snapshotKey(username);
	const existing = await deps.snapshots.get(key);
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

	const snapshot: Snapshot = {
		username: user.name,
		createdAt: deps.now(),
		user,
		artists,
		tracks,
		similar,
		records: {}
	};

	// Pick up countries already resolved for other users.
	const keys = [...new Set([...artists.map(artistKey), ...candidates(snapshot).map(artistKey)])];
	for (let i = 0; i < keys.length; i += READ_CONCURRENCY) {
		const chunk = keys.slice(i, i + READ_CONCURRENCY);
		const found = await Promise.all(chunk.map((k) => deps.artists.get(k)));
		chunk.forEach((k, j) => {
			if (found[j]) snapshot.records[k] = found[j];
		});
	}

	await deps.snapshots.set(snapshotKey(user.name), snapshot);
	return snapshot;
}

export async function loadRecords(_deps: StampingDeps, s: Snapshot): Promise<Map<string, ArtistRecord>> {
	return new Map(Object.entries(s.records));
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
	const start = deps.now();
	let status: BatchResult['status'] = 'ok';
	let changed = false;

	for (const item of pendingQueue(s, records)) {
		if (deps.now() - start >= budgetMs) break;
		const key = artistKey(item);

		const cached = await deps.artists.get(key);
		if (cached) {
			records.set(key, cached);
			changed = true;
			continue;
		}

		let country: string | null;
		try {
			country = await deps.mb.resolveArtistCountry(item);
		} catch (error) {
			if (error instanceof ThrottleBusy) status = 'queued';
			else if (error instanceof MusicBrainzUnavailable) status = 'unavailable';
			else throw error;
			break;
		}
		const record = { country, resolvedAt: deps.now() };
		await deps.artists.set(key, record);
		records.set(key, record);
		changed = true;
	}

	if (changed) {
		s.records = Object.fromEntries(records);
		await deps.snapshots.set(snapshotKey(s.username), s);
	}
	return {
		status,
		passport: assemblePassport(s, records),
		remaining: pendingQueue(s, records).length
	};
}
