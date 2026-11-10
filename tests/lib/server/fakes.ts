import type { LastfmArtist, LastfmTrack, SimilarArtist } from '#lib/server/lastfm/types';
import type { StampingDeps } from '#lib/server/stamping';
import { memoryKV, type ArtistRecord } from '#lib/server/store/types';
import type { Snapshot } from '#lib/passport/types';
import { LastfmUserNotFound } from '#lib/server/lastfm/client';

export function fakeLastfm(opts: {
	name?: string;
	artists?: LastfmArtist[];
	tracks?: LastfmTrack[];
	similar?: Record<string, SimilarArtist[]>;
	missing?: boolean;
}) {
	const calls: { method: string; args: unknown[] }[] = [];
	const log = (method: string, ...args: unknown[]) => calls.push({ method, args });
	return {
		calls,
		client: {
			async getUser(username: string) {
				log('getUser', username);
				if (opts.missing) throw new LastfmUserNotFound('User not found');
				const name = opts.name ?? username;
				return { name, url: `https://www.last.fm/user/${name}`, registeredYear: 2009, playcount: 1000 };
			},
			async getTopArtists(username: string, limit: number) {
				log('getTopArtists', username, limit);
				return opts.artists ?? [];
			},
			async getTopTracks(username: string, limit: number) {
				log('getTopTracks', username, limit);
				return opts.tracks ?? [];
			},
			async getSimilar(artist: { name: string; mbid?: string }, limit: number) {
				log('getSimilar', artist.name, limit);
				return opts.similar?.[artist.name] ?? [];
			}
		}
	};
}

type Answer = string | null | Error | (() => Promise<string | null>);

/** MusicBrainz stub: name → country, Error to throw, or a hook. Each call advances the clock. */
export function fakeMusicBrainz(answers: Record<string, Answer>, clock: { t: number }, stepMs = 1000) {
	const asked: string[] = [];
	const deadlines: (number | undefined)[] = [];
	return {
		asked,
		deadlines,
		client: {
			async resolveArtistCountry(artist: { name: string; mbid?: string }, opts: { deadline?: number } = {}) {
				asked.push(artist.name);
				deadlines.push(opts.deadline);
				clock.t += stepMs;
				const answer = answers[artist.name];
				if (answer instanceof Error) throw answer;
				if (typeof answer === 'function') return answer();
				return answer ?? null;
			}
		}
	};
}

export function fakeDeps(
	lastfm: ReturnType<typeof fakeLastfm>['client'],
	mb: ReturnType<typeof fakeMusicBrainz>['client'],
	clock: { t: number }
): StampingDeps {
	return {
		lastfm: lastfm as StampingDeps['lastfm'],
		mb: mb as StampingDeps['mb'],
		artists: memoryKV<ArtistRecord>(),
		snapshots: memoryKV<Snapshot>(),
		records: memoryKV<Record<string, ArtistRecord>>(),
		now: () => clock.t
	};
}
