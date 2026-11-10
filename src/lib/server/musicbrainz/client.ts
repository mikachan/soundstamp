import { isRealCountry } from '../../geo/countries';
import { normaliseName } from '../artist-key';
import type { KV } from '../store/types';

const API_ROOT = 'https://musicbrainz.org/ws/2';
const MAX_AREA_HOPS = 3;
/** MusicBrainz search returns at most 100 results per request. */
export const BULK_LIMIT = 100;
/** Worst-case time one request can take: a full throttle wait plus the round trip. */
const REQUEST_RESERVE_MS = 3000;

export class MusicBrainzUnavailable extends Error {}
/** The caller's deadline would pass before the next request could finish. */
export class DeadlineReached extends Error {}

interface Area {
	id: string;
	'iso-3166-1-codes'?: string[];
	relations?: { type: string; direction: string; area?: Area }[];
}

/** A real country code, null for codes that aren't real countries, undefined when there are no codes. */
function countryFromCodes(codes: string[] | undefined): string | null | undefined {
	if (!codes?.length) return undefined;
	return codes.find(isRealCountry) ?? null;
}

const sameName = (a: string, b: string) => normaliseName(a) === normaliseName(b);

const escapeLucene = (s: string) => s.replace(/["\\]/g, '\\$&');

export function createMusicBrainzClient(opts: {
	fetch: typeof fetch;
	contact: string;
	beforeRequest: () => Promise<void>;
	now?: () => number;
	/** Shared area id → country cache; many artists share a city. */
	areas?: KV<{ country: string | null }>;
}) {
	const userAgent = `Soundstamp/0.1 ( ${opts.contact} )`;
	const now = opts.now ?? Date.now;

	/** GET a ws/2 path. Returns null for 404 and other permanent 4xx errors. */
	async function get(path: string, params: Record<string, string>, deadline: number): Promise<any> {
		if (now() + REQUEST_RESERVE_MS > deadline) throw new DeadlineReached(path);
		// Throttle errors (e.g. ThrottleBusy) must reach the caller unchanged.
		await opts.beforeRequest();

		const url = new URL(API_ROOT + path);
		url.search = new URLSearchParams({ ...params, fmt: 'json' }).toString();
		let response: Response;
		try {
			response = await opts.fetch(url, {
				headers: { 'User-Agent': userAgent, Accept: 'application/json' }
			});
		} catch (cause) {
			throw new MusicBrainzUnavailable(`MusicBrainz request failed: ${path}`, { cause });
		}
		// 408/429 are transient: retrying later may succeed, so never cache them as unknown.
		if (response.status >= 500 || response.status === 408 || response.status === 429) {
			throw new MusicBrainzUnavailable(`MusicBrainz returned ${response.status}: ${path}`);
		}
		if (!response.ok) return null;
		try {
			return await response.json();
		} catch (cause) {
			throw new MusicBrainzUnavailable(`MusicBrainz sent invalid JSON: ${path}`, { cause });
		}
	}

	async function countryFromArea(start: Area, deadline: number): Promise<string | null> {
		const direct = countryFromCodes(start['iso-3166-1-codes']);
		if (direct !== undefined) return direct;
		const cached = await opts.areas?.get(start.id);
		if (cached) return cached.country;
		const country = await walkArea(start, deadline);
		await opts.areas?.set(start.id, { country });
		return country;
	}

	async function walkArea(start: Area, deadline: number): Promise<string | null> {
		let area = start;
		for (let hops = 0; ; hops++) {
			const code = countryFromCodes(area['iso-3166-1-codes']);
			if (code !== undefined) return code;
			if (hops === MAX_AREA_HOPS) return null;

			const detail: Area | null = await get(`/area/${area.id}`, { inc: 'area-rels' }, deadline);
			if (!detail) return null;
			const own = countryFromCodes(detail['iso-3166-1-codes']);
			if (own !== undefined) return own;

			const parent = detail.relations?.find(
				(r) => r.type === 'part of' && r.direction === 'backward' && r.area
			)?.area;
			if (!parent) return null;
			area = parent;
		}
	}

	async function countryFromArtist(
		artist: { country?: string | null; area?: Area | null },
		deadline: number
	): Promise<string | null> {
		if (artist.country) return isRealCountry(artist.country) ? artist.country : null;
		return artist.area ? countryFromArea(artist.area, deadline) : null;
	}

	return {
		/**
		 * Look up to BULK_LIMIT artists by MBID in one search request. Returns only definite
		 * answers; artists that need an area walk, or weren't found, are left for
		 * resolveArtistCountry.
		 */
		async resolveMany(
			artists: { name: string; mbid?: string }[],
			opts: { deadline?: number } = {}
		): Promise<Map<string, string | null>> {
			const ids = artists.flatMap((a) => (a.mbid ? [a.mbid] : [])).slice(0, BULK_LIMIT);
			const answers = new Map<string, string | null>();
			if (ids.length === 0) return answers;

			const results = await get(
				'/artist',
				{ query: `arid:(${ids.join(' OR ')})`, limit: String(BULK_LIMIT) },
				opts.deadline ?? Infinity
			);
			for (const found of results?.artists ?? []) {
				if (!ids.includes(found.id) || !found.country) continue;
				answers.set(found.id, isRealCountry(found.country) ? found.country : null);
			}
			return answers;
		},

		/** Whether MusicBrainz has more than one artist with exactly this name (so an MBID from last.fm may be the wrong one). */
		async isNameShared(name: string, opts: { deadline?: number } = {}): Promise<boolean> {
			const results = await get(
				'/artist',
				{ query: `artist:"${escapeLucene(name)}"`, limit: '5' },
				opts.deadline ?? Infinity
			);
			// Compare names regardless of score: "HIDE" scores lower than "hide" but is a different artist.
			const sameNamed = (results?.artists ?? []).filter((a: { name: string }) => sameName(a.name, name));
			return sameNamed.length > 1;
		},

		async resolveArtistCountry(
			artist: { name: string; mbid?: string },
			opts: { deadline?: number } = {}
		): Promise<string | null> {
			const deadline = opts.deadline ?? Infinity;
			if (artist.mbid) {
				const found = await get(`/artist/${artist.mbid}`, {}, deadline);
				if (found) return countryFromArtist(found, deadline);
			}

			const results = await get(
				'/artist',
				{ query: `artist:"${escapeLucene(artist.name)}"`, limit: '5' },
				deadline
			);
			const sameNamed = (results?.artists ?? []).filter((a: { name: string }) =>
				sameName(a.name, artist.name)
			);
			const top = results?.artists?.[0];
			// Several artists share this name (e.g. Nirvana US and UK, or "hide" and "HIDE"): don't guess.
			if (sameNamed.length !== 1 || top !== sameNamed[0] || top.score !== 100) return null;
			return countryFromArtist(top, deadline);
		}
	};
}
