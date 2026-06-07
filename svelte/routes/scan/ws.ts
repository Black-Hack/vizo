import { liveQuery } from 'dexie'
import { db, type Tenant } from './db.js'

function sendPending(ws: WebSocket, pending: Tenant[]) {
	// if (ws.readyState === WebSocket.OPEN && pending.length !== 0) {
	try {
		if (!pending) return
		if (pending.length === 0) return
		ws.send(
			JSON.stringify(
				pending.slice(0, 10).map(tx => ({
					cid: tx.cid,
					cts: tx.cts,
					actor: tx.actor,
					sub: tx.sub,
					val: tx.val,
				})),
			),
		)
	} catch {}
}

async function handleUpdates(tenant: string, body: string) {
	type Row = {
		sid: number
		cid: string
		sts: number
		cts: number
		actor: string | null
		sub: string
		val: number
	}
	const data = JSON.parse(body) as Row[]
	await db.tenants.bulkPut(data.map(tx => ({ tenant, ...tx })))
}

export function createWebSocket(tenant: string, sig: string) {
	let ws: WebSocket | null = null
	let timeout: ReturnType<typeof setTimeout> | null = null
	let closeRequested = false

	let pending = liveQuery(() => db.tenants.where(['tenant', 'sid']).equals([tenant, 0]).toArray())

	const subscription = pending.subscribe(pending => {
		if (ws !== null) sendPending(ws, pending)
	})

	async function open() {
		const last = await db.tenants
			.where(['tenant', 'sid'])
			.between([tenant, 0], [tenant, Number.MAX_VALUE], false, true)
			.last()
		const after = last?.sid ?? 0

		const searchParams = new URLSearchParams([
			['tenant', tenant],
			['sig', sig],
			['after', after.toString()],
		])
		ws = new WebSocket(`/api/ws?${searchParams}`)
		ws.onopen = () => {
			if (ws !== null && pending.getValue) {
				sendPending(ws, pending.getValue())
			}
		}
		ws.onmessage = e => handleUpdates(tenant, e.data as string)
		ws.onclose = () => {
			if (!closeRequested) {
				timeout = setTimeout(open, 10000)
			}
		}
		ws.onerror = () => {
			ws?.close()
		}
	}

	open()
	return function close() {
		if (closeRequested) return

		closeRequested = true
		if (timeout) {
			clearTimeout(timeout)
			timeout = null
		}
		subscription.unsubscribe()
		ws?.close()
		ws = null
	}
}
