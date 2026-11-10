import type {
	LastfmArtist,
	LastfmTrack,
	LastfmUser,
	SimilarArtist
} from '../server/lastfm/types';
import type { ArtistRecord } from '../server/store/types';

/** Everything Soundstamp fetched from last.fm for one user. */
export interface Snapshot {
	username: string;
	createdAt: number;
	user: LastfmUser;
	artists: LastfmArtist[];
	tracks: LastfmTrack[];
	/** Similar artists for each of the user's top artists; `seed` is the seed artist's name. */
	similar: { seed: string; artists: SimilarArtist[] }[];
	/** Resolved countries for this snapshot's artists and candidates, keyed by artistKey. */
	records: Record<string, ArtistRecord>;
}

export interface Stamp {
	country: string;
	countryName: string;
	plays: number;
	/** Share of the user's total top-artist plays. */
	share: number;
	artists: { name: string; url: string; playcount: number }[];
	tracks: { name: string; url: string; artist: string; playcount: number }[];
}

export interface Destination {
	country: string;
	countryName: string;
	artist: { name: string; url: string };
	becauseOf: string;
	match: number;
}

export interface Passport {
	username: string;
	profileUrl: string;
	joinedYear: number;
	totalScrobbles: number;
	countryCount: number;
	continentCount: number;
	/** Sorted by plays, highest first. */
	stamps: Stamp[];
	unknownArtists: number;
	pendingArtists: number;
	/** Share of plays whose artist has been resolved (known or unknown). */
	coverage: number;
	ready: boolean;
	/** Ranked; v1 shows the first. */
	destinations: Destination[];
}
