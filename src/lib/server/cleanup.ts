import type { Snapshot } from '../passport/types';
import type { KV } from './store/types';

const WEEK_MS = 7 * 24 * 3600 * 1000;

/** Delete stored last.fm snapshots older than `maxAgeMs`, keeping us under last.fm's storage cap. */
export async function cleanupSnapshots(kv: KV<Snapshot>, now: number, maxAgeMs = WEEK_MS): Promise<number> {
	let deleted = 0;
	for (const key of await kv.list()) {
		const s = await kv.get(key);
		if (s && now - s.createdAt > maxAgeMs) {
			await kv.delete(key);
			deleted++;
		}
	}
	return deleted;
}
