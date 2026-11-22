import { onMounted, onUnmounted } from 'vue';

// How often to check whether a new version has been deployed.
const VERSION_POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Reloads the page when the server starts serving a different build, so an
 * unattended kiosk picks up new deploys without anyone touching it.
 *
 * Compares the build id baked into this bundle with /version.json. A failed
 * or malformed check is ignored and retried on the next interval, so a server
 * outage never triggers a reload.
 */
export function useAutoReload() {
	// The dev server has no version.json and hot-reloads by itself.
	if (import.meta.env.DEV) return;

	let timer: ReturnType<typeof setInterval> | undefined;

	async function check() {
		try {
			const res = await fetch(`${import.meta.env.BASE_URL}version.json`, { cache: 'no-store' });
			if (!res.ok) return;
			const { build } = (await res.json()) as { build?: unknown };
			if (typeof build === 'string' && build !== __BUILD_ID__) {
				window.location.reload();
			}
		} catch {
			// Offline or mid-deploy: try again next interval.
		}
	}

	onMounted(() => {
		timer = setInterval(check, VERSION_POLL_INTERVAL_MS);
	});

	onUnmounted(() => clearInterval(timer));
}
