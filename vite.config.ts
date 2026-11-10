/// <reference types="vitest/config" />
import adapter from '@sveltejs/adapter-netlify';
import license from 'rollup-plugin-license';
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
		}),
		// List the licence of every library shipped to browsers, served at /licenses.txt.
		{
			...license({
				thirdParty: {
					output: {
						file: '.svelte-kit/output/client/licenses.txt',
						template: (deps) =>
							[
								'Soundstamp is free software under the GNU GPL, version 2 or later:',
								'https://github.com/mikachan/soundstamp',
								'',
								'It includes the following third-party libraries.',
								...deps.map((d) =>
									[`\n----\n${d.name}@${d.version} (${d.license})`, d.licenseText ?? ''].join('\n')
								)
							].join('\n')
					}
				}
			}),
			applyToEnvironment: (environment: { name: string }) => environment.name === 'client'
		}
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
