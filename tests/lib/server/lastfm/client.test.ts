import { describe, expect, test } from 'vitest';
import {
	createLastfmClient,
	LastfmPrivateProfile,
	LastfmUnavailable,
	LastfmUserNotFound
} from '#lib/server/lastfm/client';
import userinfo from '../../../fixtures/lastfm/userinfo.json';
import topartists from '../../../fixtures/lastfm/topartists.json';
import emptyTopartists from '../../../fixtures/lastfm/empty-topartists.json';
import toptracks from '../../../fixtures/lastfm/toptracks.json';
import similar from '../../../fixtures/lastfm/similar.json';
import error6 from '../../../fixtures/lastfm/error6.json';

function fakeFetch(body: unknown, status = 200) {
	const calls: URL[] = [];
	const fetch = (async (input: string | URL) => {
		calls.push(new URL(input.toString()));
		return new Response(JSON.stringify(body), { status });
	}) as typeof globalThis.fetch;
	return { fetch, calls };
}

function client(body: unknown, status = 200) {
	const f = fakeFetch(body, status);
	return { lastfm: createLastfmClient({ apiKey: 'KEY', fetch: f.fetch }), calls: f.calls };
}

describe('request URL', () => {
	test('targets the 2.0 API with method, user, key, json format and limit', async () => {
		const { lastfm, calls } = client(topartists);
		await lastfm.getTopArtists('RJ', 500);
		const url = calls[0];
		expect(url.origin + url.pathname).toBe('https://ws.audioscrobbler.com/2.0/');
		expect(url.searchParams.get('method')).toBe('user.gettopartists');
		expect(url.searchParams.get('user')).toBe('RJ');
		expect(url.searchParams.get('api_key')).toBe('KEY');
		expect(url.searchParams.get('format')).toBe('json');
		expect(url.searchParams.get('limit')).toBe('500');
		expect(url.searchParams.get('period')).toBe('overall');
	});
});

test('getUser maps registration year and numeric playcount', async () => {
	const { lastfm } = client(userinfo);
	expect(await lastfm.getUser('rj')).toEqual({
		name: 'RJ',
		url: 'https://www.last.fm/user/RJ',
		registeredYear: 2002,
		playcount: 150316
	});
});

test('getTopArtists parses numbers and drops empty mbids', async () => {
	const { lastfm } = client(topartists);
	expect(await lastfm.getTopArtists('RJ', 500)).toEqual([
		{
			name: 'Sigur Rós',
			mbid: 'f6f2326f-6b25-4170-b89d-e235b25508e8',
			playcount: 400,
			url: 'https://www.last.fm/music/Sigur+R%C3%B3s'
		},
		{
			name: 'Some Local Band',
			mbid: undefined,
			playcount: 12,
			url: 'https://www.last.fm/music/Some+Local+Band'
		}
	]);
});

test('top artists and tracks use the requested period', async () => {
	const a = client(topartists);
	await a.lastfm.getTopArtists('RJ', 500, '3month');
	expect(a.calls[0].searchParams.get('period')).toBe('3month');
	const t = client(toptracks);
	await t.lastfm.getTopTracks('RJ', 500, '7day');
	expect(t.calls[0].searchParams.get('period')).toBe('7day');
});

test('getTopArtists returns [] for a user with no artists', async () => {
	const { lastfm } = client(emptyTopartists);
	expect(await lastfm.getTopArtists('newbie', 500)).toEqual([]);
});

test('getTopTracks maps track and artist', async () => {
	const { lastfm, calls } = client(toptracks);
	expect(await lastfm.getTopTracks('RJ', 500)).toEqual([
		{
			name: 'Hoppípolla',
			url: 'https://www.last.fm/music/Sigur+R%C3%B3s/_/Hopp%C3%ADpolla',
			playcount: 50,
			artist: { name: 'Sigur Rós', mbid: 'f6f2326f-6b25-4170-b89d-e235b25508e8' }
		}
	]);
	expect(calls[0].searchParams.get('method')).toBe('user.gettoptracks');
});

describe('getSimilar', () => {
	test('uses mbid when present', async () => {
		const { lastfm, calls } = client(similar);
		const result = await lastfm.getSimilar({ name: 'Sigur Rós', mbid: 'abc' }, 20);
		expect(calls[0].searchParams.get('method')).toBe('artist.getsimilar');
		expect(calls[0].searchParams.get('mbid')).toBe('abc');
		expect(calls[0].searchParams.get('artist')).toBeNull();
		expect(calls[0].searchParams.get('autocorrect')).toBe('1');
		expect(result[0]).toEqual({
			name: 'Múm',
			mbid: '0b1a1f2e-0000-4000-8000-000000000001',
			match: 0.92,
			url: 'https://www.last.fm/music/M%C3%BAm'
		});
		expect(result[1].mbid).toBeUndefined();
	});

	test('falls back to artist name', async () => {
		const { lastfm, calls } = client(similar);
		await lastfm.getSimilar({ name: 'Sigur Rós' }, 20);
		expect(calls[0].searchParams.get('artist')).toBe('Sigur Rós');
		expect(calls[0].searchParams.get('mbid')).toBeNull();
	});
});

describe('errors', () => {
	test('error 6 throws LastfmUserNotFound', async () => {
		const { lastfm } = client(error6, 404);
		await expect(lastfm.getUser('nobody')).rejects.toBeInstanceOf(LastfmUserNotFound);
	});

	test('5xx throws LastfmUnavailable', async () => {
		const { lastfm } = client({ message: 'oops' }, 503);
		await expect(lastfm.getUser('rj')).rejects.toBeInstanceOf(LastfmUnavailable);
	});

	test('other API error codes throw LastfmUnavailable', async () => {
		const { lastfm } = client({ error: 29, message: 'Rate limit exceeded' }, 200);
		await expect(lastfm.getUser('rj')).rejects.toBeInstanceOf(LastfmUnavailable);
	});

	test('network failure throws LastfmUnavailable', async () => {
		const fetch = (async () => {
			throw new TypeError('fetch failed');
		}) as typeof globalThis.fetch;
		const lastfm = createLastfmClient({ apiKey: 'KEY', fetch });
		await expect(lastfm.getUser('rj')).rejects.toBeInstanceOf(LastfmUnavailable);
	});
});

test('error 17 (private profile) throws LastfmPrivateProfile', async () => {
	const { lastfm } = client({ error: 17, message: 'Login: User required to be logged in' }, 403);
	await expect(lastfm.getTopArtists('shy', 500)).rejects.toBeInstanceOf(LastfmPrivateProfile);
});
