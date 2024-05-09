import Arweave from 'arweave'
import type { BlockEdge, Transaction } from 'arweave-graphql'
import { compact, generateUrl } from '@/functions/Utils'
import { useChannel } from '@/functions/Channels'
import { getAsyncData, getQueryManager, getReactiveAsyncData, useDataWrapper } from '@/functions/AsyncData'
import { computed, isRef, reactive, ref, Ref, watch } from 'vue'
import { notify } from '@/store/NotificationStore'
import InterfaceStore from '@/store/InterfaceStore'
import { makeRef, useList } from '@/functions/UtilsVue'

declare type TransactionNode = {
    block: any;
	data: {type: string, size: number};
	fee: {xwe: number, winston: number};
	id: string;
	owner: {address: string};
	quantity: {xwe: number, winston: number};
	recipient: string;
	tags: [];
};


export const gatewayDefault = 'https://api.chivesweave.org:1986/' //'https://api.chivesweave.org:1986/'
export const bundlerDefault = 'https://node2.bundlr.network/'

if (localStorage.getItem('gateway') === JSON.stringify(gatewayDefault)) { localStorage.removeItem('gateway') } // todo remove, temp conversion
if (localStorage.getItem('bundler') === JSON.stringify(bundlerDefault)) { localStorage.removeItem('bundler') } // todo remove, temp conversion

const ArweaveStore = reactive({
	gatewayURL: useChannel('gateway', undefined, gatewayDefault).state, // todo useChannel init to a RefMaybe
	bundlerURL: useChannel('bundler', undefined, bundlerDefault).state,
	uploads: {} as { [key: string]: { upload?: number } },
})

export default ArweaveStore
export var arweave: Arweave

export function urlToSettings (url: string) {
	const obj = new URL(url)
	const protocol = obj.protocol.replace(':', '')
	const host = obj.hostname
	const port = obj.port ? parseInt(obj.port) : protocol === 'https' ? 443 : 80
	return { protocol, host, port }
}

export async function updateArweave (url?: string, sync?: boolean): Promise<true> {
	url = url ? generateUrl(url) : gatewayDefault
	const settings = urlToSettings(url)
	if (!sync && url !== gatewayDefault) { await testGateway(settings) }
	arweave = Arweave.init(settings)
	return true
}

async function testGateway (settings: ReturnType<typeof urlToSettings> | string): Promise<true> {
	settings = typeof settings === 'string' ? urlToSettings(settings) : settings
	const arweaveTest = Arweave.init(settings)
	let net = await arweaveTest.network.getInfo() as any
	try { if (typeof net === 'string') { net = JSON.parse(net) } } catch (e) {}
	if (!net?.network) { console.error(net); throw 'Gateway Unreachable' }
	return true
}

export async function updateBundler (url?: string, sync?: boolean) {
	url = url ? generateUrl(url) : bundlerDefault
	ArweaveStore.bundlerURL = url !== bundlerDefault ? url : undefined as any
}

export function useWatchTx (txId: Ref<string | undefined>) {
	console.log("useWatchTx",txId)
	return getReactiveAsyncData({
		name: 'single tx header',
		params: txId,
		query: async (txId) => (
			await fetch(ArweaveStore.gatewayURL+'wallet/'+ txId +'/txrecord').then(res => res.json().then(res => res)).catch(() => {})
		),
		completed: (state: any) => state?.block,
		seconds: 10,
	})
}

export async function fetchPublicKey (address: string) {
	console.log("fetchPublicKey",address)
	const tx = (await graphql.getTransactions({ owners: [address] })).transactions.edges
	return tx?.[0]?.owner.key as string | undefined
}

export async function getData (id: string): Promise<string | undefined> {
	let payload = undefined
	try { payload ??= (await arweave.api.get(id)).data } catch (e) { }
	try { payload ??= await arweave.transactions.getData(id, { decode: true, string: true }) } catch (e) { }
	if (!payload) { throw 'Error accessing the data' }
	return payload
}


const txSort = (a: Transaction, b: Transaction) => blockSort({ node: a, cursor: '' }, { node: b, cursor: '' })
const txPrioritize = (a: Transaction, b: Transaction) => a.block && b.block ? txSort(a, b) : +!!b.block - +!!a.block

