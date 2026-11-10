import { isRealCountry } from '../../geo/countries';
import { normaliseName } from '../artist-key';

const API_ROOT = 'https://musicbrainz.org/ws/2';
const MAX_AREA_HOPS = 3;
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
			const exact = (results?.artists ?? []).filter(
				(a: { name: string; score: number }) => a.score === 100 && sameName(a.name, artist.name)
			);
			// Several artists share this name (e.g. Nirvana US and UK): don't guess.
			if (exact.length !== 1 || results.artists[0] !== exact[0]) return null;
			return countryFromArtist(exact[0], deadline);
		}
	};
}
