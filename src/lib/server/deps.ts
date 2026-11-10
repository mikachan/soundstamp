import type { Snapshot } from '../passport/types';
import { createLastfmClient } from './lastfm/client';
import { createMusicBrainzClient } from './musicbrainz/client';
import type { StampingDeps } from './stamping';
import { blobsKV } from './store/blobs';
import { createThrottle } from './store/throttle';
import type { ArtistRecord } from './store/types';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createDeps(env: { LASTFM_API_KEY?: string; MB_CONTACT?: string }): StampingDeps {
	if (!env.LASTFM_API_KEY || !env.MB_CONTACT) {
		throw new Error('LASTFM_API_KEY and MB_CONTACT must be set');
	}
	const throttle = createThrottle({ kv: blobsKV<number>('meta'), now: Date.now, sleep });
	return {
		lastfm: createLastfmClient({ apiKey: env.LASTFM_API_KEY, fetch }),
		mb: createMusicBrainzClient({ fetch, contact: env.MB_CONTACT, beforeRequest: throttle.wait }),
		artists: blobsKV<ArtistRecord>('artists'),
		snapshots: blobsKV<Snapshot>('snapshots'),
		now: Date.now
	};
}
