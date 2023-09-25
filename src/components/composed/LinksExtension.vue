<template>
	<SettingItem :icon="LOGO.browsers.chrome" name="Chrome" description="Chrome Web Store" to="https://chrome.google.com/webstore/detail/chivesweaveapp/hloekinecmafifaghekdjepphlabepkl" />
	<SettingItem :icon="LOGO.browsers.edge" name="Edge" description="Chrome Web Store" to="https://chrome.google.com/webstore/detail/chivesweaveapp/hloekinecmafifaghekdjepphlabepkl" />
</template>



<script setup lang="ts">
import SettingItem from '@/components/composed/SettingItem.vue'
import { LOGO } from '@/store/Theme'
</script>
