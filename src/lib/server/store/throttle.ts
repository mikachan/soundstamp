import type { KV } from './types';

const NEXT_KEY = 'mb-next';

export class ThrottleBusy extends Error {}

/**
 * Site-wide spacing for MusicBrainz requests. Each caller reserves the next free
 * slot in the shared store, then sleeps until it. Not race-proof across instances,
 * so the MusicBrainz client still backs off on 503s.
 */
export function createThrottle(opts: {
	kv: KV<number>;
	now: () => number;
	sleep: (ms: number) => Promise<void>;
	intervalMs?: number;
	maxWaitMs?: number;
}) {
	const intervalMs = opts.intervalMs ?? 1100;
	const maxWaitMs = opts.maxWaitMs ?? 2000;

	return {
		async wait(): Promise<void> {
			const now = opts.now();
			const next = (await opts.kv.get(NEXT_KEY)) ?? 0;
			const waitMs = Math.max(0, next - now);
			if (waitMs > maxWaitMs) throw new ThrottleBusy(`MusicBrainz queue busy for ${waitMs} ms`);

			await opts.kv.set(NEXT_KEY, Math.max(now, next) + intervalMs);
			if (waitMs > 0) await opts.sleep(waitMs);
		}
	};
}
