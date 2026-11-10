import { parsePeriod } from '#lib/passport/periods.js';
import { appDeps, rethrowAsHttp } from '#lib/server/app-deps.js';
import { renderCardSvg } from '#lib/server/og/card.js';
import { cardPng } from '#lib/server/og/png.js';
import { currentPassport, getSnapshot } from '#lib/server/stamping.js';
import type { RequestHandler } from './$types';

/** Link-preview image for a passport, as stamped so far. */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	const deps = appDeps(locals);
	const period = parsePeriod(url.searchParams.get('period'));
	const snapshot = await getSnapshot(deps, params.username, { period }).catch((e: unknown) =>
		rethrowAsHttp(e, params.username)
	);
	const { passport } = await currentPassport(deps, snapshot);
	return new Response(new Uint8Array(cardPng(renderCardSvg({ passport, period }))), {
		headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=3600' }
	});
};
