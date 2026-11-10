import iso from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json' with { type: 'json' };
import { countries as countryList } from 'countries-list';

iso.registerLocale(en);

/** MusicBrainz pseudo-codes that don't name a real country. */
const PSEUDO_CODES = new Set(['XW', 'XE', 'XU']);

export function isRealCountry(code: string | null | undefined): code is string {
	if (!code || PSEUDO_CODES.has(code)) return false;
	return iso.isValid(code);
}

// Intl gives everyday names ("Russia", "United States") rather than official ones.
const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryName(code: string): string {
	return displayNames.of(code) ?? code;
}

export function toNumericId(code: string): string | null {
	return iso.alpha2ToNumeric(code) ?? null;
}

export function continentOf(code: string): string | null {
	const entry = (countryList as Record<string, { continent: string } | undefined>)[code];
	return entry?.continent ?? null;
}
