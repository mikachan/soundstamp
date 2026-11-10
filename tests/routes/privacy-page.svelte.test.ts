import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Privacy from '../../src/routes/privacy/+page.svelte';

test('privacy page covers what is collected, why, how long, where, and how to ask for deletion', () => {
	const { container } = render(Privacy);
	expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy');
	for (const heading of [
		'What Soundstamp uses',
		'Why',
		'How long it is kept',
		'Where it is stored',
		'What Soundstamp never does',
		'Your rights'
	]) {
		expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
	}
	expect(container).toHaveTextContent('7 days');
	expect(container).toHaveTextContent('legitimate interests');
	expect(container).toHaveTextContent('Netlify');
	expect(screen.getByRole('link', { name: /Information Commissioner/ })).toHaveAttribute('href', 'https://ico.org.uk/make-a-complaint/');
	expect(screen.getByRole('link', { name: 'open an issue on GitHub' })).toHaveAttribute(
		'href',
		'https://github.com/mikachan/soundstamp/issues'
	);
});
