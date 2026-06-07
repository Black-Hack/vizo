import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [sveltekit()],
	envPrefix: 'VIZO_',
	server: {
		proxy: {
			'/api/': {
				target: 'http://localhost:8787',
				changeOrigin: true,
				ws: true,
			},
		},
		fs: {
			allow: ['./svelte'],
		},
	},
})
