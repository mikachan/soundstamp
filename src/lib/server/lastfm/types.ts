export interface LastfmUser {
	name: string;
	url: string;
	registeredYear: number;
	playcount: number;
}

export interface LastfmArtist {
	name: string;
	mbid?: string;
	playcount: number;
	url: string;
}

export interface LastfmTrack {
	name: string;
	url: string;
	playcount: number;
	artist: { name: string; mbid?: string };
}

export interface SimilarArtist {
	name: string;
	mbid?: string;
	match: number;
	url: string;
}
