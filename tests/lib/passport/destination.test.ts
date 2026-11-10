import { expect, test } from 'vitest';
import { rankDestinations } from '#lib/passport/destination';
import type { SimilarArtist } from '#lib/server/lastfm/types';
import type { ArtistRecord } from '#lib/server/store/types';
import { artist, known, snapshot } from './fixtures';

const checked = (country: string | null): ArtistRecord => ({ ...known(country), sharedName: false });

const similar = (name: string, match: number, mbid?: string): SimilarArtist => ({
	name,
	mbid,
	match,
	url: `https://www.last.fm/music/${encodeURIComponent(name)}`
});

function setup() {
	const s = snapshot({
		artists: [artist('Sigur Rós', 400, 'sr'), artist('Boris', 100, 'bo')],
		similar: [
			{
				seed: 'Sigur Rós',
				artists: [
					similar('Múm', 0.95, 'mum'),
					similar('Mart Avi', 0.6, 'ma'),
					similar('Kerli', 0.7, 'ke'),
					similar('Unknown Act', 0.99),
					similar('Worldwide Act', 0.98, 'ww')
				]
			},
			{ seed: 'Boris', artists: [similar('Sigur Rós', 0.97, 'sr'), similar('Ghost', 0.5, 'gh')] }
		]
	});
	const records = new Map<string, ArtistRecord>([
		['mbid:sr', known('IS')],
		['mbid:bo', known('JP')],
		['mbid:mum', checked('IS')],
		['mbid:ma', checked('EE')],
		['mbid:ke', checked('EE')],
		['mbid:ww', checked('XW')],
		['name:unknown act', checked(null)],
		['mbid:gh', checked('SE')]
	]);
	return { s, records, visited: new Set(['IS', 'JP']) };
}

test('keeps only real, unvisited countries, best candidate per country, by match', () => {
	const { s, records, visited } = setup();
	expect(rankDestinations(s, records, visited)).toEqual([
		{
			country: 'EE',
			countryName: 'Estonia',
			artist: { name: 'Kerli', url: 'https://www.last.fm/music/Kerli' },
			becauseOf: 'Sigur Rós',
			match: 0.7
		},
		{
			country: 'SE',
			countryName: 'Sweden',
			artist: { name: 'Ghost', url: 'https://www.last.fm/music/Ghost' },
			becauseOf: 'Boris',
			match: 0.5
		}
	]);
});

test("excludes candidates that are already among the user's top artists", () => {
	const { s, records } = setup();
	const result = rankDestinations(s, records, new Set());
	expect(result.map((d) => d.artist.name)).not.toContain('Sigur Rós');
});

test('candidates without a record yet are skipped', () => {
	const { s, records, visited } = setup();
	records.delete('mbid:ke');
	records.delete('mbid:ma');
	expect(rankDestinations(s, records, visited).map((d) => d.country)).toEqual(['SE']);
});

test('returns [] when nothing qualifies', () => {
	const { s, records } = setup();
	expect(rankDestinations(s, records, new Set(['IS', 'JP', 'EE', 'SE']))).toEqual([]);
});

test('skips candidates whose name is shared by several MusicBrainz artists, or not yet checked', () => {
	const { s, records, visited } = setup();
	records.set('mbid:ke', { ...known('EE'), sharedName: true });
	records.set('mbid:ma', known('EE'));
	expect(rankDestinations(s, records, visited).map((d) => d.country)).toEqual(['SE']);
});

test("skips artists anywhere in the user's listening history", () => {
	const { s, records, visited } = setup();
	s.heard = ['kerli', 'mart avi'];
	expect(rankDestinations(s, records, visited).map((d) => d.country)).toEqual(['SE']);
});
