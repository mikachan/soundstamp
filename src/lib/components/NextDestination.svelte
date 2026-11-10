<script lang="ts">
	import type { Destination } from '../passport/types';

	let { destinations }: { destinations: Destination[] } = $props();

	let next = $derived(destinations[0]);
</script>

<section class="destination" aria-label="Next destination">
	{#if next}
		<p class="label">✈ Next destination: {next.countryName}</p>
		<p class="pick">
			Try <a href={next.artist.url}>{next.artist.name}</a>, because you like {next.becauseOf}.
		</p>
	{:else}
		<p class="label">✈ Next destination</p>
		<p class="pick">No suggestion yet. Check back once more of your passport is stamped.</p>
	{/if}
</section>

<style>
	.destination {
		margin-block: 2rem;
		padding: 1rem 1.25rem;
		border-left: 4px solid var(--stamp);
		border-radius: 0.5rem;
		background: var(--card);
	}
	p {
		margin: 0;
	}
	.label {
		font: 700 1.2rem/1.3 var(--font-display);
	}
	.pick {
		margin-top: 0.25rem;
	}
</style>
