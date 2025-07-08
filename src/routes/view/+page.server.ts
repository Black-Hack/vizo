import { error } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const csr = false

const encoder = new TextEncoder()

export const load: PageServerLoad = async ({ url, platform }) => {
	const tenant = url.searchParams.get('tenant')
	const sub = url.searchParams.get('sub')
	const sig = url.searchParams.get('sig')

	if (!tenant || !sub || !sig) throw error(400)

	const publicKey = await crypto.subtle.importKey(
		'jwk',
		{ kty: 'OKP', crv: 'Ed25519', x: platform?.env.PUBLIC_KEY },
		'Ed25519',
		false,
		['verify'],
	)

	const isValid = await crypto.subtle.verify(
		'Ed25519',
		publicKey,
		Uint8Array.from(atob(sig), c => c.charCodeAt(0)),
		encoder.encode(`${tenant}:${sub}`),
	)

	if (!isValid) throw error(403)

	return {
		sub,
		score: 0,
	}
}
