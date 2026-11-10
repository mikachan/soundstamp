import { describe, expect, test } from 'vitest';
import { getSnapshot, loadRecords, pendingQueue, stampNextBatch } from '#lib/server/stamping';
import { LastfmUserNotFound } from '#lib/server/lastfm/client';
import { MusicBrainzUnavailable } from '#lib/server/musicbrainz/client';
import { ThrottleBusy } from '#lib/server/store/throttle';
import type { ArtistRecord } from '#lib/server/store/types';
import type { SimilarArtist } from '#lib/server/lastfm/types';
import { artist, known, snapshot } from '../passport/fixtures';
import { fakeDeps, fakeLastfm, fakeMusicBrainz } from './fakes';

const DAY = 24 * 3600 * 1000;
const sim = (name: string, match: number): SimilarArtist => ({ name, match, url: `u/${name}` });

describe('getSnapshot', () => {
	test('builds a snapshot from last.fm with 500 artists, 500 tracks and similar artists for the top 10', async () => {
		const artists = Array.from({ length: 12 }, (_, i) => artist(`A${i}`, 100 - i));
		const lastfm = fakeLastfm({ name: 'RJ', artists });
		const clock = { t: 5000 };
		const deps = fakeDeps(lastfm.client, fakeMusicBrainz({}, clock).client, clock);

		const s = await getSnapshot(deps, 'rj');

		expect(s.username).toBe('RJ');
		expect(s.createdAt).toBe(5000);
		expect(lastfm.calls.find((c) => c.method === 'getTopArtists')?.args).toEqual(['RJ', 500]);
		expect(lastfm.calls.find((c) => c.method === 'getTopTracks')?.args).toEqual(['RJ', 500]);
		expect(lastfm.calls.filter((c) => c.method === 'getSimilar').map((c) => c.args[0])).toEqual(
			artists.slice(0, 10).map((a) => a.name)
		);
		expect(await deps.snapshots.get('rj')).not.toBeNull();
	});

	test('reuses a snapshot under 24 hours old, keyed by lowercased username', async () => {
		const lastfm = fakeLastfm({ name: 'RJ' });
		const clock = { t: 0 };
		const deps = fakeDeps(lastfm.client, fakeMusicBrainz({}, clock).client, clock);
		await getSnapshot(deps, 'RJ');
		clock.t = DAY - 1;
		await getSnapshot(deps, 'rj');
		expect(lastfm.calls.filter((c) => c.method === 'getUser')).toHaveLength(1);
	});

	test('refetches after 24 hours or when refresh is requested', async () => {
		const lastfm = fakeLastfm({ name: 'RJ' });
		const clock = { t: 0 };
		const deps = fakeDeps(lastfm.client, fakeMusicBrainz({}, clock).client, clock);
		await getSnapshot(deps, 'rj');
		await getSnapshot(deps, 'rj', { refresh: true });
		clock.t = DAY;
		await getSnapshot(deps, 'rj');
		expect(lastfm.calls.filter((c) => c.method === 'getUser')).toHaveLength(3);
	});

	test('LastfmUserNotFound propagates unchanged', async () => {
		const clock = { t: 0 };
		const deps = fakeDeps(fakeLastfm({ missing: true }).client, fakeMusicBrainz({}, clock).client, clock);
		await expect(getSnapshot(deps, 'nobody')).rejects.toBeInstanceOf(LastfmUserNotFound);
	});

	test('picks up artist countries other users already resolved', async () => {
		const lastfm = fakeLastfm({ artists: [artist('Boris', 10, 'bo')] });
		const clock = { t: 0 };
		const deps = fakeDeps(lastfm.client, fakeMusicBrainz({}, clock).client, clock);
		await deps.artists.set('mbid:bo', known('JP'));
		const s = await getSnapshot(deps, 'rj');
		expect((await loadRecords(deps, s)).get('mbid:bo')?.country).toBe('JP');
	});
});

