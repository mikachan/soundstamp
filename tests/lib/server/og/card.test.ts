import { describe, expect, test } from 'vitest';
import { renderCardSvg } from '#lib/server/og/card';
import { cardPng } from '#lib/server/og/png';
import { passport } from '../../passport/passport-fixture';
import type { Stamp } from '#lib/passport/types';

const stamp = (country: string, countryName: string, plays: number, share: number): Stamp => ({
	country,
	countryName,
	plays,
	share,
	artists: [],
	tracks: []
});

const p = passport({
	username: 'big<red>&dragon',
	countryCount: 3,
	continentCount: 2,
	stamps: [stamp('IS', 'Iceland', 400, 0.4), stamp('JP', 'Japan', 300, 0.3), stamp('GB', 'United Kingdom', 100, 0.1)]
});

describe('renderCardSvg', () => {
	test('is a 1200×630 SVG', () => {
		expect(renderCardSvg({ passport: p, period: '12month' })).toMatch(/^<svg[^>]*width="1200" height="630"/);
	});

	test('shows the escaped username, stats and period', () => {
		const svg = renderCardSvg({ passport: p, period: '12month' });
		expect(svg).toContain('big&lt;red&gt;&amp;dragon');
		expect(svg).not.toContain('big<red>');
		expect(svg).toContain('3 countries · 2 continents');
		expect(svg).toContain('Last 12 months');
	});

	test('lists the top three countries', () => {
		const svg = renderCardSvg({ passport: p, period: 'overall' });
		expect(svg).toContain('Iceland · Japan · United Kingdom');
		expect(svg).toContain('All time');
	});

	test('shades visited countries on the map', () => {
		const svg = renderCardSvg({ passport: p, period: '12month' });
		expect(svg.match(/data-country="(IS|JP|GB)"/g)).toHaveLength(3);
	});

	test('without a passport, shows the homepage headline and an unshaded map', () => {
		const svg = renderCardSvg({});
		// The headline wraps onto two lines.
		expect(svg).toContain('>How far does your<');
		expect(svg).toContain('>music travel?<');
		expect(svg).not.toContain('data-country');
	});
});

test('cardPng renders a 1200×630 PNG', () => {
	const png = cardPng(renderCardSvg({ passport: p, period: '12month' }));
	expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	expect(png.readUInt32BE(16)).toBe(1200);
	expect(png.readUInt32BE(20)).toBe(630);
});
