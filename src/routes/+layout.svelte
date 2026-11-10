<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="page">
	<nav><a href="/" class="brand">Soundstamp</a></nav>
	<main>
		{@render children()}
	</main>
	<footer>
		<a href="https://www.last.fm">Powered by AudioScrobbler</a>
		<span aria-hidden="true">·</span>
		<a href="https://musicbrainz.org">Country data from MusicBrainz</a>
		<span aria-hidden="true">·</span>
		<a href="https://sekai.co.uk">Part of sekai.co.uk</a>
	</footer>
</div>

<style>
	.page {
		display: grid;
		grid-template-rows: auto 1fr auto;
		min-height: 100vh;
		max-width: 64rem;
		margin-inline: auto;
		padding-inline: 1rem;
	}
	nav {
		padding-block: 1rem;
	}
	.brand {
		font: 700 1.1rem/1 var(--font-display);
		letter-spacing: 0.04em;
		text-decoration: none;
		color: var(--stamp);
	}
	footer {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding-block: 2rem;
		font-size: 0.85rem;
		color: var(--muted);
	}
</style>
