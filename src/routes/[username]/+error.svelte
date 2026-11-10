<script lang="ts">
	import { page } from '$app/state';
</script>

<section class="error">
	<h1>{page.status === 404 ? 'Passport not found' : page.status === 403 ? 'Passport sealed' : 'Customs is closed'}</h1>
	<p>{page.error?.message}</p>
	<p><a href="/">Try another username</a></p>
</section>
