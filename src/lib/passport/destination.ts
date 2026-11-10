import { countryName, isRealCountry } from '../geo/countries';
import { artistKey, normaliseName } from '../server/artist-key';
import type { ArtistRecord } from '../server/store/types';
import type { Destination, Snapshot } from './types';

/** Similar artists from countries the user hasn't visited, best candidate per country, by match. */
export function rankDestinations(
	s: Snapshot,
	records: Map<string, ArtistRecord>,
	visited: Set<string>
): Destination[] {
	const ownKeys = new Set(s.artists.map(artistKey));
	const ownNames = new Set(s.artists.map((a) => normaliseName(a.name)));
	const best = new Map<string, Destination>();

	for (const { seed, artists } of s.similar) {
		for (const candidate of artists) {
			if (ownKeys.has(artistKey(candidate)) || ownNames.has(normaliseName(candidate.name))) continue;
			const record = records.get(artistKey(candidate));
			const country = record?.country;
			if (!isRealCountry(country) || visited.has(country)) continue;
			// last.fm merges same-name artists, so its MBID may point at the wrong one.
			if (record?.sharedName !== false) continue;
			const current = best.get(country);
			if (current && current.match >= candidate.match) continue;
			best.set(country, {
				country,
				countryName: countryName(country),
				artist: { name: candidate.name, url: candidate.url },
				becauseOf: seed,
				match: candidate.match
			});
		}
	}

	return [...best.values()].sort((a, b) => b.match - a.match);
}
