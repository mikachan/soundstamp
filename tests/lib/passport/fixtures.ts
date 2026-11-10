import type { Snapshot } from '#lib/passport/types';
import type { ArtistRecord } from '#lib/server/store/types';
import type { LastfmArtist, LastfmTrack } from '#lib/server/lastfm/types';

export const artist = (name: string, playcount: number, mbid?: string): LastfmArtist => ({
	name,
	mbid,
	playcount,
	url: `https://www.last.fm/music/${encodeURIComponent(name)}`
});

export const track = (
	name: string,
	artistName: string,
	playcount: number,
	mbid?: string
): LastfmTrack => ({
	name,
	url: `https://www.last.fm/music/${encodeURIComponent(artistName)}/_/${encodeURIComponent(name)}`,
	playcount,
	artist: { name: artistName, mbid }
});

export function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
	return {
		username: 'rj',
		createdAt: 0,
		user: { name: 'RJ', url: 'https://www.last.fm/user/RJ', registeredYear: 2009, playcount: 5000 },
		artists: [],
		tracks: [],
		similar: [],
		records: {},
		...overrides
	};
}

export const known = (country: string | null): ArtistRecord => ({ country, resolvedAt: 0 });
