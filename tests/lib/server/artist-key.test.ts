import { expect, test } from 'vitest';
import { artistKey, normaliseName } from '#lib/server/artist-key';

test('normaliseName lowercases, trims and collapses whitespace', () => {
	expect(normaliseName('  Sigur   Rós ')).toBe('sigur rós');
});

test('artistKey uses the name when there is no mbid', () => {
	expect(artistKey({ name: ' Sigur  Rós ' })).toBe('name:sigur rós');
});

test('artistKey prefers the mbid', () => {
	expect(artistKey({ name: 'x', mbid: 'abc' })).toBe('mbid:abc');
});
