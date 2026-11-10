import type { Snapshot } from '../passport/types';
import { createLastfmClient } from './lastfm/client';
import { createMusicBrainzClient } from './musicbrainz/client';
import type { StampingDeps } from './stamping';
import { blobsKV } from './store/blobs';
import { createThrottle } from './store/throttle';
import type { ArtistRecord } from './store/types';

const BUSY_COOLDOWN_MS = 3000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createDeps(env: { LASTFM_API_KEY?: string; MB_CONTACT?: string }): StampingDeps {
	if (!env.LASTFM_API_KEY || !env.MB_CONTACT) {
		throw new Error('LASTFM_API_KEY and MB_CONTACT must be set');
	}
	const throttle = createThrottle({ kv: blobsKV<number>('meta'), now: Date.now, sleep });
	return {
		lastfm: createLastfmClient({ apiKey: env.LASTFM_API_KEY, fetch }),
		mb: createMusicBrainzClient({
			fetch,
			contact: env.MB_CONTACT,
			beforeRequest: throttle.wait,
			onBusy: () => throttle.cooldown(BUSY_COOLDOWN_MS),
			areas: blobsKV<{ country: string | null }>('areas')
		}),
		artists: blobsKV<ArtistRecord>('artists'),
		snapshots: blobsKV<Snapshot>('snapshots'),
		records: blobsKV<Record<string, ArtistRecord>>('records'),
		bulkMisses: new Set(),
		now: Date.now
	};
}
