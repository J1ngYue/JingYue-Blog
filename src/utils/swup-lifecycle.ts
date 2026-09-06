/** Small lifecycle adapter for page islands that also work without Swup. */
export function definePageIsland(options: {
	name: string;
	mount: () => void | Promise<void>;
	unmount?: () => void;
}): void {
	const run = () => void options.mount();
	const cleanup = () => options.unmount?.();
	document.addEventListener("astro:page-load", run);
	document.addEventListener("swup:contentReplaced", run);
	document.addEventListener("swup:willReplaceContent", cleanup);
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", run, { once: true });
	} else {
		run();
	}
}

export function preloadUrl(target: string): void {
	if (!target || typeof window === "undefined") return;
	if (window.swup?.preload) {
		try {
			window.swup.preload(target);
		} catch {
			// Preloading is an optional enhancement.
		}
	}
}
