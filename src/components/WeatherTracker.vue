<script setup lang="ts">
import { fetchWeatherApi } from 'openmeteo';
import { onMounted, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { WeatherCodeMap } from '../types/types';

const location = { "name": "Toronto", "coordinates": [43.6532, -79.3832] }
const params = {
	"latitude": location.coordinates[0],
	"longitude": location.coordinates[1],
	"current": ["temperature_2m", "relative_humidity_2m", "precipitation", "weather_code", "wind_speed_10m"],
	"hourly": ["precipitation_probability", "precipitation"],
	"daily": ["weather_code", "temperature_2m_max", "temperature_2m_min", "precipitation_probability_max"],
	"timezone": "America/New_York",
	"forecast_days": 1
};
const url = "https://api.open-meteo.com/v1/forecast";
const weatherState = ref({ label: '', icon: 'moon-alt-full' });
const currentTemp = ref('');
const currentWindSpeed = ref('');

async function pollApi() {
	await fetchWeatherApi(url, params).then((res) => {

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
			},
		};
		weatherState.value = WeatherCodeMap[weatherData.current.weatherCode as keyof typeof WeatherCodeMap];
		currentTemp.value = weatherData.current.temperature2m.toFixed(2);
		currentWindSpeed.value = weatherData.current.windSpeed10m.toFixed(2);
	});
	setTimeout(pollApi, 10000);
};

onMounted(() => {
	pollApi();
})
</script>

<template>
	<p>The weather in {{ location.name }} is currently</p>
	<Icon :icon="`wi:${weatherState.icon}`" style={{ color: white, fontSize: 32px }} />
	<p>{{ weatherState.label }}</p>
	<h1>{{ currentTemp }} °C</h1>
	<p>{{ currentWindSpeed }} km/h</p>
	<p>{{ location.coordinates[0].toFixed(2) }}, {{ location.coordinates[1].toFixed(2) }}</p>
</template>
