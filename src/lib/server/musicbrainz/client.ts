import { isRealCountry } from '../../geo/countries';

const API_ROOT = 'https://musicbrainz.org/ws/2';
const MAX_AREA_HOPS = 3;

export class MusicBrainzUnavailable extends Error {}

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

const sameName = (a: string, b: string) =>
	a.normalize('NFKC').trim().toLowerCase() === b.normalize('NFKC').trim().toLowerCase();

const escapeLucene = (s: string) => s.replace(/["\\]/g, '\\$&');

export function createMusicBrainzClient(opts: {
	fetch: typeof fetch;
	contact: string;
	beforeRequest: () => Promise<void>;
}) {
	const userAgent = `Soundstamp/0.1 ( ${opts.contact} )`;

	/** GET a ws/2 path. Returns null for 404 and other permanent 4xx errors. */
	async function get(path: string, params: Record<string, string> = {}): Promise<any> {
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
		if (response.status >= 500) {
			throw new MusicBrainzUnavailable(`MusicBrainz returned ${response.status}: ${path}`);
		}
		if (!response.ok) return null;
		try {
			return await response.json();
		} catch (cause) {
			throw new MusicBrainzUnavailable(`MusicBrainz sent invalid JSON: ${path}`, { cause });
		}
	}

	async function countryFromArea(start: Area): Promise<string | null> {
		let area = start;
		for (let hops = 0; ; hops++) {
			const code = countryFromCodes(area['iso-3166-1-codes']);
			if (code !== undefined) return code;
			if (hops === MAX_AREA_HOPS) return null;

			const detail: Area | null = await get(`/area/${area.id}`, { inc: 'area-rels' });
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

	async function countryFromArtist(artist: {
		country?: string | null;
		area?: Area | null;
	}): Promise<string | null> {
		if (artist.country) return isRealCountry(artist.country) ? artist.country : null;
		return artist.area ? countryFromArea(artist.area) : null;
	}

	return {
		async resolveArtistCountry(artist: { name: string; mbid?: string }): Promise<string | null> {
			if (artist.mbid) {
				const found = await get(`/artist/${artist.mbid}`);
				if (found) return countryFromArtist(found);
			}

			const results = await get('/artist', {
				query: `artist:"${escapeLucene(artist.name)}"`,
				limit: '5'
			});
			const top = results?.artists?.[0];
			if (!top || top.score !== 100 || !sameName(top.name, artist.name)) return null;
			return countryFromArtist(top);
		}
	};
}
