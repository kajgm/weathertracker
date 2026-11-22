<script setup lang="ts">
import { nextTick, onUnmounted, ref, watch, type UnwrapNestedRefs } from 'vue';
import { Icon } from '@iconify/vue';
import { display, type Weather } from '../composables/useWeather';

defineProps<{ weather: UnwrapNestedRefs<Weather> }>();

// Collapsed: the big at-a-glance view with a 4-slot strip.
// Expanded: a compact header and an hour-by-hour list for the next 24 hours.
const expanded = ref(false);
const expandButton = ref<HTMLButtonElement | null>(null);
const collapseButton = ref<HTMLButtonElement | null>(null);

function onKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') expanded.value = false;
}

// Keep keyboard focus on the control that toggles the view, and let Escape close it.
watch(expanded, async (open) => {
	if (open) window.addEventListener('keydown', onKeydown);
	else window.removeEventListener('keydown', onKeydown);
	await nextTick();
	(open ? collapseButton : expandButton).value?.focus();
});

onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<!-- Phone (portrait) layout. -->
<template>
	<div class="h-dvh flex flex-col gap-4 px-4 pt-6 pb-4 text-zinc-400 overflow-hidden">
		<template v-if="!expanded">
			<header class="flex justify-between items-center px-1 text-[20px]">
				<span class="text-zinc-300">{{ weather.locationName }}</span>
				<span>{{ weather.date }}</span>
			</header>

			<main class="grow min-h-0 flex flex-col items-center justify-center gap-1">
				<div class="text-[40px] leading-none text-zinc-200 tabular-nums">{{ weather.clock }}</div>
				<Icon :icon="`wi:${weather.weatherIcon}`" class="text-[112px] text-zinc-300 animate-bounce-slow" />
				<div class="text-[144px] font-extralight leading-[0.9] tracking-tight text-zinc-100">
					{{ display(weather.currentTemp) }}°
				</div>
				<div class="text-[24px] mt-2">{{ weather.weatherLabel }}</div>
				<div class="flex items-center gap-5 text-[22px] text-zinc-300 mt-3">
					<span>L {{ display(weather.dailyTempMin) }}°</span>
					<span>H {{ display(weather.dailyTempMax) }}°</span>
					<span class="flex items-center">
						<Icon icon="wi:strong-wind" class="text-[30px] mr-1 text-zinc-400" />{{ display(weather.currentWindSpeed) }} km/h
					</span>
				</div>
			</main>

			<button
				ref="expandButton"
				type="button"
				class="bg-zinc-800 rounded-3xl px-2 pt-3 pb-2 text-left active:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300"
				aria-expanded="false"
				aria-label="Show hourly forecast"
				@click="expanded = true"
			>
				<span class="grid grid-cols-4 gap-2 text-center">
					<span v-for="slot in weather.slots" :key="slot.hour" class="flex flex-col items-center">
						<span class="text-[18px]">{{ slot.hour }}h</span>
						<Icon :icon="`wi:${slot.icon}`" class="text-[40px] text-zinc-300" />
						<span class="text-[26px] leading-tight text-zinc-100">{{ slot.temp }}°</span>
						<span class="text-[18px] text-sky-300">{{ slot.precipitationProbability }}%</span>
					</span>
				</span>
				<span class="flex items-center justify-center gap-1 mt-2 text-[16px] text-zinc-400">
					Hourly <Icon icon="mdi:chevron-up" class="text-[22px]" />
				</span>
			</button>
		</template>

		<template v-else>
			<header class="bg-zinc-800 rounded-3xl px-5 py-4 flex justify-between items-center">
				<div class="flex items-center" :title="weather.weatherLabel">
					<Icon :icon="`wi:${weather.weatherIcon}`" class="text-[72px] -my-2 text-zinc-300" />
					<span class="text-[64px] font-light leading-none text-zinc-100">{{ display(weather.currentTemp) }}°</span>
				</div>
				<div class="text-right flex flex-col gap-0.5">
					<span class="text-[28px] leading-tight text-zinc-200 tabular-nums">{{ weather.clock }}</span>
					<span class="text-[20px]">L {{ display(weather.dailyTempMin) }}° H {{ display(weather.dailyTempMax) }}°</span>
					<span class="text-[20px] flex items-center justify-end">
						<Icon icon="wi:strong-wind" class="text-[26px] mr-1" />{{ display(weather.currentWindSpeed) }} km/h
					</span>
				</div>
			</header>

			<section class="grow min-h-0 bg-zinc-800 rounded-3xl flex flex-col" aria-labelledby="hourly-title">
				<div class="flex items-center justify-between pl-5 pr-2 pt-2">
					<h2 id="hourly-title" class="text-[18px] text-zinc-300">Next {{ weather.hourly.length }} hours</h2>
					<button
						ref="collapseButton"
						type="button"
						class="w-11 h-11 flex items-center justify-center rounded-full text-zinc-300 active:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300"
						aria-expanded="true"
						aria-label="Hide hourly forecast"
						@click="expanded = false"
					>
						<Icon icon="mdi:chevron-down" class="text-[30px]" />
					</button>
				</div>
				<ol class="grow min-h-0 overflow-y-auto overscroll-contain px-5 pb-2">
					<li
						v-for="hour in weather.hourly"
						:key="hour.hour"
						class="grid grid-cols-[56px_48px_minmax(0,1fr)_56px] items-center gap-x-3 h-16 border-b border-zinc-700 last:border-b-0"
					>
						<span class="text-[20px] tabular-nums">{{ hour.hour }}:00</span>
						<Icon :icon="`wi:${hour.icon}`" class="text-[40px] text-zinc-300" :aria-label="hour.label" />
						<span class="flex items-center gap-2 min-w-0">
							<span class="h-1.5 rounded-full bg-sky-300 shrink-0" :style="{ width: `${hour.precipitationProbability * 0.6}%` }"></span>
							<span class="text-[18px] text-sky-300">{{ hour.precipitationProbability }}%</span>
						</span>
						<span class="text-[28px] text-zinc-100 text-right">{{ hour.temp }}°</span>
					</li>
				</ol>
			</section>
		</template>

		<!-- Last refreshed / stale indicator -->
		<div
			v-if="weather.isStale"
			class="flex items-center justify-center gap-2 rounded-2xl py-3 text-[18px] text-amber-400 bg-amber-400/10"
			role="status"
		>
			<Icon icon="mdi:alert-circle-outline" class="text-[22px]" />
			{{ weather.updatedText === 'Loading' ? 'Loading' : `Last update ${weather.updatedText}` }}
		</div>
		<div v-else class="flex items-center justify-end gap-1 px-1 text-[16px] text-zinc-500">
			<Icon icon="mdi:refresh" class="text-[18px]" />
			{{ weather.updatedText }}
		</div>
	</div>
</template>
