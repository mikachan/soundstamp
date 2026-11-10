import { error } from '@sveltejs/kit';
import { LASTFM_API_KEY, MB_CONTACT } from '$app/env/private';
import { isValidUsername } from '../passport/username';
import { createDeps } from './deps';
import { LastfmPrivateProfile, LastfmUnavailable, LastfmUserNotFound } from './lastfm/client';
import type { StampingDeps } from './stamping';

let deps: StampingDeps | undefined;

/** Real dependencies, unless a test put fakes on `locals.deps`. */
export function appDeps(locals: App.Locals): StampingDeps {
	return locals.deps ?? (deps ??= createDeps({ LASTFM_API_KEY, MB_CONTACT }));
}

/** Turn last.fm failures into friendly HTTP errors. */
export function rethrowAsHttp(e: unknown, username: string): never {
	if (e instanceof LastfmUserNotFound) error(404, `No last.fm user called "${username}"`);
	if (e instanceof LastfmPrivateProfile) {
		error(403, `${username}'s last.fm listening history is private, so there's nothing to stamp`);
	}
	if (e instanceof LastfmUnavailable) error(503, 'last.fm is not responding, try again shortly');
	throw e;
}

/** 404 straight away for names last.fm can't have, without spending an API call. */
export function requireValidUsername(username: string): void {
	if (!isValidUsername(username)) error(404, `"${username}" isn't a last.fm username`);
}