const blockSort = (a: TransactionNode, b: TransactionNode) => (b.block?.height ?? Number.MAX_SAFE_INTEGER)
	- (a.block?.height ?? Number.MAX_SAFE_INTEGER)

type arweaveQueryOptions = Parameters<any>[0] | Ref<Parameters<any>[0]>

export function arweaveQuery (options: arweaveQueryOptions, name = 'tx query list') { 
	const optionsRef = isRef(options) ? options : ref(options)
	const status = reactive({ completed: false, reset: 0 })
	const list = useList<TransactionNode>({
		key: a => a.id,
		sort: blockSort, // todo use txSort
		prioritize: (a, b) => a.block && b.block ? blockSort(a, b) : +!!b.block - +!!a.block 
	})
	const refresh = 10
	const refreshEnabled = ref(false)
	const refreshSwitch = ref(true) // todo
	
	watch(optionsRef, () => {
		list.state.value = []
		refreshEnabled.value = false
		status.completed = false
		status.reset++
	}, { deep: true })
	

	let PageId_Deposits = 0
	let PageRecords_Deposits = 20

	let PageId_Sent = 0
	let PageRecords_Sent = 20

	let PageId_Data = 0
	let PageRecords_Data = 20

	let PendingTxsAmount = 0
	
	const fetchQuery = getQueryManager({
		name: name + ' fetch',
		query: async () => {
			if (optionsRef.value == null) { status.completed = true }
			if (status.completed) { return [] }
			let fulfilled = false
			let results = undefined as undefined | TransactionNode[]
			try {
				const firstFetch = !list.state.value.length
				for (let i = 0; !fulfilled; i++) {
					//console.log("getQueryManager results 1 ", optionsRef.value)
					if(optionsRef.value != undefined && "recipients" in optionsRef.value && optionsRef.value['recipients']) {
						results = await fetch(ArweaveStore.gatewayURL+'wallet/'+ optionsRef.value['recipients'][0] +'/deposits/'+ PageId_Deposits +'/'+ PageRecords_Deposits).then(res => res.json().then(res => res.data)).catch(() => {})
						if(results && results.length!=PageRecords_Sent) {
							fulfilled = true
						}
						else {						
							PageId_Deposits = PageId_Deposits + 1
						}
						//console.log("getQueryManager deposits 2 ",results)
						list.add(results || [])
					}
					if(optionsRef.value != undefined && "owners" in optionsRef.value && optionsRef.value['owners'] && "type" in optionsRef.value && optionsRef.value['type']=='sent') {
						results = await fetch(ArweaveStore.gatewayURL+'wallet/'+ optionsRef.value['owners'][0] +'/send/'+ PageId_Sent +'/'+ PageRecords_Sent).then(res => res.json().then(res => res.data)).catch(() => {})
						if(results && results.length!=PageRecords_Sent) {
							fulfilled = true
						}
						else {						
							PageId_Sent = PageId_Sent + 1
						}
						//console.log("getQueryManager  2 ",results)
						list.add(results || [])
					}
					if(optionsRef.value != undefined && "owners" in optionsRef.value && optionsRef.value['owners'] && "type" in optionsRef.value && optionsRef.value['type']=='files') {
						results = await fetch(ArweaveStore.gatewayURL+'wallet/'+ optionsRef.value['owners'][0] +'/datarecord/'+ PageId_Data +'/'+ PageRecords_Data).then(res => res.json().then(res => res.data)).catch(() => {})
						if(results && results.length!=PageRecords_Sent) {
							fulfilled = true
						}
						else {						
							PageId_Data = PageId_Data + 1
						}
						//console.log("getQueryManager all 2 ",results)
						list.add(results || [])
					}
					if(optionsRef.value != undefined && "owners" in optionsRef.value && optionsRef.value['owners'] && "type" in optionsRef.value && optionsRef.value['type']=='all') {
						results = await fetch(ArweaveStore.gatewayURL+'wallet/'+ optionsRef.value['owners'][0] +'/txsrecord/'+ PageId_Data +'/'+ PageRecords_Data).then(res => res.json().then(res => res.data)).catch(() => {})
						if(results && results.length!=PageRecords_Sent) {
							fulfilled = true
						}
						else {						
							PageId_Data = PageId_Data + 1
						}
						//console.log("getQueryManager files 2 ",results)
						list.add(results || [])
					}
					status.completed = true; 
					fulfilled = true;
				}
				if (firstFetch) { setTimeout(() => refreshEnabled.value = true, refresh * 1000) }
			}
			catch (e) { console.error("Error getQueryManager 158",e); await new Promise<void>(res => setTimeout(() => res(), 10000)); throw e }
			//console.log("getQueryManager results getQueryManager ",results)
			if(results) {
				PendingTxsAmount = 0
				for (const result of results) {
					if (!result.block || !result.block.height) { 
						let MyAddress = ""
						if(optionsRef.value != undefined && "owners" in optionsRef.value && optionsRef.value['owners']) {
							MyAddress  = optionsRef.value['owners'][0]
						}
						if(optionsRef.value != undefined && "recipients" in optionsRef.value && optionsRef.value['recipients']) {
							MyAddress  = optionsRef.value['recipients'][0]
						}
						if(MyAddress==result.owner.address && result.recipient=="") {
							//send to data or file to myself
							PendingTxsAmount = PendingTxsAmount - result.fee.xwe - result.quantity.xwe
						}
						if(MyAddress==result.owner.address && result.recipient!="" && result.recipient!=result.owner.address) {
							//send to data or tx to others
							PendingTxsAmount = PendingTxsAmount - result.fee.xwe - result.quantity.xwe
						}
						if(MyAddress==result.recipient) {
							//send to data or tx to others
							PendingTxsAmount = PendingTxsAmount + result.quantity.xwe
						}
						 
					}
				}
				console.log("PendingTxsAmount", PendingTxsAmount)
			}
			return results
		},
	})

	const updateQuery = getAsyncData({
		name: name + ' getAsyncData update',
		awaitEffect: () => !fetchQuery.queryStatus.running && refreshEnabled.value,
		query: async () => {
			let removeContent = [] as TransactionNode[]
			let addContent = [] as TransactionNode[]
			let fulfilled = false
			let results = undefined as undefined | TransactionNode[]
			let isHaveMemPoolTx = false;
			for (let i = 0; !fulfilled; i++) {
				//console.log("getAsyncData161______",optionsRef.value)
				if(optionsRef.value != undefined && "recipients" in optionsRef.value && optionsRef.value['recipients']) {
					results = await fetch(ArweaveStore.gatewayURL+'wallet/'+ optionsRef.value['recipients'][0] +'/deposits/'+ PageId_Deposits +'/'+ PageRecords_Deposits).then(res => res.json().then(res => res.data)).catch(() => {})
					if(results && results.length!=PageRecords_Sent) {
						fulfilled = true
					}
					else {						
						PageId_Deposits = PageId_Deposits + 1
					}
					//console.log("getQueryManager deposits 2 ",results)
					list.add(results || [])
				}
				if(optionsRef.value != undefined && "owners" in optionsRef.value && optionsRef.value['owners'] && "type" in optionsRef.value && optionsRef.value['type']=='sent') {
					results = await fetch(ArweaveStore.gatewayURL+'wallet/'+ optionsRef.value['owners'][0] +'/send/'+ PageId_Sent +'/'+ PageRecords_Sent).then(res => res.json().then(res => res.data)).catch(() => {})
					if(results && results.length!=PageRecords_Sent) {
						fulfilled = true
					}
					else {						
						PageId_Sent = PageId_Sent + 1
					}
					//console.log("getQueryManager sent PageId_Deposits ",PageId_Deposits)
					list.add(results || [])
				}
				if(optionsRef.value != undefined && "owners" in optionsRef.value && optionsRef.value['owners'] && "type" in optionsRef.value && optionsRef.value['type']=='files') {
					results = await fetch(ArweaveStore.gatewayURL+'wallet/'+ optionsRef.value['owners'][0] +'/datarecord/'+ PageId_Data +'/'+ PageRecords_Data).then(res => res.json().then(res => res.data)).catch(() => {})
					if(results && results.length!=PageRecords_Sent) {
						fulfilled = true
					}
					else {						
						PageId_Data = PageId_Data + 1
					}
					//console.log("getQueryManager files 2 ",results)
					list.add(results || [])
				}
				if(optionsRef.value != undefined && "owners" in optionsRef.value && optionsRef.value['owners'] && "type" in optionsRef.value && optionsRef.value['type']=='all') {
					results = await fetch(ArweaveStore.gatewayURL+'wallet/'+ optionsRef.value['owners'][0] +'/txsrecord/'+ PageId_Data +'/'+ PageRecords_Data).then(res => res.json().then(res => res.data)).catch(() => {})
					if(results && results.length!=PageRecords_Sent) {
						fulfilled = true
					}
					else {						
						PageId_Data = PageId_Data + 1
					}
					//console.log("getQueryManager all 2 ",results)
					list.add(results || [])
				}
				status.completed = true; 
				fulfilled = true;
				if(results) {
					PendingTxsAmount = 0
					for (const result of results) {
						const matchingTx = list.state.value.find(el => el.id === result.id)
						if (matchingTx) {
							if (matchingTx.block && matchingTx.block.height) { fulfilled = true }
							else if (result.block && result.block.height) { removeContent.push(matchingTx); addContent.push(result) }
						} 
						else { 
							addContent.push(result) 
						}
						if (!result.block || !result.block.height) { 
							isHaveMemPoolTx = true 
							let MyAddress = ""
							if(optionsRef.value != undefined && "owners" in optionsRef.value && optionsRef.value['owners']) {
								MyAddress  = optionsRef.value['owners'][0]
							}
							if(optionsRef.value != undefined && "recipients" in optionsRef.value && optionsRef.value['recipients']) {
								MyAddress  = optionsRef.value['recipients'][0]
							}
							if(MyAddress==result.owner.address && result.recipient=="") {
								//send to data or file to myself
								PendingTxsAmount = PendingTxsAmount - result.fee.xwe - result.quantity.xwe
							}
							if(MyAddress==result.owner.address && result.recipient!="" && result.recipient!=result.owner.address) {
								//send to data or tx to others
								PendingTxsAmount = PendingTxsAmount - result.fee.xwe - result.quantity.xwe
							}
							if(MyAddress==result.recipient) {
								//send to data or tx to others
								PendingTxsAmount = PendingTxsAmount + result.quantity.xwe
							}
							 
						}
					}
					console.log("removeContent", removeContent)
					console.log("addContent", addContent)
					console.log("PendingTxsAmount", PendingTxsAmount)
				}
			}
			if(isHaveMemPoolTx==false)  {
				//results have all txs, not have mempool txs, so need to ensure the list not include mempool txs
				list.state.value.map((result)=>{
					if (!result.block || !result.block.height) { 
						removeContent.push(result);
					}
				})
			}
			list.remove(removeContent)
			list.add(addContent)
			return results as TransactionNode[]
		},
		seconds: refresh,
		existingState: list.state,
		processResult: () => {},
		completed: () => optionsRef.value?.block?.max
			|| optionsRef.value?.bundledIn || !refreshSwitch.value
			|| optionsRef.value?.ids && list.state.value.length === (optionsRef.value?.ids.length || 1)
	})
	
	const fetchAll = async () => {
		while (!status.completed) { await fetchQuery.query() }
		return list.state
	}
	
	return { state: updateQuery.state, list, fetchQuery, updateQuery, status, refreshSwitch, fetchAll, key: '' + Math.random(), PendingTxsAmount }
}

