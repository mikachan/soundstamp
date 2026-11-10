import { defineEnvVars } from '@sveltejs/kit/env';

// Optional at build time so `vite build` and tests run without secrets; createDeps
// fails loudly at request time if either is missing.
const optional = (value: string | undefined) => value;

export const variables = defineEnvVars({
	LASTFM_API_KEY: { schema: optional, description: 'last.fm API key (server only)' },
	MB_CONTACT: {
		schema: optional,
		description: 'Contact URL or email for the MusicBrainz User-Agent header'
	}
});
