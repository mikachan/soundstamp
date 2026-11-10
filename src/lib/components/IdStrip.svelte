<script lang="ts">
	import type { Passport } from '../passport/types';

	let { passport }: { passport: Passport } = $props();

	const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

	let initials = $derived(
		passport.username
			.split(/[_\-.\s]+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => [...part][0].toUpperCase())
			.join('')
	);
</script>

<header class="id-strip">
	<!-- Generated "photo": last.fm's terms don't cover reusing their images. -->
	<div class="photo" data-testid="passport-photo" aria-hidden="true">{initials}</div>
	<div class="details">
		<p class="label">Soundstamp passport</p>
		<h1><a href={passport.profileUrl}>{passport.username}</a></h1>
		<p class="stats">
			{plural(passport.countryCount, 'country', 'countries')} · {plural(
				passport.continentCount,
				'continent',
				'continents'
			)} · since {passport.joinedYear}
		</p>
	</div>
</header>

<style>
	.id-strip {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border: 1px solid var(--rule);
		border-radius: 0.75rem;
		background: var(--card);
	}
	.photo {
		flex: none;
		display: grid;
		place-items: center;
		width: 4rem;
		height: 4rem;
		border: 3px double var(--stamp);
		border-radius: 50%;
		color: var(--stamp);
		font: 700 1.4rem/1 var(--font-display);
		transform: rotate(-6deg);
	}
	.label {
		margin: 0;
		font-size: 0.7rem;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--muted);
	}
	h1 {
		margin: 0.1rem 0;
		font: 700 1.5rem/1.2 var(--font-display);
		overflow-wrap: anywhere;
	}
	h1 a {
		color: var(--ink);
		text-decoration: none;
	}
	h1 a:hover {
		text-decoration: underline;
	}
	.stats {
		margin: 0;
		color: var(--muted);
	}
</style>
