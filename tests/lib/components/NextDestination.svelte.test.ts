import { expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import NextDestination from '#lib/components/NextDestination.svelte';
import type { Destination } from '#lib/passport/types';

const auRa: Destination = {
	country: 'AG',
	countryName: 'Antigua & Barbuda',
	artist: { name: 'Au/Ra', url: 'https://www.last.fm/music/Au%2FRa' },
	becauseOf: 'Aurora',
	match: 0.8
};
const lsJack: Destination = {
	country: 'BR',
	countryName: 'Brazil',
	artist: { name: 'LS Jack', url: 'https://www.last.fm/music/LS+Jack' },
	becauseOf: 'McFly',
	match: 0.6
};

test('shows the top destination as a boarding pass', () => {
	const { container } = render(NextDestination, { destinations: [auRa, lsJack] });
	expect(screen.getByRole('heading', { name: 'Next destination' })).toBeInTheDocument();
	expect(container).toHaveTextContent('AG');
	expect(container).toHaveTextContent('Antigua & Barbuda');
	expect(container).toHaveTextContent('Au/Ra');
	expect(container).toHaveTextContent('Because you like Aurora');
	expect(screen.getByRole('link', { name: 'Listen to Au/Ra on last.fm' })).toHaveAttribute('href', auRa.artist.url);
	expect(container).toHaveTextContent('1 of 2');
});

test('"Show me another" steps through destinations and wraps around', async () => {
	const onchange = vi.fn();
	const { container } = render(NextDestination, { destinations: [auRa, lsJack], onchange });
	expect(onchange).toHaveBeenLastCalledWith(auRa);
	const next = screen.getByRole('button', { name: 'Show me another' });
	await fireEvent.click(next);
	expect(container).toHaveTextContent('Brazil');
	expect(container).toHaveTextContent('2 of 2');
	expect(onchange).toHaveBeenLastCalledWith(lsJack);
	await fireEvent.click(next);
	expect(container).toHaveTextContent('Antigua & Barbuda');
});

test('no "Show me another" when there is only one destination', () => {
	render(NextDestination, { destinations: [auRa] });
	expect(screen.queryByRole('button', { name: 'Show me another' })).toBeNull();
});

test('says when there is no suggestion yet', () => {
	const onchange = vi.fn();
	const { container } = render(NextDestination, { destinations: [], onchange });
	expect(container).toHaveTextContent('No suggestion yet');
	expect(onchange).toHaveBeenLastCalledWith(undefined);
});
