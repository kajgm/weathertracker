<script setup lang="ts">
import { onUnmounted, ref, watch, type UnwrapNestedRefs } from 'vue';
import { Icon } from '@iconify/vue';
import { display, type Weather } from '../composables/useWeather';

defineProps<{ weather: UnwrapNestedRefs<Weather> }>();

// now:    the big at-a-glance view with a 4-slot strip.
// hourly: a compact header and an hour-by-hour list for the next 24 hours.
// weekly: the same compact header and a day-by-day list for the week.
type View = 'now' | 'hourly' | 'weekly';
const view = ref<View>('now');
const hourlyButton = ref<HTMLButtonElement | null>(null);
const weeklyButton = ref<HTMLButtonElement | null>(null);
const collapseButton = ref<HTMLButtonElement | null>(null);

function onKeydown(e: KeyboardEvent) {
	if (e.key === 'Escape') view.value = 'now';
}

// Let Escape close a forecast.
let lastForecast: View = 'hourly';
watch(view, (next, prev) => {
	if (next !== 'now') window.addEventListener('keydown', onKeydown);
	else window.removeEventListener('keydown', onKeydown);
	if (prev !== 'now') lastForecast = prev;
});

onUnmounted(() => window.removeEventListener('keydown', onKeydown));

// Keep keyboard focus on the control that toggles the view. Runs once the
// outgoing view has faded and the new one is in the DOM.
function onEnter() {
	if (view.value !== 'now') collapseButton.value?.focus();
	else (lastForecast === 'weekly' ? weeklyButton : hourlyButton).value?.focus();
}

// Vue only times a transition by its root element, so give it the length of the
// longest nested animation below, or the rows would be cut off mid-cascade.
const TRANSITION_MS = { enter: 900, leave: 150 };
// Rows after this one all start together, so long lists don't take ages to appear.
const STAGGER_ROWS = 10;
const rowStyle = (index: number) => ({ '--row': Math.min(index, STAGGER_ROWS) });
</script>