export function arweaveQueryBlocks (options: Parameters<any>[0]) { // todo rename to arweaveBlocks and make reactive
	const status = reactive({ completed: false })
	const data = ref([] as BlockEdge[])
	const refresh = 10
	const refreshEnabled = ref(false)
	
	const fetchQuery = getQueryManager({
		name: 'block list fetch',
		query: async () => {
			if (status.completed) { return data.value }
			let results: any
			try {
				const PageId = 1
				const url = ArweaveStore.gatewayURL+'blockpage/'+ PageId +'/10'
				results = await fetch(url).then(res => res.json().then(res => res.data)).catch(() => {})
				status.completed = true
				data.value.push(...results)
			} catch (e) { console.error(e); await new Promise<void>(res => setTimeout(() => res(), 10000)) }
		},
	})
	
	const updateQuery = getAsyncData({
		name: 'block list update',
		awaitEffect: () => !fetchQuery.queryStatus.running && refreshEnabled.value,
		query: async () => {
			const PageId = 1
			const url = ArweaveStore.gatewayURL+'blockpage/'+ PageId +'/10'
			const results = await fetch(url).then(res => res.json().then(res => res.data)).catch(() => {})
			return results
		},
		seconds: refresh,
		existingState: data,
		processResult: () => {},
	})
	
	return { state: updateQuery.state, fetchQuery, updateQuery, status, key: '' + Math.random() }
}

