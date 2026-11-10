import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import IdStrip from '#lib/components/IdStrip.svelte';
import { passport } from '../passport/passport-fixture';

test('shows a single initial for a one-word username', () => {
	render(IdStrip, { passport: passport() });
	expect(screen.getByTestId('passport-photo')).toHaveTextContent(/^S$/);
});

test('uses the first two parts of a multi-part username', () => {
	render(IdStrip, { passport: passport({ username: 'big_red_dragon' }) });
	expect(screen.getByTestId('passport-photo')).toHaveTextContent(/^BR$/);
});

test('never renders an image', () => {
	const { container } = render(IdStrip, { passport: passport() });
	expect(container.querySelector('img')).toBeNull();
});

test('links the username to the last.fm profile', () => {
	render(IdStrip, { passport: passport() });
	expect(screen.getByRole('link', { name: 'sarahnorris' })).toHaveAttribute(
		'href',
		'https://www.last.fm/user/sarahnorris'
	);
});

test('shows passport stats', () => {
	const { container } = render(IdStrip, { passport: passport() });
	expect(container).toHaveTextContent('14 countries · 3 continents · since 2009');
});

test('uses singular forms', () => {
	const { container } = render(IdStrip, {
		passport: passport({ countryCount: 1, continentCount: 1 })
	});
	expect(container).toHaveTextContent('1 country · 1 continent · since 2009');
});