<!-- Phone (portrait) layout. -->
<template>
	<div class="h-dvh flex flex-col gap-4 px-4 pt-6 pb-4 text-muted overflow-hidden">
		<Transition name="view" mode="out-in" :duration="TRANSITION_MS" @enter="onEnter">
			<div v-if="view === 'now'" key="now" class="grow min-h-0 flex flex-col gap-4">
				<header class="flex justify-between items-center px-1 text-[20px]">
					<span class="text-soft">{{ weather.locationName }}</span>
					<span class="flex items-center gap-3">
						<span v-if="!weather.isStale" class="flex items-center gap-1 text-[16px] text-faint">
							<Icon icon="mdi:refresh" class="text-[18px]" />{{ weather.updatedText }}
						</span>
						{{ weather.date }}
					</span>
				</header>

				<main class="grow min-h-0 flex flex-col items-center justify-center gap-1">
					<div class="text-[40px] leading-none text-ink tabular-nums">{{ weather.clock }}</div>
					<Icon :icon="`wi:${weather.weatherIcon}`" class="text-[112px] text-soft animate-bounce-slow" />
					<div class="text-[144px] font-extralight leading-[0.9] tracking-tight text-strong">
						{{ display(weather.currentTemp) }}°
					</div>
					<div class="text-[24px] mt-2">{{ weather.weatherLabel }}</div>
					<div class="flex items-center gap-5 text-[22px] text-soft mt-3">
						<span>L {{ display(weather.dailyTempMin) }}°</span>
						<span>H {{ display(weather.dailyTempMax) }}°</span>
						<span class="flex items-center">
							<Icon icon="wi:strong-wind" class="text-[30px] mr-1 text-muted" />{{ display(weather.currentWindSpeed) }} km/h
						</span>
					</div>
				</main>

				<div class="bg-panel rounded-3xl px-3 pt-3 pb-3">
					<div class="grid grid-cols-4 gap-2 text-center">
						<div v-for="slot in weather.slots" :key="slot.hour" class="flex flex-col items-center">
							<span class="text-[18px]">{{ slot.hour }}h</span>
							<Icon :icon="`wi:${slot.icon}`" class="text-[40px] text-soft" :aria-label="slot.label" />
							<span class="text-[26px] leading-tight text-strong">{{ slot.temp }}°</span>
							<span class="text-[18px] text-rain">{{ slot.precipitationProbability }}%</span>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-2 mt-3 text-[17px] text-ink">
						<button
							ref="hourlyButton"
							type="button"
							class="forecast-pill"
							aria-expanded="false"
							aria-label="Show hourly forecast"
							@click="view = 'hourly'"
						>
							<Icon icon="mdi:clock-outline" class="text-[24px]" />
						</button>
						<button
							ref="weeklyButton"
							type="button"
							class="forecast-pill"
							aria-expanded="false"
							aria-label="Show weekly forecast"
							@click="view = 'weekly'"
						>
							<Icon icon="mdi:calendar-blank-outline" class="text-[24px]" />
						</button>
					</div>
				</div>
			</div>

			<div v-else :key="view" class="grow min-h-0 flex flex-col gap-4">
				<header class="expanded-header bg-panel rounded-3xl px-5 py-4 flex justify-between items-center">
					<div class="flex items-center" :title="weather.weatherLabel">
						<Icon :icon="`wi:${weather.weatherIcon}`" class="text-[72px] -my-2 text-soft" />
						<span class="text-[64px] font-light leading-none text-strong">{{ display(weather.currentTemp) }}°</span>
					</div>
					<div class="text-right flex flex-col gap-0.5">
						<span class="text-[28px] leading-tight text-ink tabular-nums">{{ weather.clock }}</span>
						<span class="text-[20px]">L {{ display(weather.dailyTempMin) }}° H {{ display(weather.dailyTempMax) }}°</span>
						<span class="text-[20px] flex items-center justify-end">
							<Icon icon="wi:strong-wind" class="text-[26px] mr-1" />{{ display(weather.currentWindSpeed) }} km/h
						</span>
					</div>
				</header>

				<section class="expanded-panel grow min-h-0 bg-panel rounded-3xl flex flex-col" aria-labelledby="forecast-title">
					<div class="flex items-center justify-between pl-5 pr-2 pt-2">
						<h2 id="forecast-title" class="text-[18px] text-soft">
							{{ view === 'hourly' ? `Next ${weather.hourly.length} hours` : `Next ${weather.daily.length} days` }}
						</h2>
						<span v-if="!weather.isStale" class="ml-auto mr-2 flex items-center gap-1 text-[16px] text-faint">
							<Icon icon="mdi:refresh" class="text-[18px]" />{{ weather.updatedText }}
						</span>
						<button
							ref="collapseButton"
							type="button"
							class="w-11 h-11 flex items-center justify-center rounded-full text-soft active:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-rain"
							aria-expanded="true"
							:aria-label="view === 'hourly' ? 'Hide hourly forecast' : 'Hide weekly forecast'"
							@click="view = 'now'"
						>
							<Icon icon="mdi:close" class="text-[26px]" />
						</button>
					</div>
					<ol v-if="view === 'hourly'" class="grow min-h-0 overflow-y-auto overscroll-contain px-5 pb-2">
						<li
							v-for="(hour, index) in weather.hourly"
							:key="hour.hour"
							class="forecast-row grid grid-cols-[56px_48px_minmax(0,1fr)_56px] items-center gap-x-3 h-16 border-b border-line last:border-b-0"
							:style="rowStyle(index)"
						>
							<span class="text-[20px] tabular-nums">{{ hour.hour }}:00</span>
							<Icon :icon="`wi:${hour.icon}`" class="text-[40px] text-soft" :aria-label="hour.label" />
							<span class="flex items-center gap-2 min-w-0">
								<span class="pop-bar h-1.5 rounded-full bg-rain shrink-0" :style="{ width: `${hour.precipitationProbability * 0.6}%` }"></span>
								<span class="text-[18px] text-rain">{{ hour.precipitationProbability }}%</span>
							</span>
							<span class="text-[28px] text-strong text-right">{{ hour.temp }}°</span>
						</li>
					</ol>
					<ol v-else class="grow min-h-0 overflow-y-auto overscroll-contain px-5 pb-2">
						<li
							v-for="(day, index) in weather.daily"
							:key="day.day"
							class="forecast-row grid grid-cols-[56px_48px_minmax(0,1fr)_92px] items-center gap-x-3 h-16 border-b border-line last:border-b-0"
							:style="rowStyle(index)"
						>
							<span class="text-[20px]">{{ day.day }}</span>
							<Icon :icon="`wi:${day.icon}`" class="text-[40px] text-soft" :aria-label="day.label" />
							<span class="flex items-center gap-2 min-w-0">
								<span class="pop-bar h-1.5 rounded-full bg-rain shrink-0" :style="{ width: `${day.precipitationProbability * 0.6}%` }"></span>
								<span class="text-[18px] text-rain">{{ day.precipitationProbability }}%</span>
							</span>
							<span class="text-right whitespace-nowrap">
								<span class="text-[28px] text-strong">{{ day.tempMax }}°</span>
								<span class="text-[20px] text-faint ml-1">{{ day.tempMin }}°</span>
							</span>
						</li>
					</ol>
				</section>
			</div>
		</Transition>

		<!-- Stale warning; the fresh "last refreshed" time sits in the header rows above -->
		<div
			v-if="weather.isStale"
			class="flex items-center justify-center gap-2 rounded-2xl py-3 text-[18px] text-warn bg-warn-wash"
			role="status"
		>
			<Icon icon="mdi:alert-circle-outline" class="text-[22px]" />
			{{ weather.updatedText === 'Loading' ? 'Loading' : `Last update ${weather.updatedText}` }}
		</div>
	</div>
