<script lang="ts">
	import { onMount } from "svelte";
	import {
		getLocalWallpaper,
		getLocalWallpaperBlur,
		getLocalWallpaperOpacity,
		LOCAL_WALLPAPER_CHANGE_EVENT,
		type LocalWallpaperChangeDetail,
		type LocalWallpaperType,
	} from "@/utils/local-wallpaper";

	let { surface = "home" }: { surface?: "home" | "site" } = $props();
	let host: HTMLDivElement;
	let sourceUrl = $state("");
	let mediaType = $state<LocalWallpaperType | null>(null);
	let opacity = $state(0.82);
	let blur = $state(0);
	let hasMedia = $state(false);
	let wallpaperEnabled = $state(true);

	onMount(() => {
		const container =
			surface === "home" ? host.closest(".home-landing") : host.closest("#wallpaper-wrapper");
		const placeholder = document.createComment("firefly-local-wallpaper");
		const shouldPortalToBody = surface === "home";
		if (shouldPortalToBody) {
			host.before(placeholder);
			document.body.prepend(host);
		}
		let disposed = false;
		let activeUrl = "";
		let loadVersion = 0;

		const syncWallpaperMode = (mode?: string | null) => {
			wallpaperEnabled =
				(mode ?? document.documentElement.getAttribute("data-wallpaper-mode")) !== "none";
			const isActive = hasMedia && wallpaperEnabled;
			container?.classList.toggle("has-local-wallpaper", isActive);
			if (surface === "home") {
				document.body.classList.toggle("has-home-local-wallpaper", isActive);
			}
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
			document.documentElement.style.setProperty(
				"--home-background-scale",
				"1",
			);
		};

		const loadMedia = async () => {
			const version = ++loadVersion;
			try {
				const record = await getLocalWallpaper();
				if (disposed || version !== loadVersion) return;
				if (activeUrl) URL.revokeObjectURL(activeUrl);
				activeUrl = record ? URL.createObjectURL(record.blob) : "";
				sourceUrl = activeUrl;
				mediaType = record?.type ?? null;
				hasMedia = Boolean(record);
				syncWallpaperMode();
			} catch {
				if (!disposed) {
					hasMedia = false;
					sourceUrl = "";
					mediaType = null;
					container?.classList.remove("has-local-wallpaper");
					if (surface === "home") {
						document.body.classList.remove("has-home-local-wallpaper");
					}
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

		applyAppearance();
		syncWallpaperMode();
		void loadMedia();
		window.addEventListener(LOCAL_WALLPAPER_CHANGE_EVENT, handleChange);
		window.addEventListener("wallpaperModeChange", handleWallpaperModeChange);

		return () => {
			disposed = true;
			loadVersion += 1;
			window.removeEventListener(LOCAL_WALLPAPER_CHANGE_EVENT, handleChange);
			window.removeEventListener("wallpaperModeChange", handleWallpaperModeChange);
			container?.classList.remove("has-local-wallpaper");
			if (surface === "home") {
				document.body.classList.remove("has-home-local-wallpaper");
			}
			if (shouldPortalToBody && placeholder.parentNode) {
				placeholder.before(host);
				placeholder.remove();
			}
			if (activeUrl) URL.revokeObjectURL(activeUrl);
		};
	});
</script>

<div
	bind:this={host}
	class="local-wallpaper-layer"
	class:local-wallpaper-home={surface === "home"}
	class:local-wallpaper-site={surface === "site"}
	class:is-active={Boolean(sourceUrl) && wallpaperEnabled}
	style:--home-local-wallpaper-opacity={opacity}
	style:--home-local-wallpaper-blur={`${blur}px`}
	aria-hidden="true"
>
	{#if mediaType === "image" && sourceUrl}
		<img src={sourceUrl} alt="" />
	{:else if mediaType === "video" && sourceUrl}
		<video src={sourceUrl} autoplay muted loop playsinline preload="metadata"></video>
	{/if}
</div>

<style>
	.local-wallpaper-layer {
		inset: 0;
		contain: paint;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
		transition: opacity 420ms ease;
	}

	.local-wallpaper-home {
		position: fixed;
		z-index: 0;
	}

	.local-wallpaper-site {
		position: absolute;
		z-index: 7;
	}

	.local-wallpaper-layer.is-active {
		opacity: var(--home-background-opacity, var(--home-local-wallpaper-opacity));
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
		opacity: var(--home-background-opacity, 0.82);
		filter: blur(var(--home-background-blur, 0px));
		transform: translate3d(0, 0, 0);
		transition: opacity 240ms ease, filter 240ms ease, transform 240ms ease;
	}

	:global(#wallpaper-wrapper:not(.has-local-wallpaper) #bg-player-video) {
		opacity: var(--home-background-opacity, 0.82);
		filter: blur(var(--home-background-blur, 0px));
		transform: translate3d(0, 0, 0);
		transition: opacity 240ms ease, filter 240ms ease, transform 240ms ease;
	}

	:global(#wallpaper-wrapper .local-wallpaper-layer img),
	:global(#wallpaper-wrapper .local-wallpaper-layer video) {
		filter: blur(var(--home-background-blur, var(--home-local-wallpaper-blur))) !important;
		transform: translate3d(0, 0, 0) !important;
	}

	@media (prefers-reduced-motion: reduce) {
		.local-wallpaper-layer {
			transition: none;
		}
	}
</style>
