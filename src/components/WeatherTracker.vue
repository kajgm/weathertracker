<script setup lang="ts">
import { reactive } from 'vue';
import { useWeather } from '../composables/useWeather';
import { useMediaQuery } from '../composables/useMediaQuery';
import KioskView from './KioskView.vue';
import MobileView from './MobileView.vue';

// Settings (location, forecast slots, dimming window, …) live in ../composables/useWeather.ts.
const weather = reactive(useWeather());

// Phones held upright get the full-height layout; everything else, including
// the 480×320 Pi display and phones in landscape, gets the kiosk layout.
const isPhone = useMediaQuery('(max-width: 639px) and (orientation: portrait)');
</script>

<template>
	<MobileView v-if="isPhone" :weather="weather" />
	<div v-else class="flex h-screen">
		<div class="w-pi-w h-pi-h m-auto">
			<KioskView :weather="weather" />
		</div>
	</div>
</template>
