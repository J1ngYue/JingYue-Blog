<script lang="ts">
import { onMount } from "svelte";
import { pageWallpaperAssets } from "@/config/pageWallpapers";
import {
	getLocalWallpaperBlur,
	getLocalWallpaperById,
	getLocalWallpaperOpacity,
	LOCAL_WALLPAPER_CHANGE_EVENT,
	type LocalWallpaperChangeDetail,
	type LocalWallpaperType,
} from "@/utils/local-wallpaper";
import {
	getEffectivePageWallpaper,
	PAGE_WALLPAPER_CHANGE_EVENT,
	resolvePageWallpaperKey,
} from "@/utils/page-wallpaper";

let { surface = "home" }: { surface?: "home" | "site" } = $props();
let host: HTMLDivElement;
let sourceUrl = $state("");
let mediaType = $state<LocalWallpaperType | null>(null);
let opacity = $state(1);
let blur = $state(0);
let hasMedia = $state(false);
let mediaReady = $state(false);
let wallpaperEnabled = $state(true);
let videoElement: HTMLVideoElement | null = null;

function syncActiveWallpaperClass() {
	if (typeof document === "undefined") return;
	const container =
		surface === "home"
			? host?.closest(".home-landing")
			: document.getElementById("wallpaper-wrapper");
	const isActive = hasMedia && mediaReady && wallpaperEnabled;
	host?.classList.toggle("is-active", isActive);
	container?.classList.toggle("has-local-wallpaper", isActive);
	if (surface === "home") {
		document.body.classList.toggle("has-home-local-wallpaper", isActive);
	}
}

function dispatchHomeWallpaperState(
	state: "loading" | "ready",
	detail: Record<string, unknown> = {},
) {
	if (surface !== "home" || typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent(`firefly:home-wallpaper-${state}`, {
			detail: { surface, mediaType, ...detail },
		}),
	);
}

function markMediaReady() {
	if (!sourceUrl || mediaReady) return;
	mediaReady = true;
	syncActiveWallpaperClass();
	dispatchHomeWallpaperState("ready");
}

async function handleImageLoad(event: Event) {
	const image = event.currentTarget as HTMLImageElement;
	const expectedSource = sourceUrl;
	try {
		await image.decode();
	} catch {
		// onload 已确认资源可用；部分浏览器会拒绝重复 decode。
	}
	if (sourceUrl !== expectedSource) return;
	requestAnimationFrame(() => markMediaReady());
}

function handleVideoReady() {
	ensureVideoPlayback();
	requestAnimationFrame(() => {
		requestAnimationFrame(() => markMediaReady());
	});
}

function handleMediaError() {
	mediaReady = false;
	hasMedia = false;
	sourceUrl = "";
	mediaType = null;
	document.documentElement.setAttribute("data-has-local-wallpaper", "false");
	syncActiveWallpaperClass();
	dispatchHomeWallpaperState("ready", { fallback: true });
}

function ensureVideoPlayback() {
	if (!videoElement) return;
	videoElement.muted = true;
	void videoElement.play().catch(() => {
		// 浏览器仍可能在极端省电模式下拒绝自动播放；保持首帧作为背景。
	});
}

