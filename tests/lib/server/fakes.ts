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
	heard?: string[];
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
			async getTopArtists(username: string, limit: number, period?: string) {
				log('getTopArtists', username, limit, period);
				return opts.artists ?? [];
			},
			async getTopTracks(username: string, limit: number, period?: string) {
				log('getTopTracks', username, limit, period);
				return opts.tracks ?? [];
			},
			async getHeardArtistNames(username: string, maxPages: number) {
				log('getHeardArtistNames', username, maxPages);
				return opts.heard ?? (opts.artists ?? []).map((a) => a.name);
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
export function fakeMusicBrainz(
	answers: Record<string, Answer>,
	clock: { t: number },
	stepMs = 1000,
	bulk: Record<string, string | null> | Error = {},
	sharedNames: string[] = []
) {
	const asked: string[] = [];
	const deadlines: (number | undefined)[] = [];
	const bulkCalls: string[][] = [];
	const nameChecks: string[] = [];
	return {
		asked,
		deadlines,
		bulkCalls,
		nameChecks,
		client: {
			async isNameShared(name: string, _opts: { deadline?: number } = {}) {
				nameChecks.push(name);
				clock.t += stepMs;
				return sharedNames.includes(name);
			},
			async resolveMany(artists: { name: string; mbid?: string }[], _opts: { deadline?: number } = {}) {
				bulkCalls.push(artists.map((a) => a.mbid!));
				clock.t += stepMs;
				if (bulk instanceof Error) throw bulk;
				return new Map(
					artists.filter((a) => a.mbid! in bulk).map((a) => [a.mbid!, bulk[a.mbid!]] as const)
				);
			},
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
		bulkMisses: new Set(),
		now: () => clock.t
	};
}