export function arweaveQueryBundleId (TxId: string) { // todo rename to arweaveBlocks and make reactive
	const status = reactive({ completed: false })
	const data = ref([] as BlockEdge[])
	const refresh = 10
	const refreshEnabled = ref(false)
	
	const fetchQuery = getQueryManager({
		name: 'arweaveQueryBundleId fetch',
		query: async () => {
			if (status.completed) { return data.value }
			let results: any = []
			try {
				const url = ArweaveStore.gatewayURL+"tx/"+TxId+"/unbundle/0/100"
				results = await fetch(url).then(res => res.json().then(res => res.txs)).catch(() => {})
				console.log("results", results)
				status.completed = true
				data.value.push(...results)
			} catch (e) { console.error(e); await new Promise<void>(res => setTimeout(() => res(), 10000)) }
		},
	})
	
	const updateQuery = getAsyncData({
		name: 'arweaveQueryBundleId update',
		awaitEffect: () => !fetchQuery.queryStatus.running && refreshEnabled.value,
		query: async () => {			
			const { unbundleData } = await import('@/../scripts/arbundles')
			const url = ArweaveStore.gatewayURL+TxId
			const result = await fetch(url).then(res => res.arrayBuffer()).catch(() => {})
			const buffer = Buffer.from(result);
			const unbundleDataBuffer = unbundleData(buffer);
			return unbundleDataBuffer.items
		},
		seconds: refresh,
		existingState: data,
		processResult: () => {},
	})
	
	return { state: updateQuery.state, fetchQuery, updateQuery, status, key: '' + Math.random() }
}


