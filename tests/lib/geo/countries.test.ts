import { describe, expect, test } from 'vitest';
import { continentOf, countryName, isRealCountry, toNumericId } from '../../../src/lib/geo/countries';

describe('isRealCountry', () => {
	test('accepts ISO alpha-2 country codes', () => {
		expect(isRealCountry('GB')).toBe(true);
	});

	test.each(['XW', 'XE', 'XU', '', null, undefined, 'ZZ'])('rejects %s', (code) => {
		expect(isRealCountry(code)).toBe(false);
	});
});

test('countryName returns the English name', () => {
	expect(countryName('IS')).toBe('Iceland');
});

test('toNumericId returns the zero-padded world-atlas id', () => {
	expect(toNumericId('GB')).toBe('826');
	expect(toNumericId('JP')).toBe('392');
});

test('continentOf returns the continent code', () => {
	expect(continentOf('JP')).toBe('AS');
	expect(continentOf('GB')).toBe('EU');
});
