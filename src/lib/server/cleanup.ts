import type { Snapshot } from '../passport/types';
import type { ArtistRecord, KV } from './store/types';

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Delete stored last.fm snapshots (and their per-user records) older than `maxAgeMs`. */
export async function cleanupSnapshots(
	snapshots: KV<Snapshot>,
	records: KV<Record<string, ArtistRecord>>,
	now: number,
	maxAgeMs = WEEK_MS
): Promise<number> {
	let deleted = 0;
	for (const key of await snapshots.list()) {
		const s = await snapshots.get(key);
		if (s && now - s.createdAt > maxAgeMs) {
			await snapshots.delete(key);
			await records.delete(key);
			deleted++;
		}
	}
	return deleted;
}
