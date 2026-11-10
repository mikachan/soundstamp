<svelte:head>
	<title>Privacy · Soundstamp</title>
	<meta name="description" content="What Soundstamp does with last.fm data, and for how long." />
</svelte:head>

<article class="privacy">
	<h1>Privacy</h1>
	<p>
		Soundstamp is a free, non-commercial hobby project, part of
		<a href="https://sekai.co.uk">sekai.co.uk</a>. This page explains what it does with data about
		you, in plain terms.
	</p>

	<h2>What Soundstamp uses</h2>
	<p>
		When someone opens a passport, Soundstamp asks last.fm for that username's
		<strong>public</strong> listening data: profile name and link, the year the account was created,
		total scrobbles, top artists and tracks for the chosen period, and the names of artists the
		account has listened to. It then looks up each artist's country on MusicBrainz, which never sees
		who you are.
	</p>
	<p>
		Anyone can open a passport for any public last.fm username, just as anyone can view that
		profile on last.fm. Profiles that hide their listening history are not shown.
	</p>
	<p>
		Soundstamp has no accounts, no cookies, no analytics and no tracking. Like any website, the
		hosting provider records technical request logs, such as IP addresses, to keep the service running.
	</p>

	<h2>Why</h2>
	<p>
		Only to draw the passport you asked for: the map, stamps, next destination and link-preview
		image. The legal basis is <strong>legitimate interests</strong>: showing public listening
		data back in a new way, without contacting or profiling anyone.
	</p>

	<h2>How long it is kept</h2>
	<p>
		A passport's last.fm data is refreshed at most once a day, when someone visits it, and deleted
		once it is <strong>7 days</strong> old, so a passport nobody opens disappears within a week. The list of artists you've listened to is used once to pick suggestions and is
		never stored. Which country each artist comes from is kept, because that's about the artist,
		not you, and it's shared by every passport.
	</p>

	<h2>Where it is stored</h2>
	<p>
		Soundstamp runs on <a href="https://www.netlify.com/privacy/">Netlify</a>, which stores data and
		request logs in the United States under its own data protection terms. Listening data comes from
		<a href="https://www.last.fm/legal/privacy">last.fm</a>, and artist countries from
		<a href="https://musicbrainz.org/doc/About/Privacy_Policy">MusicBrainz</a>.
	</p>

	<h2>What Soundstamp never does</h2>
	<ul>
		<li>Sell, share or publish your data anywhere other than your passport page.</li>
		<li>Contact you, or use your data to identify you.</li>
		<li>Show ads, or use Spotify or any other streaming service.</li>
	</ul>

	<h2>Your rights</h2>
	<p>
		You can ask what Soundstamp holds about your username, ask for it to be deleted early, or object
		to your passport being shown. To do any of these,
		<a href="https://github.com/mikachan/soundstamp/issues">open an issue on GitHub</a>. Making your
		last.fm listening history private also stops new passports being made for you.
	</p>
	<p>
		If you're unhappy with how your data is handled, you can complain to the
		<a href="https://ico.org.uk/make-a-complaint/">Information Commissioner's Office (ICO)</a>.
	</p>
</article>

<style>
	.privacy {
		max-width: 40rem;
		padding-block: 1rem 2rem;
	}
	h1 {
		font: 700 2.2rem/1.1 var(--font-display);
	}
	h2 {
		margin-top: 2rem;
		font: 700 1.25rem/1.2 var(--font-display);
	}
	p,
	li {
		color: var(--ink);
	}
</style>
