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

/** MusicBrainz stub: name → country, or name → Error to throw. Each call advances the clock. */
export function fakeMusicBrainz(answers: Record<string, string | null | Error>, clock: { t: number }, stepMs = 1000) {
	const asked: string[] = [];
	return {
		asked,
		client: {
			async resolveArtistCountry(artist: { name: string; mbid?: string }) {
				asked.push(artist.name);
				clock.t += stepMs;
				const answer = answers[artist.name];
				if (answer instanceof Error) throw answer;
				return answer ?? null;
			}
		}
	};
}

export function fakeDeps(
	lastfm: ReturnType<typeof fakeLastfm>['client'],
	mb: ReturnType<typeof fakeMusicBrainz>['client'],
	clock: { t: number }
): StampingDeps & { artists: ReturnType<typeof memoryKV<ArtistRecord>>; snapshots: ReturnType<typeof memoryKV<Snapshot>> } {
	return {
		lastfm: lastfm as StampingDeps['lastfm'],
		mb: mb as StampingDeps['mb'],
		artists: memoryKV<ArtistRecord>(),
		snapshots: memoryKV<Snapshot>(),
		now: () => clock.t
	};
}
