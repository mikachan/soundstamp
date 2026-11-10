// Framework-free last.fm client: no SvelteKit imports, so it can be copied into other projects.
import type { LastfmArtist, LastfmTrack, LastfmUser, SimilarArtist } from './types';

export type { LastfmArtist, LastfmTrack, LastfmUser, SimilarArtist } from './types';

const API_ROOT = 'https://ws.audioscrobbler.com/2.0/';
const USER_NOT_FOUND = 6;
const LOGIN_REQUIRED = 17;

export class LastfmUserNotFound extends Error {}
/** The user hides their listening history. */
export class LastfmPrivateProfile extends Error {}
export class LastfmUnavailable extends Error {}

const optionalMbid = (mbid: unknown) => (typeof mbid === 'string' && mbid !== '' ? mbid : undefined);

// last.fm returns a single object instead of an array when there is exactly one item.
const asArray = <T>(value: T | T[] | undefined): T[] =>
	value === undefined ? [] : Array.isArray(value) ? value : [value];

export function createLastfmClient(opts: { apiKey: string; fetch: typeof fetch }) {
	async function call(method: string, params: Record<string, string>): Promise<any> {
		const url = new URL(API_ROOT);
		url.search = new URLSearchParams({
			method,
			...params,
			api_key: opts.apiKey,
			format: 'json'
		}).toString();

		let response: Response;
		let body: any;
		try {
			response = await opts.fetch(url);
			body = await response.json();
		} catch (cause) {
			throw new LastfmUnavailable(`last.fm request failed: ${method}`, { cause });
		}

		if (body?.error === USER_NOT_FOUND) throw new LastfmUserNotFound(body.message ?? 'User not found');
		if (body?.error === LOGIN_REQUIRED) throw new LastfmPrivateProfile(body.message ?? 'Private profile');
		if (!response.ok || body?.error) {
			throw new LastfmUnavailable(`last.fm ${method} failed: ${body?.message ?? response.status}`);
		}
		return body;
	}

	return {
		async getUser(username: string): Promise<LastfmUser> {
			const { user } = await call('user.getinfo', { user: username });
			return {
				name: user.name,
				url: user.url,
				registeredYear: new Date(Number(user.registered.unixtime) * 1000).getUTCFullYear(),
				playcount: Number(user.playcount)
			};
		},

		async getTopArtists(username: string, limit: number, period = 'overall'): Promise<LastfmArtist[]> {
			const body = await call('user.gettopartists', {
				user: username,
				period,
				limit: String(limit)
			});
			return asArray<any>(body.topartists?.artist).map((a) => ({
				name: a.name,
				mbid: optionalMbid(a.mbid),
				playcount: Number(a.playcount),
				url: a.url
			}));
		},

		async getTopTracks(username: string, limit: number, period = 'overall'): Promise<LastfmTrack[]> {
			const body = await call('user.gettoptracks', {
				user: username,
				period,
				limit: String(limit)
			});
			return asArray<any>(body.toptracks?.track).map((t) => ({
				name: t.name,
				url: t.url,
				playcount: Number(t.playcount),
				artist: { name: t.artist.name, mbid: optionalMbid(t.artist.mbid) }
			}));
		},

		async getSimilar(artist: { name: string; mbid?: string }, limit: number): Promise<SimilarArtist[]> {
			const who: Record<string, string> = artist.mbid ? { mbid: artist.mbid } : { artist: artist.name };
			const body = await call('artist.getsimilar', { ...who, autocorrect: '1', limit: String(limit) });
			return asArray<any>(body.similarartists?.artist).map((a) => ({
				name: a.name,
				mbid: optionalMbid(a.mbid),
				match: Number(a.match),
				url: a.url
			}));
		}
	};
}
