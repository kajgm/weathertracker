<script setup lang="ts">
import { fetchWeatherApi } from 'openmeteo';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { UnknownWeatherState, WeatherCodeMap } from '../types/types';

const location = { name: 'Toronto', coordinates: [43.6532, -79.3832] };
// Note: the order of variables here and the variables(i) indices in pollApi() must match.
const params = {
	latitude: location.coordinates[0],
	longitude: location.coordinates[1],
	current: ['temperature_2m', 'weather_code', 'wind_speed_10m', 'is_day'],
	hourly: ['temperature_2m', 'weather_code', 'precipitation_probability', 'is_day'],
	daily: ['temperature_2m_max', 'temperature_2m_min'],
	timezone: 'America/New_York',
	// Two days so the forecast slots can reach past midnight.
	forecast_days: 2,
};
const url = 'https://api.open-meteo.com/v1/forecast';

// Open-Meteo refreshes its forecast data every 15 minutes and the free tier is
// limited to 10,000 calls/day, so polling more often than this gains nothing.
const API_POLL_INTERVAL_MS = 15 * 60 * 1000;
const CLOCK_POLL_INTERVAL_MS = 1000;
// Data older than two missed polls is flagged as stale on screen.
const STALE_AFTER_MS = 2 * API_POLL_INTERVAL_MS + 60 * 1000;
// Forecast slots: this many hours ahead of the current hour.
const SLOT_OFFSETS_HOURS = [3, 6, 9, 12];
// Night dimming window, in the display's local time (24h clock, start > end wraps midnight).
const DIM_START_HOUR = 22;
const DIM_END_HOUR = 7;

interface Slot {
	hour: string;
	icon: string;
	temp: number;
	precipitationProbability: number;
}

const weatherIcon = ref('na');
const weatherLabel = ref('');
const currentTemp = ref<number | null>(null);
const currentWindSpeed = ref<number | null>(null);
const dailyTempMax = ref<number | null>(null);
const dailyTempMin = ref<number | null>(null);
const slots = ref<Slot[]>([]);

const now = ref(new Date());
const lastUpdated = ref<Date | null>(null);
const lastFetchFailed = ref(false);

function iconFor(code: number, isDay: boolean): string {
	const state = WeatherCodeMap[code] ?? UnknownWeatherState;
	return !isDay && state.nightIcon ? state.nightIcon : state.icon;
}

async function pollApi() {
	try {
		const res = await fetchWeatherApi(url, params);
		const response = res[0];
		const utcOffsetSeconds = response.utcOffsetSeconds();
		const current = response.current()!;
		const hourly = response.hourly()!;
		const daily = response.daily()!;

		const code = current.variables(1)!.value();
		const isDay = current.variables(3)!.value() === 1;
		weatherIcon.value = iconFor(code, isDay);
		weatherLabel.value = (WeatherCodeMap[code] ?? UnknownWeatherState).label;
		currentTemp.value = Math.round(current.variables(0)!.value());
		currentWindSpeed.value = Math.round(current.variables(2)!.value());

		const hourlyStart = Number(hourly.time());
		const hourlyInterval = hourly.interval();
		const hourlyTemp = hourly.variables(0)!.valuesArray()!;
		const hourlyCode = hourly.variables(1)!.valuesArray()!;
		const hourlyPop = hourly.variables(2)!.valuesArray()!;
		const hourlyIsDay = hourly.variables(3)!.valuesArray()!;
		// Hourly data starts at 00:00 today (location time), so the current hour is its index.
		const currentIndex = Math.floor((Number(current.time()) - hourlyStart) / hourlyInterval);

		slots.value = SLOT_OFFSETS_HOURS.map((offset) => currentIndex + offset)
			.filter((i) => i < hourlyTemp.length)
			.map((i) => {
				// Shifted into the location's timezone, so read it back with UTC getters.
				const time = new Date((hourlyStart + i * hourlyInterval + utcOffsetSeconds) * 1000);
				return {
					hour: String(time.getUTCHours()).padStart(2, '0'),
					icon: iconFor(hourlyCode[i], hourlyIsDay[i] === 1),
					temp: Math.round(hourlyTemp[i]),
					precipitationProbability: Math.round(hourlyPop[i] ?? 0),
				};
			});

		dailyTempMax.value = Math.round(daily.variables(0)!.valuesArray()![0]);
		dailyTempMin.value = Math.round(daily.variables(1)!.valuesArray()![0]);

		lastUpdated.value = new Date();
		lastFetchFailed.value = false;
	} catch (err) {
		// Keep showing the last known values; the indicator shows they're stale and the next poll retries.
		lastFetchFailed.value = true;
		console.error('Failed to fetch weather data', err);
	}
}

