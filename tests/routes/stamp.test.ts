import { expect, test } from 'vitest';
import { isRedirect } from '@sveltejs/kit';
import { POST as stamp } from '../../src/routes/api/[username]/stamp/+server';
import { POST as refresh } from '../../src/routes/api/[username]/refresh/+server';
import { artist, known } from '../lib/passport/fixtures';
import { fakeDeps, fakeLastfm, fakeMusicBrainz } from '../lib/server/fakes';

function setup() {
	const clock = { t: 0 };
	const lastfm = fakeLastfm({ name: 'RJ', artists: [artist('Boris', 10, 'bo')] });
	const mb = fakeMusicBrainz({ Boris: 'JP' }, clock);
	return { d: fakeDeps(lastfm.client, mb.client, clock), lastfm };
}

const event = (username: string, deps: unknown, search = '') =>
	({ params: { username }, url: new URL(`http://localhost/api/${username}/stamp${search}`), locals: { deps } }) as never;

test('stamp endpoint returns the batch result as JSON', async () => {
	const { d } = setup();
	const response = await stamp(event('rj', d));
	const body = await response.json();
	expect(body.status).toBe('ok');
	expect(body.remaining).toBe(0);
	expect(body.passport.stamps[0].country).toBe('JP');
});

test('refresh refetches last.fm, keeps artist records, and redirects to the canonical passport', async () => {
	const { d, lastfm } = setup();
	await d.artists.set('mbid:bo', known('JP'));
	let thrown: unknown;
	try {
		await refresh(event('rj', d));
	} catch (e) {
		thrown = e;
	}
	expect(isRedirect(thrown) && thrown.status === 303 && thrown.location === '/RJ').toBe(true);
	expect(lastfm.calls.filter((c) => c.method === 'getUser')).toHaveLength(1);
	expect(await d.artists.get('mbid:bo')).toEqual(known('JP'));
	expect((await d.records.get('rj:12month'))?.['mbid:bo']).toEqual(known('JP'));
});

test('stamp and refresh use the period from the query string', async () => {
	const { d, lastfm } = setup();
	await stamp(event('rj', d, '?period=overall'));
	expect(lastfm.calls.find((c) => c.method === 'getTopArtists')?.args[2]).toBe('overall');
	let thrown: unknown;
	try {
		await refresh(event('rj', d, '?period=overall'));
	} catch (e) {
		thrown = e;
	}
	expect(isRedirect(thrown) && thrown.location).toBe('/RJ?period=overall');
});
