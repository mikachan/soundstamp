import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Privacy from '../../src/routes/privacy/+page.svelte';

test('a short, friendly note covering what, how long, where, and who to contact', () => {
	const { container } = render(Privacy);
	expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Your data');
	expect(container).toHaveTextContent('only uses public last.fm data');
	expect(container).toHaveTextContent('deleted after a week');
	expect(container).toHaveTextContent('No accounts, cookies, tracking or ads');
	expect(container).toHaveTextContent('Netlify');
	expect(screen.getByRole('link', { name: 'Open an issue on GitHub' })).toHaveAttribute(
		'href',
		'https://github.com/mikachan/soundstamp/issues'
	);
	expect(screen.getByRole('link', { name: 'complain to the ICO' })).toHaveAttribute(
		'href',
		'https://ico.org.uk/make-a-complaint/'
	);
	expect(container).not.toHaveTextContent('legitimate interests');
});
