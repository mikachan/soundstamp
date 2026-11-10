import { expect, test } from 'vitest';
import { cleanupSnapshots } from '#lib/server/cleanup';
import { memoryKV, type ArtistRecord } from '#lib/server/store/types';
import type { Snapshot } from '#lib/passport/types';
import { known, snapshot } from '../passport/fixtures';

const DAY = 24 * 3600 * 1000;

test('deletes snapshots older than 7 days and keeps newer ones', async () => {
	const kv = memoryKV<Snapshot>();
	const now = 30 * DAY;
	await kv.set('old', snapshot({ createdAt: now - 7 * DAY - 1 }));
	await kv.set('edge', snapshot({ createdAt: now - 7 * DAY + 1 }));
	await kv.set('fresh', snapshot({ createdAt: now - DAY }));

	expect(await cleanupSnapshots(kv, memoryKV(), now)).toBe(1);
	expect((await kv.list()).sort()).toEqual(['edge', 'fresh']);
});

test("deletes a stale user's records along with their snapshot", async () => {
	const snapshots = memoryKV<Snapshot>();
	const records = memoryKV<Record<string, ArtistRecord>>();
	await snapshots.set('old', snapshot({ createdAt: 0 }));
	await records.set('old', { 'mbid:x': known('IS') });
	await records.set('fresh', { 'mbid:x': known('IS') });
	await snapshots.set('fresh', snapshot({ createdAt: 30 * DAY }));
	await cleanupSnapshots(snapshots, records, 30 * DAY);
	expect(await records.list()).toEqual(['fresh']);
});

test('never touches the shared artist cache', async () => {
	const snapshots = memoryKV<Snapshot>();
	const artists = memoryKV<ArtistRecord>();
	await artists.set('mbid:x', known('IS'));
	await snapshots.set('old', snapshot({ createdAt: 0 }));
	await cleanupSnapshots(snapshots, memoryKV(), 30 * DAY);
	expect(await artists.get('mbid:x')).toEqual(known('IS'));
});
