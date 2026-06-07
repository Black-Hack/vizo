import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import adapter from '@sveltejs/adapter-cloudflare'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter(),
		files: {
			appTemplate: 'svelte/app.html',
			routes: 'svelte/routes',
			lib: 'svelte/lib',
			assets: 'svelte/static',
			serviceWorker: 'svelte/service-worker',
		},
	},
}

export default config