export function arweaveQueryTxsRecord (blockHeight: number) { // todo rename to arweaveBlocks and make reactive
	const status = reactive({ completed: false })
	const data = ref([] as BlockEdge[])
	const refresh = 10
	const refreshEnabled = ref(false)
	
	const fetchQuery = getQueryManager({
		name: 'arweaveQueryTxsRecord fetch',
		query: async () => {
			if (status.completed) { return data.value }
			let results: any
			try {
				const url = ArweaveStore.gatewayURL+'block/txsrecord/'+ blockHeight
				results = await fetch(url).then(res => res.json().then(res => res)).catch(() => {})
				status.completed = true
				data.value.push(...results)
			} catch (e) { console.error(e); await new Promise<void>(res => setTimeout(() => res(), 10000)) }
		},
	})
	
	const updateQuery = getAsyncData({
		name: 'arweaveQueryTxsRecord update',
		awaitEffect: () => !fetchQuery.queryStatus.running && refreshEnabled.value,
		query: async () => {
			const url = ArweaveStore.gatewayURL+'block/txsrecord/'+ blockHeight
			const results = await fetch(url).then(res => res.json().then(res => res)).catch(() => {})
			return results
		},
		seconds: refresh,
		existingState: data,
		processResult: () => {},
	})
	
	return { state: updateQuery.state, fetchQuery, updateQuery, status, key: '' + blockHeight }
}