</template>

<style scoped>
h2 {
	overflow-wrap: break-word;
	text-wrap: balance;
	min-width: 0;
}
/* Self-contained pills: fully rounded, no dividers, a soft fill that reads as tappable. */
.forecast-pill {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 2.75rem;
	border-radius: 9999px;
	background-color: var(--color-raised);
	transition:
		background-color 150ms ease-out,
		transform 150ms ease-out;
}
.forecast-pill:active {
	background-color: var(--color-pressed);
	transform: scale(0.97);
}
.forecast-pill:focus-visible {
	outline: 2px solid var(--color-rain);
	outline-offset: 2px;
}
/* Leaving: a quick fade so the next view isn't kept waiting. */
.view-leave-active {
	transition: opacity 150ms ease-in;
}
.view-leave-to {
	opacity: 0;
}

/* Entering the at-a-glance view: a gentle fade and settle. */
.view-enter-active {
	animation: settle-in 250ms ease-out both;
}

/* Entering a forecast: the header drops in, the panel rises, then rows and bars cascade in. */
.view-enter-active .expanded-header {
	animation: drop-in 300ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
.view-enter-active .expanded-panel {
	animation: rise-in 380ms cubic-bezier(0.2, 0.8, 0.2, 1) 40ms both;
}
.view-enter-active .forecast-row {
	animation: row-in 320ms ease-out both;
	animation-delay: calc(140ms + var(--row) * 35ms);
}
.view-enter-active .pop-bar {
	transform-origin: left;
	animation: bar-grow 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
	animation-delay: calc(220ms + var(--row) * 35ms);
}

@keyframes settle-in {
	from {
		opacity: 0;
		transform: translateY(-8px);
	}
}
@keyframes drop-in {
	from {
		opacity: 0;
		transform: translateY(-16px);
	}
}
@keyframes rise-in {
	from {
		opacity: 0;
		transform: translateY(48px);
	}
}
@keyframes row-in {
	from {
		opacity: 0;
		transform: translateY(12px);
	}
}
@keyframes bar-grow {
	from {
		transform: scaleX(0);
	}
}

@media (prefers-reduced-motion: reduce) {
	.view-enter-active,
	.view-leave-active,
	.view-enter-active .expanded-header,
	.view-enter-active .expanded-panel,
	.view-enter-active .forecast-row,
	.view-enter-active .pop-bar {
		transition: none;
		animation: none;
	}
}
</style>
