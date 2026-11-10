import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import NextDestination from '#lib/components/NextDestination.svelte';

test('shows the top destination with its artist and reason', () => {
	const { container } = render(NextDestination, {
		destinations: [
			{
				country: 'EE',
				countryName: 'Estonia',
				artist: { name: 'Mart Avi', url: 'https://www.last.fm/music/Mart+Avi' },
				becauseOf: 'Sigur Rós',
				match: 0.7
			}
		]
	});
	expect(container).toHaveTextContent('Next destination: Estonia');
	expect(container).toHaveTextContent('because you like Sigur Rós');
	expect(screen.getByRole('link', { name: 'Mart Avi' })).toHaveAttribute(
		'href',
		'https://www.last.fm/music/Mart+Avi'
	);
});

test('says when there is no suggestion yet', () => {
	const { container } = render(NextDestination, { destinations: [] });
	expect(container).toHaveTextContent('No suggestion yet');
});
