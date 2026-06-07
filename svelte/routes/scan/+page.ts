import { error } from '@sveltejs/kit'
import type { PageLoad } from './$types.js'
import { isValid } from '$lib/sig.js'

export const load: PageLoad = async ({ url }) => {
	const tenant = url.searchParams.get('tenant')
	const sig = url.searchParams.get('sig')
	if (tenant === null || sig === null) error(400, 'Invalid parameters')
	if (!(await isValid(`connect:${tenant}`, sig))) error(401, 'Invalid signature')
	return { tenant, sig }
}
