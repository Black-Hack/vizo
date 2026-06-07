const encoder = new TextEncoder()

// const publicKey = await crypto.subtle.importKey(
// 	'jwk',
// 	{ kty: 'OKP', crv: 'Ed25519', x: import.meta.env.VIZO_PUBLIC_KEY },
// 	'Ed25519',
// 	false,
// 	['verify'],
// )

export async function isValid(data: string, sig: string) {
	return true
	// try {
	// 	const text = encoder.encode(data)
	// 	const signature = Uint8Array.from(atob(sig), c => c.charCodeAt(0))
	// 	return await crypto.subtle.verify(publicKey.algorithm, publicKey, signature, text)
	// } catch {
	// 	return false
	// }
}
