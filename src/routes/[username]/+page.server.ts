import { redirect } from '@sveltejs/kit';
import { appDeps, rethrowAsHttp } from '#lib/server/app-deps.js';
import { currentPassport, getSnapshot } from '#lib/server/stamping.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const deps = appDeps(locals);
	const snapshot = await getSnapshot(deps, params.username).catch((e: unknown) =>
		rethrowAsHttp(e, params.username)
	);
	if (snapshot.username !== params.username) {
		redirect(301, `/${encodeURIComponent(snapshot.username)}`);
	}
	return currentPassport(deps, snapshot);
};
