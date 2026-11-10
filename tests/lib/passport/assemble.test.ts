import { describe, expect, test } from 'vitest';
import { assemblePassport } from '#lib/passport/assemble';
import type { ArtistRecord } from '#lib/server/store/types';
import { artist, known, snapshot, track } from './fixtures';

/** 1000 plays: IS 400, GB 300, unknown 200, pending 100. */
function base() {
	const s = snapshot({
		artists: [
			artist('Sigur Rós', 400, 'sr'),
			artist('CHVRCHES', 300, 'ch'),
			artist('Mystery', 200),
			artist('Not Yet', 100)
		]
	});
	const records = new Map<string, ArtistRecord>([
		['mbid:sr', known('IS')],
		['mbid:ch', known('GB')],
		['name:mystery', known(null)]
	]);
	return { s, records };
}

describe('stamps and counts', () => {
	test('one stamp per country, sorted by plays, with share of total plays', () => {
		const { s, records } = base();
		const p = assemblePassport(s, records);
		expect(p.stamps.map((st) => [st.country, st.countryName, st.plays, st.share])).toEqual([
			['IS', 'Iceland', 400, 0.4],
			['GB', 'United Kingdom', 300, 0.3]
		]);
		expect(p.countryCount).toBe(2);
		expect(p.continentCount).toBe(1);
	});

	test('counts unknown and pending artists separately', () => {
		const { s, records } = base();
		const p = assemblePassport(s, records);
		expect(p.unknownArtists).toBe(1);
		expect(p.pendingArtists).toBe(1);
	});

	test('carries ID strip details from the user', () => {
		const { s, records } = base();
		const p = assemblePassport(s, records);
		expect(p).toMatchObject({
			username: 'RJ',
			profileUrl: 'https://www.last.fm/user/RJ',
			joinedYear: 2009,
			totalScrobbles: 5000
		});
	});

	test('pseudo-country codes count as unknown', () => {
		const { s, records } = base();
		records.set('mbid:ch', known('XE'));
		const p = assemblePassport(s, records);
		expect(p.stamps.map((st) => st.country)).toEqual(['IS']);
		expect(p.unknownArtists).toBe(2);
	});

	test('continents are counted distinctly', () => {
		const { s, records } = base();
		records.set('name:mystery', known('JP'));
		expect(assemblePassport(s, records).continentCount).toBe(2);
	});
});

describe('coverage and readiness', () => {
	test('ready at exactly 0.9 coverage', () => {
		const { s, records } = base();
		const p = assemblePassport(s, records);
		expect(p.coverage).toBeCloseTo(0.9);
		expect(p.ready).toBe(true);
	});

	test('not ready below 0.9', () => {
		const s = snapshot({
			artists: [
				artist('Sigur Rós', 400, 'sr'),
				artist('CHVRCHES', 300, 'ch'),
				artist('Not Yet', 200),
				artist('Mystery', 100)
			]
		});
		const records = new Map([
			['mbid:sr', known('IS')],
			['mbid:ch', known('GB')],
			['name:mystery', known(null)]
		]);
		const p = assemblePassport(s, records);
		expect(p.coverage).toBeCloseTo(0.8);
		expect(p.ready).toBe(false);
	});

	test('an account with no artists is ready and empty', () => {
		const p = assemblePassport(snapshot(), new Map());
		expect(p.coverage).toBe(1);
		expect(p.ready).toBe(true);
		expect(p.stamps).toEqual([]);
		expect(p.destinations).toEqual([]);
	});
});

describe('stamp contents', () => {
	test('tracks attach by artist mbid, then by normalised name; unknown artists are ignored', () => {
		const { s, records } = base();
		s.tracks = [
			track('Hoppípolla', 'Sigur Rós', 50, 'sr'),
			track('Glósóli', 'sigur  rós', 40),
			track('The Mother We Share', 'CHVRCHES', 30, 'ch'),
			track('Stranger Song', 'Not In Top Artists', 99)
		];
		const p = assemblePassport(s, records);
		const iceland = p.stamps.find((st) => st.country === 'IS')!;
		expect(iceland.tracks.map((t) => t.name)).toEqual(['Hoppípolla', 'Glósóli']);
		expect(iceland.tracks[0]).toEqual({
			name: 'Hoppípolla',
			url: s.tracks[0].url,
			artist: 'Sigur Rós',
			playcount: 50
		});
		expect(p.stamps.flatMap((st) => st.tracks).some((t) => t.name === 'Stranger Song')).toBe(false);
	});

	test('a stamp lists at most 5 artists and 10 tracks, highest plays first', () => {
		const artists = Array.from({ length: 7 }, (_, i) => artist(`A${i}`, 100 - i, `a${i}`));
		const tracks = Array.from({ length: 12 }, (_, i) => track(`T${i}`, 'A0', 50 - i, 'a0'));
		const records = new Map(artists.map((a) => [`mbid:${a.mbid}`, known('SE')]));
		const p = assemblePassport(snapshot({ artists, tracks }), records);
		expect(p.stamps[0].artists.map((a) => a.name)).toEqual(['A0', 'A1', 'A2', 'A3', 'A4']);
		expect(p.stamps[0].artists[0]).toEqual({ name: 'A0', url: artists[0].url, playcount: 100 });
		expect(p.stamps[0].tracks).toHaveLength(10);
		expect(p.stamps[0].tracks[0].name).toBe('T0');
	});
});
