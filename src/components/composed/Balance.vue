<template>
	<div class="balance flex-column">
		<div class="amounts">
			<div class="flex-row">
				<div style="flex: 1 0 0;">
					<div class="flex-row big" style="align-items: baseline;">
						<Ar :ar="wallet.balance" />
						<Button v-if="wallet.balance && mint" :run="mint" style="height: 2.1em; width: 2em;">
							<Icon icon="+" />
						</Button>
					</div>
				</div>
				<div v-if="wallet.pendingbalance !== '0'" style="flex: 1 1 auto; opacity: 0.75;">
					<div class="flex-row big">
						<Ar :ar="wallet.pendingbalance" />
					</div>
					<div>
						Pending Amount
					</div>
				</div>				
				<div v-else-if="wallet.reserved_rewards_total" style="flex: 1 1 auto; opacity: 0.75;">
					<div class="flex-row big">
						<Ar :winston="wallet.reserved_rewards_total" />
					</div>
				</div>
			</div>
		</div>
		<WalletInfo :wallet="wallet" />
	</div>
</template>



<script setup lang="ts">
import Ar from '@/components/atomic/Ar.vue'
import WalletInfo from '@/components/composed/WalletInfo.vue'
import Button from '@/components/atomic/Button.vue'
import Icon from '@/components/atomic/Icon.vue'
import ArweaveStore, { networkInfo } from '@/store/ArweaveStore'
import { computed } from 'vue'

const props = defineProps<{ wallet: Wallet }>()

const mint = computed(() => {
	if (!networkInfo.value?.network?.includes('arlocal')) { return }
	return async () => {
		await fetch(ArweaveStore.gatewayURL + 'mint/' + props.wallet.key + '/1000000000000')
		props.wallet.queryBalance.getState(true)
	}
})

</script>



<style scoped>
.balance {
	border-radius: 24px;
	overflow: hidden;
	/* line-height: 1.2; */
	/* padding: var(--spacing) 0; */
	display: flex;
	flex-direction: column;
}

.balance > * {
	padding: 0 10px 0 10px;
}

.big {
	font-size: 2em;
}
</style>
