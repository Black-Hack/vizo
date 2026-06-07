<script lang="ts">
	import { page } from '$app/state'
	import { liveQuery } from 'dexie'
	import { db } from './db.js'
	import { createWebSocket } from './ws.js'
	import type { PageProps } from './$types.js'
	import { isValid } from '$lib/sig.js'
	import { BarcodeDetector as BarcodeDetectorPonyfill } from 'barcode-detector/ponyfill'

	let { data }: PageProps = $props()

	if (localStorage.getItem('actor') === null) {
		localStorage.setItem('actor', crypto.randomUUID())
	}
	const actor = localStorage.getItem('actor')!

	let video: HTMLVideoElement

	let currectSub = $state<string | null>(null)
	let stream: MediaStream | null = $state.raw(null)

	function createBarcode() {
		try {
			return new BarcodeDetector({ formats: ['qr_code'] })
		} catch {
			return new BarcodeDetectorPonyfill({ formats: ['qr_code'] })
		}
	}

	const detector = createBarcode()

	async function validateQRCode(rawValue: string): Promise<string | null> {
		try {
			const url = new URL(rawValue)
			const sub = url.searchParams.get('sub')
			const tenant = url.searchParams.get('tenant')
			const sig = url.searchParams.get('sig')
			if (tenant === null || sub === null || sig === null) return null
			if (!(await isValid(`${tenant}:${sub}`, sig))) return null
			return sub
		} catch {
			return null
		}
	}

	async function detectCodes() {
		try {
			return (await detector?.detect(video)) ?? []
		} catch {
			return []
		}
	}

	async function findSub(): Promise<void> {
		const barcodes = await detectCodes()
		for (const barcode of barcodes) {
			const sub = await validateQRCode(barcode.rawValue)
			if (sub !== null) {
				currectSub = sub
				break
			}
		}
	}

	async function startCamera() {
		if (stream) return
		stream = await navigator.mediaDevices.getUserMedia({
			video: { facingMode: 'environment' },
		})
		video.srcObject = stream

		while (stream !== null) {
			await findSub()
			await new Promise(resolve => setTimeout(resolve, 100))
		}
	}

	function stopCamera() {
		if (!stream) return
		stream.getTracks().forEach(track => track.stop())
		stream = null
	}

	async function addTransactions(val: number) {
		if (currectSub === null || currectSub.length !== 4) return
		await db.tenants.add({
			tenant: data.tenant,
			sid: 0,
			cid: crypto.randomUUID(),
			sts: null,
			cts: Date.now(),
			actor,
			sub: currectSub,
			val,
		})
	}

	let transactions = $derived.by(() => {
		const sub = currectSub ?? ''
		return liveQuery(() =>
			db.tenants.where(['tenant', 'sub']).equals([data.tenant, sub]).toArray(),
		)
	})

	let score = $derived(($transactions ?? []).reduce((acc, tx) => acc + tx.val, 0))

	let pending = $derived(
		liveQuery(() => db.tenants.where(['tenant', 'sid']).equals([data.tenant, 0]).toArray()),
	)

	$effect(() => createWebSocket(data.tenant, data.sig))
</script>

<video
	bind:this={video}
	autoplay
	muted
	playsinline
	disablepictureinpicture
	disableremoteplayback
	controlslist="nofullscreen nodownload noremoteplayback noplaybackrate"></video>
{#if currectSub === 'dbg'}
	<textarea>{JSON.stringify($pending, null, 2)}</textarea>
{/if}
<div class="top-bar">
	<div style="width: 50%;">
		{#if currectSub !== null && currectSub.length !== 0}
			<div class="clear-text">Card</div>
		{/if}
		<input
			type="text"
			inputmode="numeric"
			maxlength="4"
			class="clear-text"
			style="font-size: 4em;"
			bind:value={currectSub}
			autocomplete="off" />
	</div>
	{#if $pending?.length !== 0}
		<div>
			<div class="clear-text">Pending</div>
			<div class="clear-text" style="font-size: 2em;">{$pending?.length}</div>
		</div>
	{/if}
	{#if currectSub !== null && currectSub.length === 4}
		<div>
			<div class="clear-text">Score</div>
			<div class="clear-text" style="font-size: 4em;">{score}</div>
		</div>
	{/if}
</div>
<div class="bottom-bar">
	{#if currectSub !== null && currectSub.length === 4}
		<button style="font-size: 2.75em;" onclick={() => addTransactions(2)}>+2</button>
		<button style="font-size: 2.75em;" onclick={() => addTransactions(5)}>+5</button>
		<button style="font-size: 2.75em;" onclick={() => addTransactions(-2)}>-2</button>
		<button style="font-size: 2.75em;" onclick={() => addTransactions(-5)}>-5</button>
	{/if}
	{#if !stream}
		<button style="font-size: 2.75em;" onclick={startCamera}>Start Camera</button>
	{:else}
		<button style="font-size: 2.75em;" onclick={stopCamera}>Stop</button>
	{/if}
	{#if currectSub === 'dbg'}
		<button
			style="font-size: 2.75em;"
			onclick={() => {
				db.tenants.clear()
			}}>Clear Local Database</button>
	{/if}
</div>

<style>
	video {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		z-index: -1;
	}

	input {
		background-color: transparent;
		border: 0px none;
		width: 100%;
		padding: 0;
	}

	.top-bar {
		position: absolute;
		top: 8px;
		right: 8px;
		left: 8px;
		display: flex;
		justify-content: space-between;
		gap: 4px;
		padding: 8px;
		border-radius: 8px;
		z-index: -1;
	}

	.bottom-bar {
		position: absolute;
		bottom: 8px;
		left: 8px;
		right: 8px;
		display: flex;
		flex-direction: row-reverse;
		flex-wrap: wrap;
		gap: 8px;
		z-index: -1;
	}

	.clear-text {
		color: white;
		text-shadow: 0 0 2px black;
	}
</style>
