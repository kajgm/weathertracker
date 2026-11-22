<script setup lang="ts">
import type { UnwrapNestedRefs } from 'vue';
import { Icon } from '@iconify/vue';
import { display, type Weather } from '../composables/useWeather';

defineProps<{ weather: UnwrapNestedRefs<Weather> }>();
</script>

<!-- 480×320 Raspberry Pi kiosk layout, read from across a room: nothing under 20px. -->
<template>
	<div
		class="p-1.5 w-full h-full transition-[filter] duration-[3000ms]"
		:class="weather.isNight ? 'brightness-[0.35]' : 'brightness-100'"
	>
		<div class="bg-zinc-800 rounded-2xl w-full h-full">
			<div class="flex flex-col px-4 py-2 h-full w-full">
				<!-- Current conditions -->
				<div class="flex items-center justify-between">
					<div class="flex items-center" :title="weather.weatherLabel">
						<Icon :icon="`wi:${weather.weatherIcon}`" class="text-[96px] -my-2 text-zinc-300 animate-bounce-slow" />
						<span class="text-[88px] leading-none text-zinc-100">{{ display(weather.currentTemp) }}°</span>
					</div>
					<div class="text-right">
						<div class="text-[32px] leading-tight text-zinc-200">{{ weather.clock }}</div>
						<div class="text-[24px] leading-snug">
							L {{ display(weather.dailyTempMin) }}° H {{ display(weather.dailyTempMax) }}°
						</div>
						<div class="text-[24px] leading-snug flex items-center justify-end">
							<Icon icon="wi:strong-wind" class="text-[30px] mr-1" />{{ display(weather.currentWindSpeed) }} km/h
						</div>
					</div>
				</div>

				<!-- Forecast slots -->
				<div class="grid grid-cols-4 gap-1.5 grow text-center border-t-2 border-zinc-700 mt-1 pt-1">
					<div v-for="slot in weather.slots" :key="slot.hour" class="flex flex-col items-center justify-center">
						<div class="text-[20px] leading-tight">{{ slot.hour }}</div>
						<Icon :icon="`wi:${slot.icon}`" class="text-[44px] -my-1 text-zinc-300" />
						<div class="text-[30px] leading-tight text-zinc-100">{{ slot.temp }}°</div>
						<div class="text-[20px] leading-tight text-sky-300">{{ slot.precipitationProbability }}%</div>
					</div>
				</div>

				<!-- Last refreshed / stale indicator -->
				<div
					class="flex items-center justify-end text-[20px] leading-none -mt-1"
					:class="weather.isStale ? 'text-amber-400' : 'text-zinc-500'"
				>
					<Icon :icon="weather.isStale ? 'mdi:alert-circle-outline' : 'mdi:refresh'" class="text-[22px] mr-1" />
					{{ weather.updatedText }}
				</div>
			</div>
		</div>
	</div>
</template>
