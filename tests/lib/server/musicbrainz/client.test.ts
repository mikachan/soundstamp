import { describe, expect, test } from 'vitest';
import {
	createMusicBrainzClient,
	DeadlineReached,
	MusicBrainzUnavailable
} from '#lib/server/musicbrainz/client';

type Route = { status?: number; body?: unknown; throws?: boolean };

/** Fake fetch keyed by path + search (e.g. "/ws/2/artist/abc?fmt=json"). */
function setup(routes: Record<string, Route>) {
	const requests: { url: URL; userAgent: string | null }[] = [];
	let beforeCalls = 0;
	const fetch = (async (input: string | URL, init?: RequestInit) => {
		const url = new URL(input.toString());
		requests.push({ url, userAgent: new Headers(init?.headers).get('User-Agent') });
		const route = routes[decodeURIComponent(url.pathname + url.search)];
		if (!route) return new Response('{}', { status: 404 });
		if (route.throws) throw new TypeError('fetch failed');
		return new Response(JSON.stringify(route.body ?? {}), { status: route.status ?? 200 });
	}) as typeof globalThis.fetch;
	const mb = createMusicBrainzClient({
		fetch,
		contact: 'https://example.com/contact',
		beforeRequest: async () => {
			beforeCalls++;
		}
	});
	return { mb, requests, beforeCalls: () => beforeCalls };
}

const search = (name: string) => `/ws/2/artist?query=artist:"${name}"&limit=5&fmt=json`;

describe('lookup by MBID', () => {
	test('returns the artist country and sends the Soundstamp User-Agent', async () => {
		const { mb, requests } = setup({
			'/ws/2/artist/sr-1?fmt=json': { body: { name: 'Sigur Rós', country: 'IS' } }
		});
		expect(await mb.resolveArtistCountry({ name: 'Sigur Rós', mbid: 'sr-1' })).toBe('IS');
		expect(requests[0].url.origin).toBe('https://musicbrainz.org');
		expect(requests[0].userAgent).toBe('Soundstamp/0.1 ( https://example.com/contact )');
	});

	test('pseudo-country XW resolves to null', async () => {
		const { mb } = setup({ '/ws/2/artist/w?fmt=json': { body: { country: 'XW' } } });
		expect(await mb.resolveArtistCountry({ name: 'Global', mbid: 'w' })).toBeNull();
	});
});

describe('area fallback', () => {
	test('walks "part of" relations up to an area with an ISO 3166-1 code', async () => {
		const { mb, beforeCalls } = setup({
			'/ws/2/artist/c-1?fmt=json': { body: { country: null, area: { id: 'glasgow' } } },
			'/ws/2/area/glasgow?inc=area-rels&fmt=json': {
				body: {
					relations: [{ type: 'part of', direction: 'backward', area: { id: 'scotland' } }]
				}
			},
			'/ws/2/area/scotland?inc=area-rels&fmt=json': {
				body: {
					relations: [
						{ type: 'part of', direction: 'forward', area: { id: 'glasgow' } },
						{ type: 'part of', direction: 'backward', area: { id: 'uk', 'iso-3166-1-codes': ['GB'] } }
					]
				}
			}
		});
		expect(await mb.resolveArtistCountry({ name: 'CHVRCHES', mbid: 'c-1' })).toBe('GB');
		expect(beforeCalls()).toBe(3);
	});

	test('uses ISO codes already on the artist area without extra requests', async () => {
		const { mb, beforeCalls } = setup({
			'/ws/2/artist/a?fmt=json': { body: { area: { id: 'x', 'iso-3166-1-codes': ['JP'] } } }
		});
		expect(await mb.resolveArtistCountry({ name: 'Boris', mbid: 'a' })).toBe('JP');
		expect(beforeCalls()).toBe(1);
	});

	test('gives up after 3 area hops', async () => {
		const chain = (id: string, parent: string): Route => ({
			body: { relations: [{ type: 'part of', direction: 'backward', area: { id: parent } }] }
		});
		const { mb, requests } = setup({
			'/ws/2/artist/deep?fmt=json': { body: { area: { id: 'a1' } } },
			'/ws/2/area/a1?inc=area-rels&fmt=json': chain('a1', 'a2'),
			'/ws/2/area/a2?inc=area-rels&fmt=json': chain('a2', 'a3'),
			'/ws/2/area/a3?inc=area-rels&fmt=json': chain('a3', 'a4'),
			'/ws/2/area/a4?inc=area-rels&fmt=json': {
				body: { 'iso-3166-1-codes': ['FR'], relations: [] }
			}
		});
		expect(await mb.resolveArtistCountry({ name: 'Deep', mbid: 'deep' })).toBeNull();
		expect(requests).toHaveLength(4);
	});
});