onMount(() => {
	const container =
		surface === "home"
			? host.closest(".home-landing")
			: document.getElementById("wallpaper-wrapper");
	document
		.querySelectorAll<HTMLElement>(
			`[data-local-wallpaper-surface="${surface}"]`,
		)
		.forEach((layer) => {
			if (layer !== host) layer.remove();
		});
	let disposed = false;
	let activeObjectUrl = "";
	let loadVersion = 0;
	const mobileMedia = window.matchMedia("(max-width: 640px)");

	const syncWallpaperMode = (mode?: string | null) => {
		wallpaperEnabled =
			(mode ?? document.documentElement.getAttribute("data-wallpaper-mode")) !==
			"none";
		syncActiveWallpaperClass();
	};

	const applyAppearance = () => {
		opacity = getLocalWallpaperOpacity();
		blur = getLocalWallpaperBlur();
		document.documentElement.style.setProperty(
			"--home-background-opacity",
			String(opacity),
		);
		document.documentElement.style.setProperty(
			"--home-background-blur",
			`${blur}px`,
		);
		document.documentElement.style.setProperty("--home-background-scale", "1");
	};

	const loadMedia = async () => {
		const version = ++loadVersion;
		mediaReady = false;
		dispatchHomeWallpaperState("loading");
		syncWallpaperMode();
		try {
			const pageKey = resolvePageWallpaperKey();
			const choice = getEffectivePageWallpaper(pageKey);
			const favoriteMap = (() => {
				try {
					return JSON.parse(
						localStorage.getItem("fireflyLocalCoverFavorites") || "{}",
					) as Record<string, string>;
				} catch {
					return {};
				}
			})();
			const builtInIndex = choice.startsWith("wallpaper-")
				? Math.max(0, Number(choice.slice("wallpaper-".length)) - 1)
				: -1;
			const favoriteId =
				builtInIndex >= 0 ? favoriteMap[String(builtInIndex)] : undefined;
			const localId = choice.startsWith("local:")
				? choice.slice("local:".length)
				: favoriteId;
			const record = localId ? await getLocalWallpaperById(localId) : null;
			if (disposed || version !== loadVersion) return;
			if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
			activeObjectUrl = record ? URL.createObjectURL(record.blob) : "";
			const builtIn =
				pageWallpaperAssets[builtInIndex] ?? pageWallpaperAssets[0] ?? null;
			sourceUrl = record
				? activeObjectUrl
				: builtIn
					? mobileMedia.matches
						? builtIn.mobileUrl
						: builtIn.desktopUrl
					: "";
			mediaType = record?.type ?? builtIn?.type ?? null;
			hasMedia = Boolean(sourceUrl);
			document.documentElement.setAttribute(
				"data-has-local-wallpaper",
				hasMedia ? "true" : "false",
			);
			document.documentElement.setAttribute("data-page-wallpaper", choice);
			syncWallpaperMode();
			if (!sourceUrl) {
				mediaReady = true;
				dispatchHomeWallpaperState("ready", { skipped: true });
			} else if (!wallpaperEnabled) {
				dispatchHomeWallpaperState("ready", { skipped: true });
			}
		} catch {
			if (!disposed) {
				mediaReady = false;
				hasMedia = false;
				sourceUrl = "";
				mediaType = null;
				container?.classList.remove("has-local-wallpaper");
				if (surface === "home") {
					document.body.classList.remove("has-home-local-wallpaper");
				}
				dispatchHomeWallpaperState("ready", { fallback: true });
			}
		}
	};

	const handleChange = (event: Event) => {
		const detail = (event as CustomEvent<LocalWallpaperChangeDetail>).detail;
		applyAppearance();
		if (detail?.kind === "media") void loadMedia();
	};

	const handleWallpaperModeChange = (event: Event) => {
		const detail = (event as CustomEvent<{ mode?: string }>).detail;
		syncWallpaperMode(detail?.mode);
	};
	const handlePageWallpaperChange = () => void loadMedia();
	const handleViewportChange = () => void loadMedia();

	applyAppearance();
	syncWallpaperMode();
	void loadMedia();
	window.addEventListener(LOCAL_WALLPAPER_CHANGE_EVENT, handleChange);
	window.addEventListener(
		PAGE_WALLPAPER_CHANGE_EVENT,
		handlePageWallpaperChange,
	);
	window.addEventListener("wallpaperModeChange", handleWallpaperModeChange);
	window.addEventListener("popstate", handlePageWallpaperChange);
	document.addEventListener("swup:contentReplaced", handlePageWallpaperChange);
	document.addEventListener("astro:page-load", handlePageWallpaperChange);
	mobileMedia.addEventListener("change", handleViewportChange);

	return () => {
		disposed = true;
		loadVersion += 1;
		window.removeEventListener(LOCAL_WALLPAPER_CHANGE_EVENT, handleChange);
		window.removeEventListener(
			PAGE_WALLPAPER_CHANGE_EVENT,
			handlePageWallpaperChange,
		);
		window.removeEventListener(
			"wallpaperModeChange",
			handleWallpaperModeChange,
		);
		window.removeEventListener("popstate", handlePageWallpaperChange);
		document.removeEventListener(
			"swup:contentReplaced",
			handlePageWallpaperChange,
		);
		document.removeEventListener("astro:page-load", handlePageWallpaperChange);
		mobileMedia.removeEventListener("change", handleViewportChange);
		container?.classList.remove("has-local-wallpaper");
		if (surface === "home") {
			document.body.classList.remove("has-home-local-wallpaper");
		}
		if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
	};
});
</script>

<div
	bind:this={host}
	class="local-wallpaper-layer"
	class:local-wallpaper-home={surface === "home"}
	class:local-wallpaper-site={surface === "site"}
	class:is-active={Boolean(sourceUrl) && mediaReady && wallpaperEnabled}
	data-local-wallpaper-surface={surface}
	data-wallpaper-ready={mediaReady ? "true" : "false"}
	style:--home-local-wallpaper-opacity={opacity}
	style:--home-local-wallpaper-blur={`${blur}px`}
	aria-hidden="true"
