import type { Passport } from '#lib/passport/types';

export function passport(overrides: Partial<Passport> = {}): Passport {
	return {
		username: 'sarahnorris',
		profileUrl: 'https://www.last.fm/user/sarahnorris',
		joinedYear: 2009,
		totalScrobbles: 182004,
		countryCount: 14,
		continentCount: 3,
		stamps: [],
		unknownArtists: 0,
		pendingArtists: 0,
		coverage: 1,
		ready: true,
		destinations: [],
		...overrides
	};
}