const clock = computed(() =>
	now.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
);

const isStale = computed(
	() =>
		lastUpdated.value === null ||
		now.value.getTime() - lastUpdated.value.getTime() > STALE_AFTER_MS
);

const updatedText = computed(() => {
	if (lastUpdated.value === null) return lastFetchFailed.value ? 'No data' : 'Loading';
	const time = lastUpdated.value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
	if (!isStale.value) return time;
	const minutes = Math.round((now.value.getTime() - lastUpdated.value.getTime()) / 60000);
	return minutes < 120 ? `${minutes} min old` : `${Math.round(minutes / 60)} h old`;
});

const isNight = computed(() => {
	const hour = now.value.getHours();
	return DIM_START_HOUR > DIM_END_HOUR
		? hour >= DIM_START_HOUR || hour < DIM_END_HOUR
		: hour >= DIM_START_HOUR && hour < DIM_END_HOUR;
});

const display = (value: number | null) => (value === null ? '--' : String(value));

let apiTimer: ReturnType<typeof setInterval> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
	pollApi();
	apiTimer = setInterval(pollApi, API_POLL_INTERVAL_MS);
	clockTimer = setInterval(() => (now.value = new Date()), CLOCK_POLL_INTERVAL_MS);
});

onUnmounted(() => {
	clearInterval(apiTimer);
	clearInterval(clockTimer);
});
</script>

<template>
	<div
		class="p-1.5 w-full h-full transition-[filter] duration-[3000ms]"
		:class="isNight ? 'brightness-[0.35]' : 'brightness-100'"
	>
		<div class="bg-zinc-800 rounded-2xl w-full h-full">
			<div class="flex flex-col px-4 py-2 h-full w-full">
				<!-- Current conditions -->
				<div class="flex items-center justify-between">
					<div class="flex items-center" :title="weatherLabel">
						<Icon :icon="`wi:${weatherIcon}`" class="text-[96px] -my-2 text-zinc-300 animate-bounce-slow" />
						<span class="text-[88px] leading-none text-zinc-100">{{ display(currentTemp) }}°</span>
					</div>
					<div class="text-right">
						<div class="text-[32px] leading-tight text-zinc-200">{{ clock }}</div>
						<div class="text-[24px] leading-snug">L {{ display(dailyTempMin) }}° H {{ display(dailyTempMax) }}°</div>
						<div class="text-[24px] leading-snug flex items-center justify-end">
							<Icon icon="wi:strong-wind" class="text-[30px] mr-1" />{{ display(currentWindSpeed) }} km/h
						</div>
					</div>
				</div>

				<!-- Forecast slots -->
				<div class="grid grid-cols-4 gap-1.5 grow text-center border-t-2 border-zinc-700 mt-1 pt-1">
					<div v-for="slot in slots" :key="slot.hour" class="flex flex-col items-center justify-center">
						<div class="text-[20px] leading-tight">{{ slot.hour }}</div>
						<Icon :icon="`wi:${slot.icon}`" class="text-[44px] -my-1 text-zinc-300" />
						<div class="text-[30px] leading-tight text-zinc-100">{{ slot.temp }}°</div>
						<div class="text-[20px] leading-tight text-sky-300">{{ slot.precipitationProbability }}%</div>
					</div>
				</div>

				<!-- Last refreshed / stale indicator -->
				<div
					class="flex items-center justify-end text-[20px] leading-none -mt-1"
					:class="isStale ? 'text-amber-400' : 'text-zinc-500'"
				>
					<Icon :icon="isStale ? 'mdi:alert-circle-outline' : 'mdi:refresh'" class="text-[22px] mr-1" />
					{{ updatedText }}
				</div>
			</div>
		</div>
	</div>
</template>
