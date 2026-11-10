import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Layout from '../../src/routes/+layout.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>page</p>' }));

test('footer credits last.fm, MusicBrainz and links to sekai.co.uk', () => {
	render(Layout, { children } as never);
	expect(screen.getByRole('link', { name: 'Powered by AudioScrobbler' })).toHaveAttribute('href', 'https://www.last.fm');
	expect(screen.getByRole('link', { name: 'Country data from MusicBrainz' })).toHaveAttribute('href', 'https://musicbrainz.org');
	expect(screen.getByRole('link', { name: 'Part of sekai.co.uk' })).toHaveAttribute('href', 'https://sekai.co.uk');
});
