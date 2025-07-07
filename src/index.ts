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
import { Hono } from 'hono/quick';
import { HTTPException } from 'hono/http-exception';

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

const app = new Hono();

app.get('/view', async (c) => {
	const tenant = c.req.query('tenant');
	const sub = c.req.query('sub');
	const sig = c.req.query('sig');
	if (!tenant || !sub || !sig) {
		throw new HTTPException(400);
	}
	const isValid = await crypto.subtle.verify(
		'Ed25519',
		publicKey,
		Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)),
		encoder.encode(`${tenant}:${sub}`)
	);
	if (!isValid) {
		throw new HTTPException(403);
	}
	return c.html(`<html><body><h1>Tenant: ${tenant}</h1><h2>Subject: ${sub}</h2></body></html>`);
});

export default app satisfies ExportedHandler<Env>;
