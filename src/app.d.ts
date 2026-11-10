// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { StampingDeps } from '#lib/server/stamping.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Test-only injection point; production code builds real deps. */
			deps?: StampingDeps;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
