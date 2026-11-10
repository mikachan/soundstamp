import type {
	LastfmArtist,
	LastfmTrack,
	LastfmUser,
	SimilarArtist
} from '../server/lastfm/types';
import type { Period } from './periods';

/** Everything Soundstamp fetched from last.fm for one user. */
export interface Snapshot {
	username: string;
	period: Period;
	createdAt: number;
	user: LastfmUser;
	artists: LastfmArtist[];
	tracks: LastfmTrack[];
	/** Similar artists for each of the user's top artists; `seed` is the seed artist's name. */
	similar: { seed: string; artists: SimilarArtist[] }[];
	/** Normalised names of every artist the user has listened to (all time, capped). */
	heard: string[];
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
