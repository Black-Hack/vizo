import { DurableObject } from 'cloudflare:workers'
import * as z from 'zod/v4-mini'
import { Hono, type Context } from 'hono'
import { HTTPException } from 'hono/http-exception'

const encoder = new TextEncoder()

const jsonString = <T>(schema: z.ZodMiniType<T>): z.ZodMiniType<T> =>
	z.pipe(
		z.pipe(
			z.string(),
			z.transform((content, ctx) => {
				try {
					return JSON.parse(content)
				} catch (error) {
					ctx.issues.push({
						code: 'custom',
						message: error instanceof Error ? error.message : 'Invalid JSON',
						input: content,
					})
					return z.never
				}
			}),
		),
		schema,
	)

const TransactionRx = jsonString(
	z
		.array(
			z.strictObject({
				cid: z.uuidv4().check(z.lowercase()),
				cts: z.int(),
				actor: z.nullish(z.string().check(z.maxLength(36))),
				sub: z.string().check(z.length(4)),
				val: z.int(),
			}),
		)
		.check(z.minLength(1), z.maxLength(10)),
)

type Row = {
	sid: number
	cid: string
	sts: number
	cts: number
	actor: string | null
	sub: string
	val: number
}

export class Tenant extends DurableObject<Env> {
	async init() {
		this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS transactions (
            sid INTEGER PRIMARY KEY,
            cid TEXT NOT NULL,
            sts INTEGER NOT NULL DEFAULT (unixepoch('subsec') * 1000),
            cts INTEGER NOT NULL,
            actor TEXT,
            sub TEXT NOT NULL,
            val INTEGER NOT NULL,
            UNIQUE (cid) ON CONFLICT IGNORE
        ) STRICT;`)
	}

	async deinit() {
		await this.ctx.storage.deleteAll({
			allowConcurrency: true,
			allowUnconfirmed: true,
			noCache: true,
		})
	}

	async scoreOf(sub: string) {
		const result = this.ctx.storage.sql
			.exec<{ value: number }>('SELECT SUM(val) value FROM transactions WHERE sub = ?', sub)
			.toArray()
		return result?.[0]?.value ?? 0
	}

	async dump() {
		return this.ctx.storage.sql
			.exec<{ card: string; score: number; created_at: number; updated_at: number }>(
				'SELECT sub card, SUM(val) score, MIN(cts) created_at, MAX(cts) updated_at FROM transactions GROUP BY sub',
			)
			.toArray()
	}

	// async fullSync(request: Request) {
	// 	const parseRes = TransactionRx.safeParse(await request.text())
	// 	if (!parseRes.success) {
	// 		throw new HTTPException(400, { message: parseRes.error.message })
	// 	}

	// 	if (parseRes.data.length !== 0) {
	// 		const stmt =
	// 			'INSERT INTO transactions(actor, cid, cts, sub, val) VALUES ' +
	// 			'(?,?,?,?,?),'.repeat(parseRes.data.length).slice(0, -1) +
	// 			';'

	// 		const query1Res = this.ctx.storage.sql
	// 			.exec<Row>(
	// 				stmt,
	// 				...parseRes.data.flatMap(t => [t.actor ?? null, t.cid, t.cts, t.sub, t.val]),
	// 			)
	// 			.toArray()
	// 	}

	// 	const query2Res = this.ctx.storage.sql
	// 		.exec<Row>('SELECT sid, cid, sts, cts, actor, sub, val FROM transactions')
	// 		.toArray()

	// 	const broadcastMessage = JSON.stringify(query2Res)
	// 	this.ctx.getWebSockets().forEach(w => w.send(broadcastMessage))
	// 	return query2Res
	// }

	async fetch(request: Request) {
		let url = new URL(request.url)

		const afterParam = url.searchParams.get('after')
		const afterInt = afterParam !== null ? parseInt(afterParam) : 0
		const after = !isNaN(afterInt) ? afterInt : 0

		const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair()

		serverWebSocket.serializeAttachment(null)
		this.ctx.acceptWebSocket(serverWebSocket)
		const rows = this.ctx.storage.sql
			.exec<Row>(
				'SELECT sid, cid, sts, cts, actor, sub, val FROM transactions WHERE sid > ?',
				after,
			)
			.toArray()

		if (rows.length !== 0) {
			serverWebSocket.send(JSON.stringify(rows))
		}

		return new Response(null, { status: 101, webSocket: clientWebSocket })
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		if (typeof message !== 'string') {
			return ws.close(1003)
		}

		const parseRes = TransactionRx.safeParse(message)
		if (!parseRes.success) {
			return ws.close(1008, parseRes.error.message)
		}

		const actor = ws.deserializeAttachment() as string | null

		const stmt =
			'INSERT INTO transactions(actor, cid, cts, sub, val) VALUES ' +
			'(?,?,?,?,?),'.repeat(parseRes.data.length).slice(0, -1) +
			' RETURNING sid, cid, sts, cts, actor, sub, val;'
		const queryRes = this.ctx.storage.sql
			.exec<Row>(
				stmt,
				...parseRes.data.flatMap(t => [
					actor ?? t.actor ?? null,
					t.cid,
					t.cts,
					t.sub,
					t.val,
				]),
			)
			.toArray()

		const missing = parseRes.data.filter(t => !queryRes.some(q => q.cid === t.cid))
		if (missing.length !== 0) {
			const missingStmt =
				'SELECT sid, cid, sts, cts, actor, sub, val FROM transactions WHERE cid IN (' +
				'?,'.repeat(missing.length).slice(0, -1) +
				');'
			const missingRows = this.ctx.storage.sql
				.exec<Row>(missingStmt, ...missing.map(t => t.cid))
				.toArray()
			const missingMessage = JSON.stringify(missingRows)
			ws.send(missingMessage)
		}

		if (queryRes.length !== 0) {
			const broadcastMessage = JSON.stringify(queryRes)
			this.ctx.getWebSockets().forEach(w => w.send(broadcastMessage))
		}
	}

	async webSocketError(ws: WebSocket, error: unknown) {
		ws.close()
	}
}

type HonoEnv = {
	Bindings: Env
}
const app = new Hono<HonoEnv>()

async function isValid(c: Context<HonoEnv>, data: string) {
	try {
		const sig = c.req.query('sig')
		if (!sig) return false

		const publicKey = await crypto.subtle.importKey(
			'jwk',
			{ kty: 'OKP', crv: 'Ed25519', x: c.env.VIZO_PUBLIC_KEY },
			'Ed25519',
			false,
			['verify'],
		)

		return await crypto.subtle.verify(
			publicKey.algorithm,
			publicKey,
			Uint8Array.from(atob(sig), c => c.charCodeAt(0)),
			encoder.encode(data),
		)
	} catch {
		return false
	}
}

async function verify(c: Context<HonoEnv>, data: string) {
	if (!(await isValid(c, data))) throw new HTTPException(403)
}

async function getTenantId(c: Context<HonoEnv>, action: string) {
	const tenant = z.nanoid().safeParse(c.req.query('tenant'))
	if (!tenant.success) throw new HTTPException(400)
	await verify(c, `${action}:${tenant.data}`)
	return c.env.TENANT.idFromName(tenant.data)
}

async function getTenant(c: Context<HonoEnv>, action: string) {
	return c.env.TENANT.get(await getTenantId(c, action)) as Tenant
}

app.get('/api/ws', async c => {
	if (c.req.header('Upgrade') !== 'websocket') throw new HTTPException(426)

	const tenant = await getTenant(c, 'connect')
	return await tenant.fetch(c.req.raw)
})

// app.post('/api/full-sync', async c => {
// 	const tenant = await getTenant(c, 'connect')
// 	return c.json(await tenant.fullSync(c.req.raw))
// })

app.get('/api/view', async c => {
	const tenantParam = z.nanoid().safeParse(c.req.query('tenant'))
	if (!tenantParam.success) throw new HTTPException(400)
	const subParam = z.string().safeParse(c.req.query('sub'))
	if (!subParam.success) throw new HTTPException(400)

	await verify(c, `${tenantParam.data}:${subParam.data}`)
	const tenantId = c.env.TENANT.idFromName(tenantParam.data)
	const tenant = c.env.TENANT.get(tenantId) as Tenant
	return c.text(`${await tenant.scoreOf(subParam.data)}`)
})

app.get('/api/dump', async c => {
	const tenant = await getTenant(c, 'read')
	return c.json(await tenant.dump())
})

app.put('/api/tenants', async c => {
	const tenant = await getTenant(c, 'create')
	await tenant.init()
	c.status(201)
	return c.body(null)
})

app.delete('/api/tenants', async c => {
	const tenant = await getTenant(c, 'delete')
	await tenant.deinit()
	c.status(204)
	return c.body(null)
})

export default app satisfies ExportedHandler<Env>
