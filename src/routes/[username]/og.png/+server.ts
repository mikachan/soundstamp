import { redirect } from '@sveltejs/kit';
import { parsePeriod, periodQuery } from '#lib/passport/periods.js';
import { appDeps, requireValidUsername, rethrowAsHttp } from '#lib/server/app-deps.js';
import { renderCardSvg } from '#lib/server/og/card.js';
import { cardPng } from '#lib/server/og/png.js';
import { currentPassport, getSnapshot } from '#lib/server/stamping.js';
import type { RequestHandler } from './$types';

/** Link-preview image for a passport, as stamped so far. */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	requireValidUsername(params.username);
	const deps = appDeps(locals);
	const period = parsePeriod(url.searchParams.get('period'));
	const snapshot = await getSnapshot(deps, params.username, { period }).catch((e: unknown) =>
		rethrowAsHttp(e, params.username)
	);
	// One address per card, so the CDN cache can't be bypassed with extra query strings.
	const canonical = `/${encodeURIComponent(snapshot.username)}/og.png${periodQuery(period)}`;
	if (url.pathname + url.search !== canonical) redirect(301, canonical);
	const { passport } = await currentPassport(deps, snapshot);
	return new Response(new Uint8Array(cardPng(renderCardSvg({ passport, period }))), {
		headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' }
	});
};
