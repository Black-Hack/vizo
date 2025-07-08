<script lang="ts">
	import type { PageProps } from './$types'

	let { data }: PageProps = $props()
</script>

User {data.sub} has {data.score} vizo.