export function queryAggregator (queries: RefMaybe<ReturnType<typeof arweaveQuery>[]>) {
	const list = useList<TransactionNode>({ // todo generalize
		key: a => a.id,
		sort: blockSort, // todo use txSort
		prioritize: (a, b) => a.block && b.block ? blockSort(a, b) : +!!b.block - +!!a.block 
	})
	const refresh = 10
	const queriesRef = makeRef(queries)
	const refreshSwitch = ref(true) // todo
	watch(refreshSwitch, val => queriesRef.value.forEach(q => q.refreshSwitch = val))
	const boundary = computed(() => {
		let notReady = false
		const boundaries = queriesRef.value.map(q => {
			if (q.status.completed) { return }
			else if (!q.list.state.length) { notReady = true; return }
			const res = q.list.state.filter(tx => tx?.block)
			if (!res?.length) { return }
			return res[res.length - 1]
		})
		if (notReady) { return true } // any tx is overreach
		const res = compact(boundaries).sort(list.sort)
		if (!res.length) { return }
		return res[0]
	})
	const overreached = computed(() => {
		const bound = boundary.value
		if (bound === true) { return queriesRef.value.map(q => q.list.state.length ? q.list.state : []) }
		if (!bound) { return [] }
		return queriesRef.value.map(q => {
			const pos = q.list.state.findIndex(el => el && (el === bound || list.sort(bound, el) < 0))
			const slicePos = q.list.state[pos] === bound ? pos : pos
			if (q.list.state.length <= slicePos + 1) { return [] }
			if (slicePos < 0) { return [] }
			return q.list.state.slice(slicePos)
		})
	})
	const filterOverreach = (txs: TransactionNode[], queries?: any[]) => {
		const bound = boundary.value
		if (bound === true) { return [] }
		const indexes = queries?.map(q => queriesRef.value.indexOf(q)).filter(i => i >= 0)
		const overreachedFlat = indexes?.length ? overreached.value.filter((_, i) => indexes.includes(i)).flat() : overreached.value.flat()
		return txs.filter(tx => !overreachedFlat.includes(tx))
	}
	watch(overreached, (val, oldVal) => {
		const newValFlat = val.flat()
		const oldValFlat = oldVal.flat()
		const removed = oldValFlat.filter(tx => tx && !newValFlat.includes(tx))
		// todo handle when new empty query is dynamically inserted
		// todo add value only if still included in respective query
		if (removed.length) { list.add(removed) }
	}, { deep: true, flush: 'sync' })
	const completed = computed(() => queriesRef.value.length === 0 || !overreached.value.flat().length && queriesRef.value.every(q => q.status.completed))
	const status = reactive({ completed, reset: 0 })
	const wrapper = useDataWrapper(queriesRef, el => el.key, query => {
		const watchStop = watch(() => query.status.reset, () => {
			list.state.value = []
			status.reset++
		})
		const actions = ['add', 'remove'] as const satisfies AsConst<(keyof ReturnType<typeof useList>)[]>
		return actions.map((action: typeof actions[number]) => {
			const callback = (txs: TransactionNode[]) => {
				if (action === 'remove') { return list[action](txs) } // todo make watch(overreached) ignore removed
				return list[action](filterOverreach(txs, [query]))
			}
			query.list.emitter.on(action, callback)
			return () => { query.list.emitter.off(action, callback); watchStop() }
		})
	}, handlers => handlers.map(e => e()))
	watch(wrapper, () => {}) // always use lazy computed
	const state = computed(() => {
		if (!boundary.value ) { return list.state.value }
		const pos = list.state.value?.indexOf(boundary.value as any) ?? 0
		const slicePos = list.state.value[pos] === boundary.value ? pos + 1 : pos
		if (slicePos < 0) { return [] }
		if (list.state.value?.length <= slicePos + 1) { return list.state.value }
		console.warn('corrected', list.state.value?.slice(slicePos).map(e => e.id)) // todo figure that out
		list.remove(list.state.value?.slice(slicePos))
		return list.state.value
	})
	const fetchQuery = getQueryManager({
		name: 'aggregated fetch',
		query: async () => {
			const queriesInRange = queriesRef.value.filter((query, i) => !overreached.value[i]?.length)
			return Promise.all(queriesInRange.map(q => q.fetchQuery.query())).then(res => compact(res).flat())
		},
	})
	const updateQuery = getAsyncData({
		name: 'aggregated update',
		query: async () => Promise.all(queriesRef.value.map(query => query.updateQuery.getState())).then(res => compact(res).flat()),
		seconds: refresh,
		existingState: state,
		processResult: () => {},
	})
	const fetchAll = () => Promise.all(queriesRef.value.map(q => q.fetchAll())) as any
	return { state: updateQuery.state, list, fetchQuery, updateQuery, status, refreshSwitch, fetchAll, key: '' + Math.random() }
}


