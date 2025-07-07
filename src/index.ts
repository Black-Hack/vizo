/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { env } from 'cloudflare:workers';

const encoder = new TextEncoder();
const privateKey = await crypto.subtle.importKey(
	'jwk',
	{
		kty: 'OKP',
		crv: 'Ed25519',
		x: env.PUBLIC_KEY,
		d: env.PRIVATE_KEY,
	},
	'Ed25519',
	false,
	['sign']
);
const publicKey = await crypto.subtle.importKey(
	'jwk',
	{
		kty: 'OKP',
		crv: 'Ed25519',
		x: env.PUBLIC_KEY,
	},
	'Ed25519',
	false,
	['verify']
);

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		try {
			if (url.pathname === '/view') {
				if (request.method === 'GET') {
					const tenant = url.searchParams.get('tenant');
					const sub = url.searchParams.get('sub');
					const sig = url.searchParams.get('sig');
					if (!tenant || !sub || !sig) {
						return new Response(null, { status: 400 });
					}
					const isValid = await crypto.subtle.verify(
						'Ed25519',
						publicKey,
						Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)),
						encoder.encode(`${tenant}:${sub}`)
					);
					if (!isValid) {
						return new Response(null, { status: 403 });
					}
					return new Response(`<html><body><h1>Tenant: ${tenant}</h1><h2>Subject: ${sub}</h2></body></html>`, {
						headers: { 'Content-Type': 'text/html' },
					});
				} else return new Response(null, { status: 405, headers: { Allow: 'GET' } });
			} else return new Response(null, { status: 404 });
		} catch {
			return new Response(null, { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;
