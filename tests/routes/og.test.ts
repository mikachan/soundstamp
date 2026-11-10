import { expect, test } from 'vitest';
import { isHttpError } from '@sveltejs/kit';
import { GET as passportCard } from '../../src/routes/[username]/og.png/+server';
import { GET as homeCard } from '../../src/routes/og.png/+server';
import { load } from '../../src/routes/[username]/+page.server';
import { load as homeLoad } from '../../src/routes/+page.server';
import { artist } from '../lib/passport/fixtures';
import { fakeDeps, fakeLastfm, fakeMusicBrainz } from '../lib/server/fakes';

function deps(opts: Parameters<typeof fakeLastfm>[0] = {}) {
	const clock = { t: 0 };
	return fakeDeps(fakeLastfm(opts).client, fakeMusicBrainz({}, clock).client, clock);
}
const event = (path: string, params: Record<string, string>, d: unknown) =>
	({ params, url: new URL(`https://soundstamp.sekai.co.uk${path}`), locals: { deps: d } }) as never;

test('passport card is a cached PNG', async () => {
	const response = await passportCard(event('/rj/og.png?period=overall', { username: 'rj' }, deps({ name: 'rj', artists: [artist('A', 1)] })));
	expect(response.headers.get('content-type')).toBe('image/png');
	expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
	const bytes = new Uint8Array(await response.arrayBuffer());
	expect([...bytes.subarray(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
});

test('passport card for an unknown user is a 404', async () => {
	let thrown: unknown;
	try {
		await passportCard(event('/nobody/og.png', { username: 'nobody' }, deps({ missing: true })));
	} catch (e) {
		thrown = e;
	}
	expect(isHttpError(thrown, 404)).toBe(true);
});

test('homepage card is a cached PNG', async () => {
	const response = await homeCard(event('/og.png', {}, null));
	expect(response.headers.get('content-type')).toBe('image/png');
	expect(response.headers.get('cache-control')).toBe('public, max-age=86400');
});

test('passport pages point link previews at their card, keeping the period', async () => {
	const data = await load(event('/rj?period=overall', { username: 'rj' }, deps({ name: 'rj' })));
	expect(data.ogImage).toBe('https://soundstamp.sekai.co.uk/rj/og.png?period=overall');
	expect(data.shareUrl).toBe('https://soundstamp.sekai.co.uk/rj?period=overall');
});

test('the homepage points link previews at the general card', async () => {
	const data = await homeLoad(event('/', {}, null));
	expect(data).toEqual({ ogImage: 'https://soundstamp.sekai.co.uk/og.png' });
});
