<script lang="ts">
	import { DEFAULT_PERIOD, PERIODS, periodLabel } from '#lib/passport/periods.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Soundstamp: how far does your music travel?</title>
	<meta property="og:title" content="Soundstamp: how far does your music travel?" />
	<meta property="og:image" content={data.ogImage} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta name="twitter:card" content="summary_large_image" />
	<meta
		name="description"
		content="Turn your last.fm listening history into a passport of every country your music comes from."
	/>
</svelte:head>

<section class="hero">
	<h1>How far does your music travel?</h1>
	<p>
		A map of every country in your last.fm history, a stamp for each one, and one place you haven't
		been yet.
	</p>
	<form method="POST">
		<label for="username">last.fm username</label>
		<div class="row">
			<input
				id="username"
				name="username"
				required
				autocomplete="off"
				autocapitalize="none"
				autocorrect="off"
				spellcheck="false"
				data-1p-ignore
				data-lpignore="true"
			/>
			<button>Open my passport</button>
		</div>
		<label for="period">Listening period</label>
		<select id="period" name="period" value={DEFAULT_PERIOD}>
			{#each PERIODS as period (period)}
				<option value={period}>{periodLabel(period)}</option>
			{/each}
		</select>
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
	input,
	select {
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