describe('name search', () => {
	test('stale MBID (404) falls back to an exact name search', async () => {
		const { mb } = setup({
			'/ws/2/artist/stale?fmt=json': { status: 404, body: { error: 'Not Found' } },
			[search('Múm')]: { body: { artists: [{ name: 'múm', score: 100, country: 'IS' }] } }
		});
		expect(await mb.resolveArtistCountry({ name: 'Múm', mbid: 'stale' })).toBe('IS');
	});

	test('no MBID goes straight to search', async () => {
		const { mb, requests } = setup({
			[search('Boris')]: { body: { artists: [{ name: 'Boris', score: 100, country: 'JP' }] } }
		});
		expect(await mb.resolveArtistCountry({ name: 'Boris' })).toBe('JP');
		expect(requests).toHaveLength(1);
	});

	test('rejects a top result below score 100', async () => {
		const { mb } = setup({
			[search('Boris')]: { body: { artists: [{ name: 'Boris', score: 98, country: 'JP' }] } }
		});
		expect(await mb.resolveArtistCountry({ name: 'Boris' })).toBeNull();
	});

	test('rejects a top result with a different name', async () => {
		const { mb } = setup({
			[search('Boris')]: { body: { artists: [{ name: 'Boris Brejcha', score: 100, country: 'DE' }] } }
		});
		expect(await mb.resolveArtistCountry({ name: 'Boris' })).toBeNull();
	});

	test('no results resolves to null', async () => {
		const { mb } = setup({ [search('Nobody')]: { body: { artists: [] } } });
		expect(await mb.resolveArtistCountry({ name: 'Nobody' })).toBeNull();
	});
});

describe('failures', () => {
	test('503 throws MusicBrainzUnavailable', async () => {
		const { mb } = setup({ '/ws/2/artist/x?fmt=json': { status: 503 } });
		await expect(mb.resolveArtistCountry({ name: 'X', mbid: 'x' })).rejects.toBeInstanceOf(
			MusicBrainzUnavailable
		);
	});

	test('503 during an area hop throws MusicBrainzUnavailable', async () => {
		const { mb } = setup({
			'/ws/2/artist/x?fmt=json': { body: { area: { id: 'a1' } } },
			'/ws/2/area/a1?inc=area-rels&fmt=json': { status: 503 }
		});
		await expect(mb.resolveArtistCountry({ name: 'X', mbid: 'x' })).rejects.toBeInstanceOf(
			MusicBrainzUnavailable
		);
	});

	test('network failure throws MusicBrainzUnavailable', async () => {
		const { mb } = setup({ [search('X')]: { throws: true } });
		await expect(mb.resolveArtistCountry({ name: 'X' })).rejects.toBeInstanceOf(
			MusicBrainzUnavailable
		);
	});

	test('errors from beforeRequest propagate unchanged', async () => {
		class Busy extends Error {}
		const mb = createMusicBrainzClient({
			fetch: globalThis.fetch,
			contact: 'c',
			beforeRequest: async () => {
				throw new Busy();
			}
		});
		await expect(mb.resolveArtistCountry({ name: 'X' })).rejects.toBeInstanceOf(Busy);
	});
});

describe('review fixes', () => {
	test('ambiguous exact-name matches resolve to null', async () => {
		const { mb } = setup({
			[search('Nirvana')]: {
				body: {
					artists: [
						{ name: 'Nirvana', score: 100, country: 'US' },
						{ name: 'Nirvana', score: 100, country: 'GB' }
					]
				}
			}
		});
		expect(await mb.resolveArtistCountry({ name: 'Nirvana' })).toBeNull();
	});

	test.each([429, 408])('%i throws MusicBrainzUnavailable instead of caching unknown', async (status) => {
		const { mb } = setup({ '/ws/2/artist/x?fmt=json': { status } });
		await expect(mb.resolveArtistCountry({ name: 'X', mbid: 'x' })).rejects.toBeInstanceOf(
			MusicBrainzUnavailable
		);
	});

	test('a request that could run past the deadline throws DeadlineReached before sending', async () => {
		let t = 10_000;
		const requests: string[] = [];
		const mb = createMusicBrainzClient({
			fetch: (async (u: string | URL) => {
				requests.push(u.toString());
				return Response.json({ area: { id: 'a1' } });
			}) as typeof fetch,
			contact: 'c',
			beforeRequest: async () => {
				t += 1000;
			},
			now: () => t
		});
		await expect(
			mb.resolveArtistCountry({ name: 'X', mbid: 'x' }, { deadline: 12_500 })
		).rejects.toBeInstanceOf(DeadlineReached);
		expect(requests).toHaveLength(0);
	});
});
