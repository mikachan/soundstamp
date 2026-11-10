<script lang="ts">
	import { onMount } from 'svelte';

	let { username, url, image }: { username: string; url: string; image: string } = $props();

	let title = $derived(`${username}'s Soundstamp passport`);
	let copied = $state(false);
	// Only known in the browser, so decided after mount to keep server and client markup the same.
	let canShare = $state(false);

	onMount(() => {
		canShare = typeof navigator.share === 'function';
	});

	async function copy() {
		await navigator.clipboard.writeText(url);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	async function share() {
		await navigator.share({ title, url }).catch(() => {
			// Closing the share sheet rejects; nothing to do.
		});
	}
</script>

<section class="share" aria-labelledby="share-heading">
	<h2 id="share-heading">Share your passport</h2>
	<img src={image} alt="Preview of {title}" width="1200" height="630" loading="lazy" />
	<div class="link">
		<input aria-label="Passport link" value={url} readonly onfocus={(e) => e.currentTarget.select()} />
		<button onclick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
		{#if canShare}<button onclick={share}>Share…</button>{/if}
	</div>
</section>

<style>
	h2 {
		font: 700 1.3rem/1.2 var(--font-display);
	}
	img {
		display: block;
		width: 100%;
		max-width: 36rem;
		height: auto;
		border: 1px solid var(--rule);
		border-radius: 0.75rem;
	}
	.link {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		max-width: 36rem;
		margin-top: 0.75rem;
	}
	input {
		flex: 1 1 14rem;
		min-width: 0;
		padding: 0.5rem 0.7rem;
		border: 1px solid var(--rule);
		border-radius: 0.5rem;
		background: var(--card);
		color: var(--ink);
	}
	button {
		padding: 0.5rem 0.9rem;
		border: 0;
		border-radius: 0.5rem;
		background: var(--stamp);
		color: var(--card);
		font-weight: 600;
		cursor: pointer;
	}
</style>