>
	{#if mediaType === "image" && sourceUrl}
		<img
			src={sourceUrl}
			alt=""
			loading="eager"
			fetchpriority={surface === "home" ? "high" : "auto"}
			onload={handleImageLoad}
			onerror={handleMediaError}
		/>
	{:else if mediaType === "video" && sourceUrl}
		<video
			bind:this={videoElement}
			src={sourceUrl}
			autoplay
			muted
			loop
			playsinline
			preload="auto"
			onloadedmetadata={ensureVideoPlayback}
			onloadeddata={handleVideoReady}
			oncanplay={handleVideoReady}
			onerror={handleMediaError}
		></video>
	{/if}
</div>

<style>
	.local-wallpaper-layer {
		inset: 0;
		contain: paint;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
		transition: opacity 420ms cubic-bezier(0.22, 0.61, 0.36, 1);
	}

	.local-wallpaper-home {
		position: absolute;
		top: 0;
		right: 0;
		bottom: auto;
		left: 0;
		z-index: 0;
		height: 100vh;
		height: 100svh;
	}

	.local-wallpaper-site {
		position: fixed;
		z-index: 7;
	}

	:global(html[data-wallpaper-mode="banner"]) .local-wallpaper-site {
		position: absolute;
		top: 0;
		right: 0;
		bottom: auto;
		left: 0;
		height: var(--banner-height, 35vh);
	}

	:global(html[data-wallpaper-mode="fullscreen"]) .local-wallpaper-site,
	:global(html[data-wallpaper-mode="overlay"]) .local-wallpaper-site {
		position: fixed;
		inset: 0;
		height: auto;
	}

	:global(html[data-wallpaper-mode="none"]) .local-wallpaper-site {
		opacity: 0 !important;
		visibility: hidden;
	}

	.local-wallpaper-layer.is-active {
		opacity: var(--home-background-opacity, var(--home-local-wallpaper-opacity));
	}

	:global(html.home-cover-pending) .local-wallpaper-home,
	:global(html.home-cover-reveal-now) .local-wallpaper-home {
		transition: none;
	}

	:global(body:not(.home-landing-active)) .local-wallpaper-home,
	:global(body.home-landing-active) .local-wallpaper-site {
		opacity: 0 !important;
		visibility: hidden;
	}

	.local-wallpaper-layer img,
	.local-wallpaper-layer video {
		display: block;
		min-width: 100%;
		min-height: 100%;
		width: 100%;
		height: 100%;
		max-width: none;
		object-fit: cover;
		object-position: center center;
		filter: blur(var(--home-background-blur, var(--home-local-wallpaper-blur)));
		transform: translate3d(0, 0, 0);
		backface-visibility: hidden;
	}

	:global(#wallpaper-wrapper.has-local-wallpaper #banner-images-container),
	:global(#wallpaper-wrapper.has-local-wallpaper #bg-player-overlay) {
		opacity: 0 !important;
	}

	:global(#wallpaper-wrapper:not(.has-local-wallpaper) #banner-images-container) {
		opacity: var(--home-background-opacity, 1);
		filter: blur(var(--home-background-blur, 0px));
		transform: translate3d(0, 0, 0);
		transition: opacity 240ms ease, filter 240ms ease, transform 240ms ease;
	}

	:global(#wallpaper-wrapper:not(.has-local-wallpaper) #bg-player-video) {
		opacity: var(--home-background-opacity, 1);
		filter: blur(var(--home-background-blur, 0px));
		transform: translate3d(0, 0, 0);
		transition: opacity 240ms ease, filter 240ms ease, transform 240ms ease;
	}

	:global(#wallpaper-wrapper .local-wallpaper-layer img),
	:global(#wallpaper-wrapper .local-wallpaper-layer video) {
		filter: blur(var(--home-background-blur, var(--home-local-wallpaper-blur))) !important;
		transform: translate3d(0, 0, 0) !important;
	}

	@media (max-width: 640px) {
		:global(html[data-wallpaper-mode="banner"]) .local-wallpaper-site {
			height: min(46svh, 26rem);
		}

		.local-wallpaper-layer img,
		.local-wallpaper-layer video {
			object-position: 50% 38%;
		}

		.local-wallpaper-home img,
		.local-wallpaper-home video {
			object-position: 50% 50%;
		}
	}

	@media (min-width: 641px) and (max-width: 1023px) {
		:global(html[data-wallpaper-mode="banner"]) .local-wallpaper-site {
			height: min(52svh, 34rem);
		}

		.local-wallpaper-layer img,
		.local-wallpaper-layer video {
			object-position: 50% 40%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.local-wallpaper-layer {
			transition: none;
		}
	}
</style>
