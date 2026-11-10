import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request }) => {
		const username = String((await request.formData()).get('username') ?? '').trim();
		if (!username) return fail(400, { message: 'Enter a last.fm username' });
		redirect(303, `/${encodeURIComponent(username)}`);
	}
};
