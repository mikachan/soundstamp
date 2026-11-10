import { expect, test } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import Stamps from '#lib/components/Stamps.svelte';
import type { Stamp } from '#lib/passport/types';

const iceland: Stamp = {
	country: 'IS',
	countryName: 'Iceland',
	plays: 400,
	share: 0.4,
	artists: [
		{ name: 'Sigur Rós', url: 'https://www.last.fm/music/Sigur+R%C3%B3s', playcount: 300 },
		{ name: 'Björk', url: 'https://www.last.fm/music/Bj%C3%B6rk', playcount: 100 }
	],
	tracks: [
		{ name: 'Hoppípolla', url: 'https://www.last.fm/music/Sigur+R%C3%B3s/_/Hopp%C3%ADpolla', artist: 'Sigur Rós', playcount: 50 }
	]
};
const japan: Stamp = { ...iceland, country: 'JP', countryName: 'Japan', plays: 100, share: 0.1 };

test('renders a stamp per country, in order, with artist links', () => {
	render(Stamps, { stamps: [iceland, japan] });
	const items = screen.getAllByRole('listitem', { name: /Iceland|Japan/ });
	expect(items.map((i) => i.getAttribute('aria-label'))).toEqual(['Iceland', 'Japan']);
	expect(within(items[0]).getByRole('link', { name: 'Sigur Rós' })).toHaveAttribute(
		'href',
		'https://www.last.fm/music/Sigur+R%C3%B3s'
	);
});

test('clicking a stamp toggles its top tracks', async () => {
	render(Stamps, { stamps: [iceland] });
	const toggle = screen.getByRole('button', { name: /Iceland/ });
	expect(toggle).toHaveAttribute('aria-expanded', 'false');
	expect(screen.queryByRole('link', { name: /Hoppípolla/ })).toBeNull();

	await fireEvent.click(toggle);
	expect(toggle).toHaveAttribute('aria-expanded', 'true');
	expect(screen.getByRole('link', { name: /Hoppípolla/ })).toHaveAttribute('href', iceland.tracks[0].url);

	await fireEvent.click(toggle);
	expect(toggle).toHaveAttribute('aria-expanded', 'false');
});
