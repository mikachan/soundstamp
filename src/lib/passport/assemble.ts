import { continentOf, countryName, isRealCountry } from '../geo/countries';
import { artistKey, normaliseName } from '../server/artist-key';
import type { LastfmArtist } from '../server/lastfm/types';
import type { ArtistRecord } from '../server/store/types';
import { rankDestinations } from './destination';
import type { Passport, Snapshot, Stamp } from './types';

export const READY_COVERAGE = 0.9;
const STAMP_ARTISTS = 5;
const STAMP_TRACKS = 10;

export function assemblePassport(s: Snapshot, records: Map<string, ArtistRecord>): Passport {
	const totalPlays = s.artists.reduce((sum, a) => sum + a.playcount, 0);
	const byCountry = new Map<string, LastfmArtist[]>();
	const countryOfArtist = new Map<LastfmArtist, string>();
	let pendingPlays = 0;
	let pendingArtists = 0;
	let unknownArtists = 0;

	for (const artist of s.artists) {
		const record = records.get(artistKey(artist));
		if (!record) {
			pendingPlays += artist.playcount;
			pendingArtists++;
		} else if (isRealCountry(record.country)) {
			const list = byCountry.get(record.country) ?? [];
			list.push(artist);
			byCountry.set(record.country, list);
			countryOfArtist.set(artist, record.country);
		} else {
			unknownArtists++;
		}
	}

	// Match tracks to the user's top artists by mbid, falling back to the normalised name.
	const artistByMbid = new Map(s.artists.filter((a) => a.mbid).map((a) => [a.mbid!, a]));
	const artistByName = new Map(s.artists.map((a) => [normaliseName(a.name), a]));
	const tracksByCountry = new Map<string, Stamp['tracks']>();
	// last.fm sometimes lists one track twice (with and without an mbid) under the same URL.
	const seenTracks = new Set<string>();
	for (const t of [...s.tracks].sort((a, b) => b.playcount - a.playcount)) {
		if (seenTracks.has(t.url)) continue;
		seenTracks.add(t.url);
		const owner =
			(t.artist.mbid && artistByMbid.get(t.artist.mbid)) || artistByName.get(normaliseName(t.artist.name));
		const country = owner && countryOfArtist.get(owner);
		if (!country) continue;
		const list = tracksByCountry.get(country) ?? [];
		list.push({ name: t.name, url: t.url, artist: t.artist.name, playcount: t.playcount });
		tracksByCountry.set(country, list);
	}

	const stamps: Stamp[] = [...byCountry].map(([country, artists]) => {
		const plays = artists.reduce((sum, a) => sum + a.playcount, 0);
		return {
			country,
			countryName: countryName(country),
			plays,
			share: totalPlays ? plays / totalPlays : 0,
			artists: [...artists]
				.sort((a, b) => b.playcount - a.playcount)
				.slice(0, STAMP_ARTISTS)
				.map(({ name, url, playcount }) => ({ name, url, playcount })),
			tracks: (tracksByCountry.get(country) ?? [])
				.sort((a, b) => b.playcount - a.playcount)
				.slice(0, STAMP_TRACKS)
		};
	});
	stamps.sort((a, b) => b.plays - a.plays);

	const coverage = totalPlays ? (totalPlays - pendingPlays) / totalPlays : 1;
	const visited = new Set(stamps.map((st) => st.country));
	const continents = new Set(stamps.map((st) => continentOf(st.country)).filter(Boolean));

	return {
		username: s.user.name,
		profileUrl: s.user.url,
		joinedYear: s.user.registeredYear,
		totalScrobbles: s.user.playcount,
		countryCount: stamps.length,
		continentCount: continents.size,
		stamps,
		unknownArtists,
		pendingArtists,
		coverage,
		// Tolerate float error so exactly 90% counts as ready.
		ready: coverage >= READY_COVERAGE - 1e-9,
		destinations: rankDestinations(s, records, visited)
	};
}
