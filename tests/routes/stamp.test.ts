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

const event = (username: string, deps: unknown) => ({ params: { username }, locals: { deps } }) as never;

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
	expect((await d.snapshots.get('rj'))?.records['mbid:bo']).toEqual(known('JP'));
});
