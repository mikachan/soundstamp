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
	expect(screen.getByRole('link', { name: 'Source on GitHub' })).toHaveAttribute(
		'href',
		'https://github.com/mikachan/soundstamp'
	);
});

test('the brand link shows the vinyl postmark logo beside the name', () => {
	render(Layout, { children } as never);
	const brand = screen.getByRole('link', { name: 'Soundstamp' });
	expect(brand).toHaveAttribute('href', '/');
	const logo = brand.querySelector('svg');
	expect(logo).toHaveAttribute('aria-hidden', 'true');
	expect(logo?.querySelectorAll('path')).toHaveLength(4);
});
