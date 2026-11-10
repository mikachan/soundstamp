/// <reference types="vitest/config" />
import adapter from '@sveltejs/adapter-netlify';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ edge: false, split: false })
		})
	],
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: 'client',
					environment: 'jsdom',
					include: ['tests/**/*.svelte.test.ts'],
					setupFiles: ['tests/setup-dom.ts']
				},
				resolve: { conditions: ['browser'] }
			},
			{
				extends: true,
				test: {
					name: 'server',
					environment: 'node',
					include: ['tests/**/*.test.ts'],
					exclude: ['tests/**/*.svelte.test.ts']
				}
			}
		]
	}
});
