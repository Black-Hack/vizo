<script lang="ts">
	import { page } from '$app/state'
</script>

<div
	style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-size: 8em;">
	{#await fetch(`/api/view?${page.url.searchParams}`).then(resp => resp.text()) then resp}
		{resp}
	{:catch error}
		<p>Error: {error.message}</p>
	{/await}
</div>
