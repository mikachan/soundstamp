<script lang="ts">
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head>
	<title>Soundstamp: where in the world is your music from?</title>
	<meta
		name="description"
		content="Turn your last.fm listening history into a passport of every country your music comes from."
	/>
</svelte:head>

<section class="hero">
	<h1>Where in the world is your music from?</h1>
	<p>
		Soundstamp turns your last.fm listening history into a passport: a map of every country your
		music comes from, a stamp for each one, and somewhere new to visit next.
	</p>
	<form method="POST">
		<label for="username">last.fm username</label>
		<div class="row">
			<input id="username" name="username" autocomplete="username" required />
			<button>Open passport</button>
		</div>
		{#if form?.message}<p class="error">{form.message}</p>{/if}
	</form>
</section>

<style>
	.hero {
		max-width: 36rem;
		padding-block: 3rem;
	}
	h1 {
		font: 700 clamp(2rem, 6vw, 3rem) / 1.1 var(--font-display);
		margin: 0 0 1rem;
	}
	label {
		display: block;
		font-weight: 600;
		margin-block: 1.5rem 0.4rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	input {
		flex: 1 1 12rem;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--rule);
		border-radius: 0.5rem;
		background: var(--card);
		color: var(--ink);
	}
	button {
		padding: 0.6rem 1.1rem;
		border: 0;
		border-radius: 0.5rem;
		background: var(--stamp);
		color: var(--card);
		font-weight: 600;
		cursor: pointer;
	}
	.error {
		color: var(--stamp);
	}
</style>
