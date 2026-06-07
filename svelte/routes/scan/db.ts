import { Dexie, type EntityTable } from 'dexie'

export interface Tenant {
	tenant: string
	sid: number
	cid: string
	sts: number | null
	cts: number
	actor: string | null
	sub: string
	val: number
}

export const db = new Dexie('Vizo') as Dexie & {
	tenants: EntityTable<Tenant>
}

db.version(1).stores({
	tenants: '[tenant+cid], [tenant+sid], [tenant+sub]',
})
