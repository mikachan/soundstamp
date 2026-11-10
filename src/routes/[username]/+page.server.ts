import { redirect } from '@sveltejs/kit';
import { appDeps, requireValidUsername, rethrowAsHttp } from '#lib/server/app-deps.js';
import { parsePeriod, periodQuery } from '#lib/passport/periods.js';
import { currentPassport, getSnapshot } from '#lib/server/stamping.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url, locals }) => {
	requireValidUsername(params.username);
	const deps = appDeps(locals);
	const period = parsePeriod(url.searchParams.get('period'));
	const snapshot = await getSnapshot(deps, params.username, { period }).catch((e: unknown) =>
		rethrowAsHttp(e, params.username)
	);
	if (snapshot.username !== params.username) {
		redirect(301, `/${encodeURIComponent(snapshot.username)}${periodQuery(period)}`);
	}
	const passportPath = `${url.origin}/${encodeURIComponent(snapshot.username)}`;
	const ogImage = `${passportPath}/og.png${periodQuery(period)}`;
	const shareUrl = `${passportPath}${periodQuery(period)}`;
	return { ...(await currentPassport(deps, snapshot)), period, ogImage, shareUrl };
};
