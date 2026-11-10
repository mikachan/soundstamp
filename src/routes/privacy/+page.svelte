<svelte:head>
	<title>Your data · Soundstamp</title>
	<meta name="description" content="What Soundstamp does with your last.fm data." />
</svelte:head>

<article class="privacy">
	<h1>Your data</h1>
	<p>
		Soundstamp only uses public last.fm data: your top artists and tracks, plus the names of artists
		you've listened to so it doesn't suggest them back to you. Your passport is deleted after a
		week, and the artist list isn't kept at all.
	</p>
	<p>
		No accounts, cookies, tracking or ads, and nothing is ever sold or shared. It runs on Netlify, in
		the US.
	</p>
	<p>
		Have a question?
		<a href="https://github.com/mikachan/soundstamp/issues">Open an issue on GitHub</a>.
	</p>
</article>

<style>
	.privacy {
		max-width: 36rem;
		padding-block: 1rem 2rem;
	}
	h1 {
		font: 700 2rem/1.1 var(--font-display);
	}
</style>
