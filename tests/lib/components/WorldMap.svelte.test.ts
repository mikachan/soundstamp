import { expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import world from 'world-atlas/countries-110m.json';
import WorldMap from '#lib/components/WorldMap.svelte';
import type { Stamp } from '#lib/passport/types';

const stamp = (country: string, countryName: string, share: number): Stamp => ({
	country,
	countryName,
	plays: share * 1000,
	share,
	artists: [],
	tracks: []
});

const stamps = [stamp('GB', 'United Kingdom', 0.4), stamp('IS', 'Iceland', 0.1)];

test('draws one path per country in the atlas', () => {
	const { container } = render(WorldMap, { stamps });
	expect(container.querySelectorAll('path')).toHaveLength(world.objects.countries.geometries.length);
});

test('visited countries carry their code and a non-zero fill opacity', () => {
	const { container } = render(WorldMap, { stamps });
	const uk = container.querySelector('path[data-country="GB"]');
	const iceland = container.querySelector('path[data-country="IS"]');
	expect(uk?.getAttribute('fill-opacity')).toBe('1');
	expect(Number(iceland?.getAttribute('fill-opacity'))).toBeCloseTo(0.625);
	expect(container.querySelectorAll('path[data-country]')).toHaveLength(2);
});

test('every path has an accessible title, with play share for visited countries', () => {
	const { container } = render(WorldMap, { stamps });
	const paths = [...container.querySelectorAll('path')];
	expect(paths.every((p) => p.querySelector('title')?.textContent)).toBe(true);
	expect(container.querySelector('path[data-country="GB"] title')?.textContent).toBe(
		'United Kingdom: 40% of your plays'
	);
});

test('a stamp for a country too small for the map does not throw', () => {
	expect(() => render(WorldMap, { stamps: [stamp('SG', 'Singapore', 0.2)] })).not.toThrow();
});