describe('pendingQueue', () => {
	test('orders own artists to 90% coverage, then candidates by match (max 50), then the rest', () => {
		const s = snapshot({
			artists: [artist('A', 500), artist('B', 300), artist('C', 150), artist('D', 50)],
			similar: [
				{ seed: 'A', artists: [sim('X', 0.5), sim('Y', 0.9), sim('B', 0.99)] },
				{ seed: 'B', artists: [sim('Y', 0.8), sim('Z', 0.7)] }
			]
		});
		const queue = pendingQueue(s, new Map());
		expect(queue.map((q) => q.name)).toEqual(['A', 'B', 'C', 'Y', 'Z', 'X', 'D']);
	});

	test('skips resolved artists and counts them towards coverage', () => {
		const s = snapshot({ artists: [artist('A', 500), artist('B', 400), artist('C', 100)] });
		const records = new Map<string, ArtistRecord>([['name:a', known('IS')]]);
		expect(pendingQueue(s, records).map((q) => q.name)).toEqual(['B', 'C']);
	});

	test('caps destination candidates at 50', () => {
		const candidates = Array.from({ length: 60 }, (_, i) => sim(`S${i}`, 1 - i / 100));
		const s = snapshot({ artists: [], similar: [{ seed: 'A', artists: candidates }] });
		expect(pendingQueue(s, new Map())).toHaveLength(50);
	});
});

describe('stampNextBatch', () => {
	function setup(answers: Record<string, string | null | Error>, names = ['A', 'B', 'C']) {
		const clock = { t: 0 };
		const lastfm = fakeLastfm({ artists: names.map((n, i) => artist(n, 100 - i)) });
		const mb = fakeMusicBrainz(answers, clock);
		return { deps: fakeDeps(lastfm.client, mb.client, clock), mb, clock };
	}

	test('resolves queue items in order and records each one', async () => {
		const { deps, mb } = setup({ A: 'IS', B: null, C: 'JP' });
		const result = await stampNextBatch(deps, 'rj', 8000);
		expect(mb.asked).toEqual(['A', 'B', 'C']);
		expect(result.status).toBe('ok');
		expect(result.remaining).toBe(0);
		expect(await deps.artists.get('name:a')).toEqual({ country: 'IS', resolvedAt: 1000 });
		expect(await deps.artists.get('name:b')).toEqual({ country: null, resolvedAt: 2000 });
		expect(result.passport.stamps.map((st) => st.country)).toEqual(['IS', 'JP']);
	});

	test('stops when the time budget is used up', async () => {
		const { deps, mb } = setup({ A: 'IS', B: 'GB', C: 'JP' });
		const result = await stampNextBatch(deps, 'rj', 2000);
		expect(mb.asked).toEqual(['A', 'B']);
		expect(result).toMatchObject({ status: 'ok', remaining: 1 });
	});

	test('MusicBrainzUnavailable stops the batch without recording that artist', async () => {
		const { deps } = setup({ A: 'IS', B: new MusicBrainzUnavailable('503') });
		const result = await stampNextBatch(deps, 'rj', 8000);
		expect(result).toMatchObject({ status: 'unavailable', remaining: 2 });
		expect(await deps.artists.get('name:a')).not.toBeNull();
		expect(await deps.artists.get('name:b')).toBeNull();
	});

	test('ThrottleBusy returns queued', async () => {
		const { deps } = setup({ A: new ThrottleBusy('busy') });
		const result = await stampNextBatch(deps, 'rj', 8000);
		expect(result).toMatchObject({ status: 'queued', remaining: 3 });
	});

	test('uses the shared artist cache instead of asking MusicBrainz again', async () => {
		const { deps, mb } = setup({ B: 'GB', C: 'JP' });
		await getSnapshot(deps, 'rj');
		await deps.artists.set('name:a', known('IS'));
		const result = await stampNextBatch(deps, 'rj', 8000);
		expect(mb.asked).toEqual(['B', 'C']);
		expect(result.passport.stamps).toHaveLength(3);
	});

	test('progress persists between batches', async () => {
		const { deps, mb } = setup({ A: 'IS', B: 'GB', C: 'JP' });
		await stampNextBatch(deps, 'rj', 1000);
		const second = await stampNextBatch(deps, 'rj', 8000);
		expect(mb.asked).toEqual(['A', 'B', 'C']);
		expect(second.remaining).toBe(0);
	});
});
