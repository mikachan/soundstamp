import { fail, redirect } from '@sveltejs/kit';
import { parsePeriod, periodQuery } from '#lib/passport/periods.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({ ogImage: `${url.origin}/og.png` });

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '').trim();
		if (!username) return fail(400, { message: 'Enter a last.fm username' });
		const period = parsePeriod(form.get('period')?.toString());
		redirect(303, `/${encodeURIComponent(username)}${periodQuery(period)}`);
	}
};
