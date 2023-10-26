<template>
	<span>
		<Ar :ar="amount" /><template v-if="!slots.default">&nbsp;</template>
		<slot />
	</span>
</template>



<script setup lang="ts">
import Ar from '@/components/atomic/Ar.vue'
import { arweave } from '@/store/ArweaveStore'
import { ref, useSlots, watch } from 'vue'

const props = defineProps(['ar', 'winston'])
const slots = useSlots()

const amount = ref(undefined as undefined | string)
watch(() => props, async () => {
	if (props.ar != undefined) { return amount.value = props.ar }
	if (props.winston) { return amount.value = arweave.ar.winstonToAr(props.winston) }
	amount.value = undefined
}, { immediate: true, deep: true })
</script>