import { onUnmounted, ref } from 'vue';

/** Reactive `window.matchMedia(query).matches`. */
export function useMediaQuery(query: string) {
	const list = window.matchMedia(query);
	const matches = ref(list.matches);
	const onChange = (e: MediaQueryListEvent) => (matches.value = e.matches);
	list.addEventListener('change', onChange);
	onUnmounted(() => list.removeEventListener('change', onChange));
	return matches;
}
