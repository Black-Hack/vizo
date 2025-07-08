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

import { env } from 'cloudflare:workers'
import { Hono } from 'hono/quick'
import { jwt, sign, type JwtVariables } from 'hono/jwt'
import { jwk } from 'hono/jwk'
import { setCookie } from 'hono/cookie'
import { HTTPException } from 'hono/http-exception'

const encoder = new TextEncoder()
const privateKey = await crypto.subtle.importKey(
	'jwk',
	{ kty: 'OKP', crv: 'Ed25519', x: env.PUBLIC_KEY, d: env.PRIVATE_KEY },
	'Ed25519',
	false,
	['sign'],
)
const publicKey = await crypto.subtle.importKey(
	'jwk',
	{ kty: 'OKP', crv: 'Ed25519', x: env.PUBLIC_KEY },
	'Ed25519',
	false,
	['verify'],
)

const app = new Hono<{
	Variables: JwtVariables<{ sub: string; aud: string; iss: string }>
}>()

app.use(
	'/api/*',
	jwt({
		secret: publicKey,
		alg: 'EdDSA',
		cookie: { key: 'jwt', prefixOptions: 'host' },
	}),
)

app.post(
	'/api-auth/login',
	jwk({ jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs' }),
	async c => {
		const googleToken = c.get('jwtPayload')
		if (
			googleToken.aud !== env.GOOGLE_CLIENT_ID ||
			(googleToken.iss !== 'accounts.google.com' &&
				googleToken.iss !== 'https://accounts.google.com')
		) {
			throw new HTTPException(401)
		}

		const now = Date.now()
		const ttl = 1000 * 60 * 60 * 24 * 7
		const exp = now + ttl

		setCookie(
			c,
			'jwt',
			await sign(
				{
					sub: googleToken.sub,
					iat: Math.floor(now / 1000),
					exp: Math.floor(exp / 1000),
				},
				privateKey,
				'EdDSA',
			),
			{
				expires: new Date(exp),
				httpOnly: true,
				path: '/',
				secure: true,
				sameSite: 'lax',
				prefix: 'host',
			},
		)
	},
)

app.get('/login', async c => {
	return c.html(`
<html>
  <body>
    <div id="buttonDiv"></div>
    <script src="https://accounts.google.com/gsi/client"></script>
	<script>
	google.accounts.id.initialize({
		client_id: '${env.GOOGLE_CLIENT_ID}',
		callback: handleCredentialResponse
	});
	google.accounts.id.renderButton(
		document.getElementById("buttonDiv"),
		{ theme: "outline", size: "large" }
	);

	async function handleCredentialResponse(response) {
		console.log("Encoded JWT ID token: " + response.credential);
		const resp = await fetch('/api-auth/login', {
			method: 'POST',
			headers: {
				'Authorization': 'Bearer ' + response.credential,
			},
		});
	}
	</script>
  </body>
</html>`)
})

app.get('/view', async c => {
	const tenant = c.req.query('tenant')
	const sub = c.req.query('sub')
	const sig = c.req.query('sig')
	if (!tenant || !sub || !sig) {
		throw new HTTPException(400)
	}
	const isValid = await crypto.subtle.verify(
		'Ed25519',
		publicKey,
		Uint8Array.from(atob(sig), c => c.charCodeAt(0)),
		encoder.encode(`${tenant}:${sub}`),
	)
	if (!isValid) {
		throw new HTTPException(403)
	}
	return c.html(`<html><body>User ${sub} has 0 vizo.</body></html>`)
})

export default app satisfies ExportedHandler<Env>
