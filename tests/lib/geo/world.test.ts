import { expect, test } from 'vitest';
import world from 'world-atlas/countries-110m.json';
import { MAP_HEIGHT, MAP_WIDTH, worldShapes } from '#lib/geo/world';

test('one shape per atlas country, with path data and names', () => {
	expect(worldShapes).toHaveLength(world.objects.countries.geometries.length);
	expect(worldShapes.every((s) => s.d.startsWith('M') && s.name)).toBe(true);
	expect(worldShapes.find((s) => s.id === '826')?.name).toBe('United Kingdom');
	expect([MAP_WIDTH, MAP_HEIGHT]).toEqual([960, 500]);
});
