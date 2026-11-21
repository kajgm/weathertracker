<script setup lang="ts">
import { fetchWeatherApi } from 'openmeteo';
import { onMounted, onUnmounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { UnknownWeatherState, WeatherCodeMap } from '../types/types';

const location = { "name": "Toronto", "coordinates": [43.6532, -79.3832] }
const params = {
	"latitude": location.coordinates[0],
	"longitude": location.coordinates[1],
	"current": ["temperature_2m", "relative_humidity_2m", "precipitation", "weather_code", "wind_speed_10m"],
	"hourly": ["precipitation_probability", "precipitation"],
	"daily": ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_probability_max", "precipitation_sum", "precipitation_hours"],
	"timezone": "America/New_York",
	"forecast_days": 1
};
const url = "https://api.open-meteo.com/v1/forecast";
// Open-Meteo refreshes its forecast data every 15 minutes and the free tier is
// limited to 10,000 calls/day, so polling more often than this gains nothing.
const API_POLL_INTERVAL_MS = 15 * 60 * 1000;
const CLOCK_POLL_INTERVAL_MS = 1000;
const weatherState = ref({ label: '', icon: 'moon-alt-full' });
const currentTemp = ref('');
const currentWindSpeed = ref('');
const currentHumidity = ref(0);
const currentPP = ref(0);
const currentTime = ref('');

const dailyTempMax = ref('');
const dailyTempMin = ref('');
const dailyPPMax = ref('');
const dailyPPSum = ref('');
const dailyPPHours = ref(0);

async function pollApi() {
	try {
		const res = await fetchWeatherApi(url, params);

		// Process first location. Add a for-loop for multiple locations or weather models
		const response = res[0];

		// Helper function to form time ranges
		const range = (start: number, stop: number, step: number) =>
			Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

		// Attributes for timezone and location
		const utcOffsetSeconds = response.utcOffsetSeconds();

		const current = response.current()!;
		const hourly = response.hourly()!;
		const daily = response.daily()!;

		// Note: The order of weather variables in the URL query and the indices below need to match!
		const weatherData = {
			current: {
				time: new Date((Number(current.time()) + utcOffsetSeconds) * 1000),
				temperature2m: current.variables(0)!.value(),
				relativeHumidity2m: current.variables(1)!.value(),
				precipitation: current.variables(2)!.value(),
				weatherCode: current.variables(3)!.value(),
				windSpeed10m: current.variables(4)!.value(),
			},
			hourly: {
				time: range(Number(hourly.time()), Number(hourly.timeEnd()), hourly.interval()).map(
					(t) => new Date((t + utcOffsetSeconds) * 1000)
				),
				precipitationProbability: hourly.variables(0)!.valuesArray()!,
				precipitation: hourly.variables(1)!.valuesArray()!,
			},
			daily: {
				time: range(Number(daily.time()), Number(daily.timeEnd()), daily.interval()).map(
					(t) => new Date((t + utcOffsetSeconds) * 1000)
				),
				weatherCode: daily.variables(0)!.valuesArray()!,
				temperature2mMax: daily.variables(1)!.valuesArray()!,
				temperature2mMin: daily.variables(2)!.valuesArray()!,
				precipitationProbabilityMax: daily.variables(3)!.valuesArray()!,
				precipitationSum: daily.variables(4)!.valuesArray()!,
				precipitationHours: daily.variables(5)!.valuesArray()!,
			},
		};
		weatherState.value = WeatherCodeMap[weatherData.current.weatherCode] ?? UnknownWeatherState;
		currentTemp.value = weatherData.current.temperature2m.toFixed(2);
		currentWindSpeed.value = weatherData.current.windSpeed10m.toFixed(2);
		currentHumidity.value = weatherData.current.relativeHumidity2m;
		// The times above are shifted into the location's timezone, so read them with
		// UTC getters. Using the browser's local clock would pick the wrong hour
		// whenever the display isn't in the same timezone as the tracked location.
		currentPP.value = weatherData.hourly.precipitationProbability[weatherData.current.time.getUTCHours()] ?? 0;

		dailyTempMax.value = weatherData.daily.temperature2mMax[0].toFixed(2);
		dailyTempMin.value = weatherData.daily.temperature2mMin[0].toFixed(2);
		dailyPPMax.value = weatherData.daily.precipitationProbabilityMax[0].toFixed(2);
		dailyPPSum.value = weatherData.daily.precipitationSum[0].toFixed(2);
		dailyPPHours.value = weatherData.daily.precipitationHours[0];
	} catch (err) {
		// Keep showing the last known values; the next poll will retry.
		console.error('Failed to fetch weather data', err);
	}
}

function pollTime() {
	currentTime.value = new Date().toLocaleTimeString();
}

let apiTimer: ReturnType<typeof setInterval> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
	pollApi();
	pollTime();
	apiTimer = setInterval(pollApi, API_POLL_INTERVAL_MS);
	clockTimer = setInterval(pollTime, CLOCK_POLL_INTERVAL_MS);
});

onUnmounted(() => {
	clearInterval(apiTimer);
	clearInterval(clockTimer);
});
</script>

<template>
	<div class="p-1.5 w-full h-full">
		<div class="bg-zinc-800 rounded-2xl w-full h-full">
			<div class="flex flex-col p-2 h-full w-full">
				<div class="text-center items-center pt-2">
					<h1 class="text-4xl">{{ location.name }}</h1>
					<p class="text-md">{{ location.coordinates[0].toFixed(2) }}, {{
						location.coordinates[1].toFixed(2)
					}} / {{ currentTime }}</p>
					<Icon :icon="`wi:${weatherState.icon}`" class="text-8xl mx-auto animate-bounce-slow" />
					<p class="text-sm -mt-4 pb-1">{{ weatherState.label }}</p>
				</div>
				<div class="flex grow h-auto">
					<div class="flex mx-1 w-1/2 items-center justify-center">
						<Icon icon="wi:thermometer" class="text-5xl" />
						<div>
							<h1 class="text-4xl">{{ currentTemp }} °C</h1>
							<p class="text-md"> {{ dailyTempMin }} °C / {{ dailyTempMax }} °C</p>
						</div>
					</div>
					<div class="flex mx-1 w-1/2 items-center justify-center">
						<Icon v-if="dailyPPHours == 0" icon="wi:cloud" class="text-5xl" />
						<Icon v-else-if="dailyPPHours > 0 && dailyPPHours <= 4" icon="wi:rain-mix" class="text-5xl" />
						<Icon v-else-if="dailyPPHours > 4 && dailyPPHours <= 8" icon="wi:showers" class="text-5xl" />
						<Icon v-else-if="dailyPPHours > 8" icon="wi:rain" class="text-5xl" />
						<div>
							<h1 class="text-4xl">{{ dailyPPSum }} mm</h1>
							<p class="text-md ml-1">{{ currentPP }}% / {{ dailyPPMax }}%</p>
						</div>
					</div>
				</div>
				<div class="flex grow h-auto items-end">
					<div class="flex mx-1 w-1/2 items-center justify-center">
						<Icon icon="wi:humidity" class="text-3xl" />
						<p class="text-3xl text-left inline-block">{{ currentHumidity }}%</p>
					</div>
					<div class="flex mx-1 w-1/2 items-center justify-center">
						<Icon icon="wi:strong-wind" class="text-3xl mx-1" />
						<p class="text-3xl text-right inline-block">{{ currentWindSpeed }} km/h</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>
