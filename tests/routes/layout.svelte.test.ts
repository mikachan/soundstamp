import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Layout from '../../src/routes/+layout.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>page</p>' }));

// last.fm's API terms require the AudioScrobbler credit and a link back.
test('footer credits last.fm and MusicBrainz', () => {
	render(Layout, { children } as never);
	expect(screen.getByRole('link', { name: /AudioScrobbler/i })).toHaveAttribute('href', 'https://www.last.fm');
	expect(screen.getByRole('link', { name: /MusicBrainz/ })).toHaveAttribute('href', 'https://musicbrainz.org');
});
