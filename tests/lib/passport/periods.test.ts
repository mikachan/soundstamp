import { expect, test } from 'vitest';
import { DEFAULT_PERIOD, PERIODS, parsePeriod, periodLabel, periodQuery } from '#lib/passport/periods';

test('the default period is the last 12 months', () => {
	expect(DEFAULT_PERIOD).toBe('12month');
});

test('lists every last.fm period, shortest first, ending with all time', () => {
	expect(PERIODS).toEqual(['7day', '1month', '3month', '6month', '12month', 'overall']);
});

test('parsePeriod accepts last.fm periods and falls back to the default', () => {
	expect(parsePeriod('overall')).toBe('overall');
	expect(parsePeriod('3month')).toBe('3month');
	expect(parsePeriod('forever')).toBe('12month');
	expect(parsePeriod(null)).toBe('12month');
});

test('periodLabel gives readable names', () => {
	expect(periodLabel('7day')).toBe('Last 7 days');
	expect(periodLabel('12month')).toBe('Last 12 months');
	expect(periodLabel('overall')).toBe('All time');
});

test('periodQuery leaves the default out of URLs', () => {
	expect(periodQuery('12month')).toBe('');
	expect(periodQuery('overall')).toBe('?period=overall');
});
