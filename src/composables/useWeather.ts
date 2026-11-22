import { fetchWeatherApi } from 'openmeteo';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { UnknownWeatherState, WeatherCodeMap } from '../types/types';

export const location = { name: 'Toronto', coordinates: [43.6532, -79.3832] };
// Note: the order of variables here and the variables(i) indices in pollApi() must match.
const params = {
	latitude: location.coordinates[0],
	longitude: location.coordinates[1],
	current: ['temperature_2m', 'weather_code', 'wind_speed_10m', 'is_day'],
	hourly: ['temperature_2m', 'weather_code', 'precipitation_probability', 'is_day'],
	daily: ['temperature_2m_max', 'temperature_2m_min'],
	timezone: 'America/New_York',
	// Two days so the forecast slots and the hourly list can reach past midnight.
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
// Hours shown in the expanded hourly forecast (phone layout).
const HOURLY_HOURS = 24;
// Night dimming window, in the display's local time (24h clock, start > end wraps midnight).
const DIM_START_HOUR = 22;
const DIM_END_HOUR = 7;

export interface Slot {
	// Hour of day in the location's timezone, zero-padded ("15").
	hour: string;
	icon: string;
	label: string;
	temp: number;
	precipitationProbability: number;
}

function stateFor(code: number) {
	return WeatherCodeMap[code] ?? UnknownWeatherState;
}

function iconFor(code: number, isDay: boolean): string {
	const state = stateFor(code);
	return !isDay && state.nightIcon ? state.nightIcon : state.icon;
}

const timeFormat: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };

/** Polls Open-Meteo and exposes everything the kiosk and phone layouts show. */
export function useWeather() {
	const weatherIcon = ref('na');
	const weatherLabel = ref('');
	const currentTemp = ref<number | null>(null);
	const currentWindSpeed = ref<number | null>(null);
	const dailyTempMax = ref<number | null>(null);
	const dailyTempMin = ref<number | null>(null);
	const slots = ref<Slot[]>([]);
	const hourly = ref<Slot[]>([]);

	const now = ref(new Date());
	const lastUpdated = ref<Date | null>(null);
	const lastFetchFailed = ref(false);

	async function pollApi() {
		try {
			const res = await fetchWeatherApi(url, params);
			const response = res[0];
			const utcOffsetSeconds = response.utcOffsetSeconds();
			const current = response.current()!;
			const hourlyData = response.hourly()!;
			const daily = response.daily()!;

			const code = current.variables(1)!.value();
			const isDay = current.variables(3)!.value() === 1;
			weatherIcon.value = iconFor(code, isDay);
			weatherLabel.value = stateFor(code).label;
			currentTemp.value = Math.round(current.variables(0)!.value());
			currentWindSpeed.value = Math.round(current.variables(2)!.value());

			const hourlyStart = Number(hourlyData.time());
			const hourlyInterval = hourlyData.interval();
			const hourlyTemp = hourlyData.variables(0)!.valuesArray()!;
			const hourlyCode = hourlyData.variables(1)!.valuesArray()!;
			const hourlyPop = hourlyData.variables(2)!.valuesArray()!;
			const hourlyIsDay = hourlyData.variables(3)!.valuesArray()!;
			// Hourly data starts at 00:00 today (location time), so the current hour is its index.
			const currentIndex = Math.floor((Number(current.time()) - hourlyStart) / hourlyInterval);

			const slotAt = (i: number): Slot => {
				// Shifted into the location's timezone, so read it back with UTC getters.
				const time = new Date((hourlyStart + i * hourlyInterval + utcOffsetSeconds) * 1000);
				return {
					hour: String(time.getUTCHours()).padStart(2, '0'),
					icon: iconFor(hourlyCode[i], hourlyIsDay[i] === 1),
					label: stateFor(hourlyCode[i]).label,
					temp: Math.round(hourlyTemp[i]),
					precipitationProbability: Math.round(hourlyPop[i] ?? 0),
				};
			};
			const inRange = (i: number) => i < hourlyTemp.length;

			slots.value = SLOT_OFFSETS_HOURS.map((offset) => currentIndex + offset)
				.filter(inRange)
				.map(slotAt);
			hourly.value = Array.from({ length: HOURLY_HOURS }, (_, k) => currentIndex + 1 + k)
				.filter(inRange)
				.map(slotAt);

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

	const clock = computed(() => now.value.toLocaleTimeString([], timeFormat));

	const date = computed(() =>
		now.value.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
	);

	const isStale = computed(
		() =>
			lastUpdated.value === null ||
			now.value.getTime() - lastUpdated.value.getTime() > STALE_AFTER_MS
	);

	const updatedText = computed(() => {
		if (lastUpdated.value === null) return lastFetchFailed.value ? 'No data' : 'Loading';
		const time = lastUpdated.value.toLocaleTimeString([], timeFormat);
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

	return {
		locationName: location.name,
		weatherIcon,
		weatherLabel,
		currentTemp,
		currentWindSpeed,
		dailyTempMax,
		dailyTempMin,
		slots,
		hourly,
		clock,
		date,
		isStale,
		updatedText,
		isNight,
	};
}

export type Weather = ReturnType<typeof useWeather>;

/** Shows "--" until the first successful fetch. */
export const display = (value: number | null) => (value === null ? '--' : String(value));
