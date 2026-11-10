import { cleanupSnapshots } from '../../src/lib/server/cleanup.ts';
import { blobsKV } from '../../src/lib/server/store/blobs.ts';
import type { Snapshot } from '../../src/lib/passport/types.ts';
import type { ArtistRecord } from '../../src/lib/server/store/types.ts';

export default async () => {
	const deleted = await cleanupSnapshots(
		blobsKV<Snapshot>('snapshots'),
		blobsKV<Record<string, ArtistRecord>>('records'),
		Date.now()
	);
	console.log(`cleanup: deleted ${deleted} stale snapshots`);
};

export const config = { schedule: '@daily' };
