import { expect, test } from 'vitest';
import { shade } from '#lib/geo/shade';

test('the most-listened country is fully shaded', () => {
	expect(shade(0.4, 0.4)).toBe(1);
});

test('shading follows the square root of relative share', () => {
	expect(shade(0.1, 0.4)).toBeCloseTo(0.625);
});

test('unvisited countries are unshaded', () => {
	expect(shade(0, 0.4)).toBe(0);
});
