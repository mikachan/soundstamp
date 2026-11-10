import { describe, expect, test } from 'vitest';
import { getSnapshot, loadRecords, pendingQueue, stampNextBatch } from '#lib/server/stamping';
import { LastfmUserNotFound } from '#lib/server/lastfm/client';
import { DeadlineReached, MusicBrainzUnavailable } from '#lib/server/musicbrainz/client';
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
		expect(lastfm.calls.find((c) => c.method === 'getTopArtists')?.args).toEqual(['RJ', 500, '12month']);
		expect(lastfm.calls.find((c) => c.method === 'getTopTracks')?.args).toEqual(['RJ', 500, '12month']);
		expect(lastfm.calls.filter((c) => c.method === 'getSimilar').map((c) => c.args[0])).toEqual(
			artists.slice(0, 10).map((a) => a.name)
		);
		expect(await deps.snapshots.get('rj:12month')).not.toBeNull();
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

	test('caps destination candidates at 200', () => {
		const candidates = Array.from({ length: 250 }, (_, i) => sim(`S${i}`, 1 - i / 1000));
		const s = snapshot({ artists: [], similar: [{ seed: 'A', artists: candidates }] });
		expect(pendingQueue(s, new Map())).toHaveLength(200);
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

describe('review fixes', () => {
	function setup(answers: Parameters<typeof fakeMusicBrainz>[0], names = ['A', 'B', 'C']) {
		const clock = { t: 0 };
		const lastfm = fakeLastfm({ artists: names.map((n, i) => artist(n, 100 - i)) });
		const mb = fakeMusicBrainz(answers, clock);
		return { deps: fakeDeps(lastfm.client, mb.client, clock), mb, clock, lastfm };
	}

	test('an item that fails unexpectedly is marked unknown for this user and the queue moves on', async () => {
		const { deps, mb } = setup({ A: 'IS', B: new Error('blob key too long'), C: 'JP' });
		const result = await stampNextBatch(deps, 'rj', 8000);
		expect(mb.asked).toEqual(['A', 'B', 'C']);
		expect(result).toMatchObject({ status: 'ok', remaining: 0 });
		expect(result.passport.unknownArtists).toBe(1);
		expect(await deps.artists.get('name:b')).toBeNull();
	});

	test('DeadlineReached ends the batch as ok without recording the item', async () => {
		const { deps } = setup({ A: new DeadlineReached('late') });
		const result = await stampNextBatch(deps, 'rj', 8000);
		expect(result).toMatchObject({ status: 'ok', remaining: 3 });
		expect(await deps.artists.get('name:a')).toBeNull();
	});

	test('passes an absolute deadline of batch start + budget', async () => {
		const { deps, mb, clock } = setup({ A: 'IS', B: 'GB', C: 'JP' });
		await getSnapshot(deps, 'rj');
		clock.t = 50_000;
		await stampNextBatch(deps, 'rj', 5000);
		expect(mb.deadlines).toEqual([55_000, 55_000, 55_000]);
	});

	test('a refresh during a batch is not overwritten by the batch', async () => {
		const clock = { t: 0 };
		const lastfm = fakeLastfm({ artists: [artist('A', 2), artist('B', 1)] });
		let deps!: ReturnType<typeof fakeDeps>;
		const mb = fakeMusicBrainz(
			{
				A: async () => {
					clock.t = 99_000;
					await getSnapshot(deps, 'rj', { refresh: true });
					return 'IS';
				}
			},
			clock
		);
		deps = fakeDeps(lastfm.client, mb.client, clock);
		await stampNextBatch(deps, 'rj', 8000);
		expect((await deps.snapshots.get('rj:12month'))?.createdAt).toBe(99_000);
	});

	test('records written by another batch meanwhile are kept', async () => {
		let deps!: ReturnType<typeof fakeDeps>;
		const clock = { t: 0 };
		const mb = fakeMusicBrainz(
			{
				A: async () => {
					const theirs = (await deps.records.get('rj:12month')) ?? {};
					await deps.records.set('rj:12month', { ...theirs, 'name:b': known('GB') });
					return 'IS';
				}
			},
			clock
		);
		deps = fakeDeps(fakeLastfm({ artists: [artist('A', 2), artist('B', 1)] }).client, mb.client, clock);
		await stampNextBatch(deps, 'rj', 1000);
		const stored = await deps.records.get('rj:12month');
		expect(Object.keys(stored ?? {}).sort()).toEqual(['name:a', 'name:b']);
	});
});

describe('batched lookups', () => {
	function setup(bulk: Record<string, string | null> | Error, answers: Parameters<typeof fakeMusicBrainz>[0] = {}) {
		const clock = { t: 0 };
		const lastfm = fakeLastfm({
			artists: [artist('A', 50, 'a'), artist('B', 30, 'b'), artist('C', 15, 'c'), artist('NoId', 5)]
		});
		const mb = fakeMusicBrainz(answers, clock, 1000, bulk);
		return { deps: fakeDeps(lastfm.client, mb.client, clock), mb };
	}

	test('resolves MBID artists in one bulk request, then the rest one by one', async () => {
		const { deps, mb } = setup({ a: 'IS', b: null }, { C: 'GB', NoId: 'JP' });
		const result = await stampNextBatch(deps, 'rj', 8000);
		expect(mb.bulkCalls).toEqual([['a', 'b', 'c']]);
		expect(mb.asked).toEqual(['C', 'NoId']);
		expect(await deps.artists.get('mbid:a')).toEqual({ country: 'IS', resolvedAt: 1000 });
		expect(await deps.artists.get('mbid:b')).toEqual({ country: null, resolvedAt: 1000 });
		expect(result).toMatchObject({ status: 'ok', remaining: 0 });
	});

	test('skips artists already in the shared cache when building the bulk request', async () => {
		const { deps, mb } = setup({ b: 'GB', c: 'SE' }, { NoId: 'JP' });
		await deps.artists.set('mbid:a', known('IS'));
		await stampNextBatch(deps, 'rj', 8000);
		expect(mb.bulkCalls).toEqual([['b', 'c']]);
	});

	test('a bulk failure ends the batch with the matching status', async () => {
		const { deps, mb } = setup(new MusicBrainzUnavailable('503'));
		const result = await stampNextBatch(deps, 'rj', 8000);
		expect(result).toMatchObject({ status: 'unavailable', remaining: 4 });
		expect(mb.asked).toEqual([]);
	});
});

test('does not repeat a bulk request for MBIDs it could not answer', async () => {
	const clock = { t: 0 };
	const lastfm = fakeLastfm({ artists: [artist('A', 50, 'a'), artist('B', 30, 'b')] });
	// Bulk can't answer B (it needs an area walk); the individual lookup is slow, so B stays pending.
	const mb = fakeMusicBrainz({ B: new DeadlineReached('late') }, clock, 1000, { a: 'IS' });
	const deps = fakeDeps(lastfm.client, mb.client, clock);
	await stampNextBatch(deps, 'rj', 8000);
	await stampNextBatch(deps, 'rj', 8000);
	expect(mb.bulkCalls).toEqual([['a', 'b']]);
	expect(mb.asked).toEqual(['B', 'B']);
});

describe('periods', () => {
	test('defaults to the last 12 months and stores each period separately', async () => {
		const lastfm = fakeLastfm({ name: 'RJ', artists: [artist('A', 1)] });
		const clock = { t: 0 };
		const deps = fakeDeps(lastfm.client, fakeMusicBrainz({}, clock).client, clock);

		const year = await getSnapshot(deps, 'rj');
		const ever = await getSnapshot(deps, 'rj', { period: 'overall' });

		expect(year.period).toBe('12month');
		expect(ever.period).toBe('overall');
		const periods = lastfm.calls.filter((c) => c.method === 'getTopArtists').map((c) => c.args[2]);
		expect(periods).toEqual(['12month', 'overall']);
		expect((await deps.snapshots.list()).sort()).toEqual(['rj:12month', 'rj:overall']);
	});

	test('stampNextBatch works on the requested period', async () => {
		const lastfm = fakeLastfm({ name: 'RJ', artists: [artist('A', 1)] });
		const clock = { t: 0 };
		const deps = fakeDeps(lastfm.client, fakeMusicBrainz({ A: 'IS' }, clock).client, clock);
		const result = await stampNextBatch(deps, 'rj', 8000, '1month');
		expect(result.passport.stamps.map((st) => st.country)).toEqual(['IS']);
		expect(await deps.snapshots.get('rj:1month')).not.toBeNull();
	});
});

describe('next destination checks', () => {
	test('stores the full listening history as normalised names', async () => {
		const lastfm = fakeLastfm({ name: 'RJ', artists: [artist('A', 1)], heard: ['A', ' Hyde  '] });
		const clock = { t: 0 };
		const deps = fakeDeps(lastfm.client, fakeMusicBrainz({}, clock).client, clock);
		const s = await getSnapshot(deps, 'rj');
		expect(s.heard).toEqual(['a', 'hyde']);
		expect(lastfm.calls.find((c) => c.method === 'getHeardArtistNames')?.args).toEqual(['RJ', 5]);
	});

	test('checks name sharing for the top candidates and records it in the shared cache', async () => {
		const clock = { t: 0 };
		const lastfm = fakeLastfm({
			artists: [artist('Seed', 10, 'seed')],
			similar: {
				Seed: [
					{ name: 'Hyde', mbid: 'hy', match: 0.9, url: 'u/hyde' },
					{ name: 'Kerli', mbid: 'ke', match: 0.8, url: 'u/kerli' }
				]
			}
		});
		const mb = fakeMusicBrainz({}, clock, 1000, { seed: 'JP', hy: 'BR', ke: 'EE' }, ['Hyde']);
		const deps = fakeDeps(lastfm.client, mb.client, clock);

		const result = await stampNextBatch(deps, 'rj', 8000);

		expect(mb.nameChecks).toEqual(['Hyde', 'Kerli']);
		expect((await deps.artists.get('mbid:hy'))?.sharedName).toBe(true);
		expect((await deps.artists.get('mbid:ke'))?.sharedName).toBe(false);
		expect(result.passport.destinations.map((d) => d.artist.name)).toEqual(['Kerli']);
		expect(result.remaining).toBe(0);
	});
});

test('snapshots saved before listening history was stored are refetched', async () => {
	const lastfm = fakeLastfm({ name: 'RJ', heard: ['A'] });
	const clock = { t: 1000 };
	const deps = fakeDeps(lastfm.client, fakeMusicBrainz({}, clock).client, clock);
	const legacy = snapshot({ username: 'RJ', createdAt: 900 }) as Partial<ReturnType<typeof snapshot>>;
	delete legacy.heard;
	await deps.snapshots.set('rj:12month', legacy as ReturnType<typeof snapshot>);
	expect((await getSnapshot(deps, 'rj')).heard).toEqual(['a']);
});

test('destination candidates the user has already heard are never looked up', () => {
	const s = snapshot({
		artists: [artist('A', 10)],
		similar: [{ seed: 'A', artists: [sim('Heard Before', 0.99), sim('New One', 0.5)] }],
		heard: ['heard before']
	});
	expect(pendingQueue(s, new Map([['name:a', known('IS')]])).map((q) => q.name)).toEqual(['New One']);
});
