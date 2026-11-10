import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Page from '../../src/routes/[username]/+page.svelte';
import { passport } from '../lib/passport/passport-fixture';

const props = (overrides: Parameters<typeof passport>[0], remaining = 0) =>
	({ data: { passport: passport(overrides), remaining, period: '12month', ogImage: 'https://x/og.png' }, params: { username: 'x' } }) as never;

test('an account with nothing to stamp gets an empty-passport message instead of stamps', () => {
	const { container } = render(Page, props({ countryCount: 0, continentCount: 0, stamps: [] }));
	expect(container).toHaveTextContent('No scrobbles to stamp yet');
	expect(screen.queryByRole('heading', { name: 'Stamps' })).toBeNull();
	expect(container).not.toHaveTextContent('Next destination');
});

test('a passport with stamps shows the stamps and next destination', () => {
	const { container } = render(
		Page,
		props({
			stamps: [{ country: 'IS', countryName: 'Iceland', plays: 1, share: 1, artists: [], tracks: [] }]
		})
	);
	expect(screen.getByRole('heading', { name: 'Stamps' })).toBeInTheDocument();
	expect(container).toHaveTextContent('Next destination');
});

test('offers every period, marking the current one', () => {
	render(Page, props({}));
	const nav = screen.getByRole('navigation', { name: 'Listening period' });
	const current = nav.querySelector('[aria-current="page"]');
	expect(current).toHaveTextContent('Last 12 months');
	expect(screen.getByRole('link', { name: 'All time' })).toHaveAttribute('href', '?period=overall');
	expect(screen.getByRole('link', { name: 'Last 7 days' })).toHaveAttribute('href', '?period=7day');
});