//
// async function refreshTx () {
// 	if (!InterfaceStore.windowVisible) { return }
// 	let requireSort = false
// 	const ids = []
// 	const txs = []
// 	for (const key in ArweaveStore.txs) {
// 		if (!ArweaveStore.txs[key].block) {
// 			ids.push(key)
// 			txs.push(ArweaveStore.txs[key])
// 		}
// 	}
// 	if (ids.length === 0) { return }
// 	const results = await arDB.search().ids(ids).findAll() as GQLEdgeTransactionInterface[]
// 	console.log('updating:', results)
// 	for (const tx of txs) {
// 		const updatedTx = results.find((el) => el?.node?.id === tx.id)?.node
// 		if (updatedTx) {
// 			if (updatedTx.block) { requireSort = true }
// 			Object.assign(tx, updatedTx)
// 		} else {
// 			console.error('tx missing? :0', tx)
// 		}
// 	}
// 	if (requireSort) { sortByBlocks() }
// 	return
// }
//
// function sortByBlocks (wallet?: ArweaveAccount, query?: Query) {
// 	const sort = (a: GQLEdgeTransactionInterface, b: GQLEdgeTransactionInterface) => (b.block?.height ?? Number.MAX_SAFE_INTEGER)
// 		- (a.block?.height ?? Number.MAX_SAFE_INTEGER)
// 	if (wallet && wallet.queries[query!]) {
// 		wallet.queries[query!].sort(sort)
// 	} else {
// 		for (const key in ArweaveStore.wallets) {
// 			for (const query in ArweaveStore.wallets[key].queries) {
// 				ArweaveStore.wallets[key].queries[query].sort(sort)
// 			}
// 		}
// 	}
// }


const networkInfoData = getAsyncData({
	name: 'network info',
	query: () => arweave.network.getInfo(),
	processResult: state => typeof state === 'string' ? JSON.parse(state) : state,
	seconds: 10,
})
watch(() => ArweaveStore.gatewayURL, () => networkInfoData.state.value = undefined)
export const networkInfo = networkInfoData.state



export async function getIndepHash () {
	const res = await networkInfoData.getState()
	const indepHash = res?.current
	if (!indepHash) { throw 'failed to get indepHash' }
	return indepHash
}



export const currentBlockData = getAsyncData({
	name: 'current block',
	query: () => getIndepHash().then(h => arweave.blocks.get(h)),
	processResult: state => typeof state === 'string' ? JSON.parse(state) : state,
	seconds: 60,
	stale: (state) => networkInfoData.stateRef.value && state && networkInfoData.stateRef.value.height > state.height,
	completed: (state) => networkInfoData.stateRef.value && state && networkInfoData.stateRef.value.height == state.height,
})
export const currentBlock = currentBlockData.state



async function loadGatewaySettings () {
	updateArweave(ArweaveStore.gatewayURL || gatewayDefault, true)
	updateBundler(ArweaveStore.bundlerURL || bundlerDefault, true)
	const { state, stop } = useChannel('localGatewayTest')
	if (state.value && Date.now() - state.value > 2600000000) { state.value = undefined }
	if (!ArweaveStore.gatewayURL && !state.value && InterfaceStore.online) {
		const isLocal = await updateArweave(location.origin).catch(() => {})
		const isReachable = isLocal || await testGateway(gatewayDefault).catch(async e => {
			const isp = await fetch('http://ip-api.com/json').then(res => res.json().then(res => res?.isp as string)).catch(() => {})
			//track.event('Error', { e, value: gatewayDefault, isp })
			notify.error({
				title: `Default gateway is unreachable`,
				body: `${new URL(gatewayDefault).hostname} may be blocked by your internet service provider or is temporarily unavailable`,
				requireInteraction: true,
			})
			const fallbackReachable = await updateArweave('https://node2.chivesweave.net').catch(() => false)
			return fallbackReachable
		})
		if (isReachable) { state.value = Date.now() }
	}
	stop()
}
loadGatewaySettings()



export function normalizeTo (unit: 'ar' | 'winston', props: {
	ar?: string | number
	winston?: string | number
}) {
	if (props.ar != undefined) { return unit === 'ar' ? props.ar.toString() : arweave.ar.winstonToAr(props.ar.toString()) }
	if (props.winston != undefined) { return unit === 'ar' ? arweave.ar.winstonToAr(props.winston.toString()) : props.winston.toString() }
}