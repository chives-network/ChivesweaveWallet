<template>
	<SettingItem :icon="LOGO.Chives" name="Guide" description="How to get started using the wallet" to="https://chivesweave.org/chivesweave-wallet"/>
	<SettingItem v-if="Wallets.length" :icon="LOGO.socials.discord" name="Discord" description="Send feedback, questions or talk about anything" to="https://discord.gg/8KrtgBRjZn"/>
	<SettingItem :icon="LOGO.socials.github" name="Github | Web Wallet" description="Source code" to="https://github.com/chives-network/ChivesweaveWallet"/>
</template>



<script setup lang="ts">
import SettingItem from '@/components/composed/SettingItem.vue'
import { Wallets } from '@/functions/Wallets'
import { LOGO } from '@/store/Theme'
import { ICON } from '@/store/Theme'
</script>
