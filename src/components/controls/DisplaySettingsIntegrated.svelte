<script lang="ts">
import {
	WALLPAPER_FULLSCREEN,
	WALLPAPER_NONE,
	WALLPAPER_OVERLAY,
} from "@constants/constants";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import {
	getDefaultBannerCarouselEnabled,
	getDefaultGradientEnabled,
	getDefaultHue,
	getDefaultNavbarOpacity,
	getDefaultOverlayCardOpacity,
	getDefaultRainEnabled,
	getDefaultSakuraEnabled,
	getDefaultSnowEnabled,
	getDefaultWavesEnabled,
	getHue,
	getStoredBannerCarouselEnabled,
	getStoredGradientEnabled,
	getStoredNavbarOpacity,
	getStoredOverlayCardOpacity,
	getStoredRainEnabled,
	getStoredSakuraEnabled,
	getStoredSnowEnabled,
	getStoredWallpaperMode,
	getStoredWavesEnabled,
	setBannerCarouselEnabled,
	setGradientEnabled,
	setHue,
	setNavbarOpacity,
	setOverlayBlur,
	setOverlayCardOpacity,
	setOverlayOpacity,
	setRainEnabled,
	setSakuraEnabled,
	setSnowEnabled,
	setWallpaperMode,
	setWavesEnabled,
} from "@utils/setting-utils";
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import {
	backgroundWallpaper,
	rainConfig,
	sakuraConfig,
	siteConfig,
	snowConfig,
} from "@/config";
import type { WALLPAPER_MODE } from "@/types/config";
import {
	getDefaultLocalWallpaperBlur,
	getDefaultLocalWallpaperOpacity,
	getLocalWallpaperBlur,
	getLocalWallpaperOpacity,
	setLocalWallpaperBlur,
	setLocalWallpaperOpacity,
} from "@/utils/local-wallpaper";

let hue = $state(getHue());
let wallpaperMode: WALLPAPER_MODE = $state(backgroundWallpaper.mode);
let currentLayout: "list" | "grid" = $state("list");
const defaultLayout = siteConfig.postListLayout.defaultMode;
const mobileDefaultLayout =
	siteConfig.postListLayout.mobileDefaultMode || defaultLayout;
let mounted = $state(false);
let isSmallScreen = $state(
	typeof window !== "undefined" ? window.innerWidth < 1200 : false,
);
let isMobileWidth = $state(
	typeof window !== "undefined" ? window.innerWidth < 780 : false,
);
let isSwitching = $state(false);
let wavesEnabled = $state(true);
const defaultWavesEnabled = getDefaultWavesEnabled();
let gradientEnabled = $state(true);
const defaultGradientEnabled = getDefaultGradientEnabled();
let bannerCarouselEnabled = $state(true);
const defaultBannerCarouselEnabled = getDefaultBannerCarouselEnabled();
let sakuraEnabled = $state(true);
const defaultSakuraEnabled = getDefaultSakuraEnabled();
let rainEnabled = $state(false);
const defaultRainEnabled = getDefaultRainEnabled();
let snowEnabled = $state(false);
const defaultSnowEnabled = getDefaultSnowEnabled();
let overlayCardOpacity = $state(getDefaultOverlayCardOpacity());
const defaultOverlayCardOpacity = getDefaultOverlayCardOpacity();
let navbarOpacity = $state(getDefaultNavbarOpacity());
const defaultNavbarOpacity = getDefaultNavbarOpacity();
let localWallpaperOpacity = $state(getLocalWallpaperOpacity());
let localWallpaperBlur = $state(getLocalWallpaperBlur());
const defaultLocalWallpaperOpacity = getDefaultLocalWallpaperOpacity();
const defaultLocalWallpaperBlur = getDefaultLocalWallpaperBlur();
let localWallpaperTransparency = $state(
	transparencyPercent(localWallpaperOpacity),
);
let navbarTransparency = $state(transparencyPercent(navbarOpacity));
let overlayCardTransparency = $state(transparencyPercent(overlayCardOpacity));

function transparencyPercent(opacity: number) {
	return Math.round((1 - Math.min(1, Math.max(0, opacity))) * 100);
}

function opacityFromTransparencyPercent(transparency: number) {
	const safeTransparency = Number.isFinite(transparency)
		? Math.min(100, Math.max(0, transparency))
		: 0;
	return 1 - safeTransparency / 100;
}

const isWallpaperSwitchable = backgroundWallpaper.switchable ?? true;
const allowLayoutSwitch = siteConfig.postListLayout.allowSwitch;
let effectiveDefaultLayout = $derived(
	isMobileWidth ? mobileDefaultLayout : defaultLayout,
);
const showThemeColor = !siteConfig.themeColor.fixed;
// 是否允许用户切换水波纹动画（只看 switchable 配置）
const isWavesSwitchable =
	backgroundWallpaper.common?.waves?.switchable ?? false;
// 是否允许用户切换渐变过渡（只看 switchable 配置）
const isGradientSwitchable =
	backgroundWallpaper.common?.gradient?.switchable ?? false;
// 检查是否启用横幅标题配置
// 是否允许用户切换横幅轮播
const isBannerCarouselSwitchable =
	backgroundWallpaper.common?.carousel?.switchable ?? false;
// 是否允许用户切换樱花特效
const isSakuraSwitchable = sakuraConfig?.switchable ?? false;
// 雨滴与樱花使用独立开关，可以同时启用
const isRainSwitchable = rainConfig?.switchable ?? false;
// 飘雪与其他特效使用独立开关，可以同时启用
const isSnowSwitchable = snowConfig?.switchable ?? false;
// 是否有任何横幅设置可显示（后续添加新设置时在此处添加条件）
const hasWallpaperMotionSettings =
	isWavesSwitchable || isGradientSwitchable || isBannerCarouselSwitchable;
const overlaySwitchableConfig =
	backgroundWallpaper.overlay?.switchable ?? false;
const isOverlayCardOpacitySwitchable =
	typeof overlaySwitchableConfig === "boolean"
		? overlaySwitchableConfig
		: (overlaySwitchableConfig.cardOpacity ?? false);
const hasAnyContent = true;

function resetHue() {
	hue = getDefaultHue();
	requestAnimationFrame(refreshAllRangeProgress);
}

function updateHue(value: number) {
	if (!Number.isFinite(value)) return;
	hue = Math.round(Math.min(360, Math.max(0, value)));
	requestAnimationFrame(refreshAllRangeProgress);
}

function resetBackgroundSettings() {
	localWallpaperOpacity = defaultLocalWallpaperOpacity;
	localWallpaperBlur = defaultLocalWallpaperBlur;
	localWallpaperTransparency = transparencyPercent(
		defaultLocalWallpaperOpacity,
	);
	setLocalWallpaperOpacity(defaultLocalWallpaperOpacity);
	setLocalWallpaperBlur(defaultLocalWallpaperBlur);
	setOverlayOpacity(defaultLocalWallpaperOpacity);
	setOverlayBlur(defaultLocalWallpaperBlur);
	if (
		isOverlayCardOpacitySwitchable &&
		overlayCardOpacity !== defaultOverlayCardOpacity
	) {
		overlayCardOpacity = defaultOverlayCardOpacity;
		overlayCardTransparency = transparencyPercent(defaultOverlayCardOpacity);
		setOverlayCardOpacity(defaultOverlayCardOpacity);
	}
	if (navbarOpacity !== defaultNavbarOpacity) {
		navbarOpacity = defaultNavbarOpacity;
		navbarTransparency = transparencyPercent(defaultNavbarOpacity);
		setNavbarOpacity(defaultNavbarOpacity);
	}

	requestAnimationFrame(refreshAllRangeProgress);
}

function resetLayout() {
	currentLayout = effectiveDefaultLayout;
	localStorage.removeItem("postListLayout");

	// 触发自定义事件，通知页面布局已改变
	const event = new CustomEvent("layoutChange", {
		detail: { layout: effectiveDefaultLayout },
	});
	window.dispatchEvent(event);
}

function resetWavesEnabled() {
	wavesEnabled = defaultWavesEnabled;
	setWavesEnabled(defaultWavesEnabled);
}

function resetGradientEnabled() {
	gradientEnabled = defaultGradientEnabled;
	setGradientEnabled(defaultGradientEnabled);
}

function resetBannerSettings() {
	if (isWavesSwitchable && wavesEnabled !== defaultWavesEnabled) {
		wavesEnabled = defaultWavesEnabled;
		setWavesEnabled(defaultWavesEnabled);
	}
	if (isGradientSwitchable && gradientEnabled !== defaultGradientEnabled) {
		gradientEnabled = defaultGradientEnabled;
		setGradientEnabled(defaultGradientEnabled);
	}
	if (
		isBannerCarouselSwitchable &&
		bannerCarouselEnabled !== defaultBannerCarouselEnabled
	) {
		bannerCarouselEnabled = defaultBannerCarouselEnabled;
		setBannerCarouselEnabled(defaultBannerCarouselEnabled);
	}
}

function updateLocalWallpaperOpacity(value: number) {
	if (!Number.isFinite(value)) return;
	localWallpaperTransparency = Math.round(Math.min(100, Math.max(0, value)));
	localWallpaperOpacity = opacityFromTransparencyPercent(
		localWallpaperTransparency,
	);
	setLocalWallpaperOpacity(localWallpaperOpacity);
	setOverlayOpacity(localWallpaperOpacity);
	requestAnimationFrame(refreshAllRangeProgress);
}

function updateLocalWallpaperBlur(value: number) {
	if (!Number.isFinite(value)) return;
	localWallpaperBlur = Math.min(20, Math.max(0, value));
	setLocalWallpaperBlur(localWallpaperBlur);
	setOverlayBlur(localWallpaperBlur);
	requestAnimationFrame(refreshAllRangeProgress);
}

function updateOverlayCardOpacity(value: number) {
	if (!Number.isFinite(value)) return;
	overlayCardTransparency = Math.round(Math.min(100, Math.max(0, value)));
	overlayCardOpacity = opacityFromTransparencyPercent(overlayCardTransparency);
	setOverlayCardOpacity(overlayCardOpacity);
	requestAnimationFrame(refreshAllRangeProgress);
}

function updateNavbarOpacity(value: number) {
	if (!Number.isFinite(value)) return;
	navbarTransparency = Math.round(Math.min(100, Math.max(0, value)));
	navbarOpacity = opacityFromTransparencyPercent(navbarTransparency);
	setNavbarOpacity(navbarOpacity);
	requestAnimationFrame(refreshAllRangeProgress);
}

function toggleWavesEnabled() {
	wavesEnabled = !wavesEnabled;
	setWavesEnabled(wavesEnabled);
}

function toggleGradientEnabled() {
	gradientEnabled = !gradientEnabled;
	setGradientEnabled(gradientEnabled);
}

function toggleBannerCarouselEnabled() {
	bannerCarouselEnabled = !bannerCarouselEnabled;
	setBannerCarouselEnabled(bannerCarouselEnabled);
}

function toggleSakuraEnabled() {
	sakuraEnabled = !sakuraEnabled;
	setSakuraEnabled(sakuraEnabled);
}

function toggleRainEnabled() {
	rainEnabled = !rainEnabled;
	setRainEnabled(rainEnabled);
}

function toggleSnowEnabled() {
	snowEnabled = !snowEnabled;
	setSnowEnabled(snowEnabled);
}

function resetEffectsSettings() {
	if (isSakuraSwitchable && sakuraEnabled !== defaultSakuraEnabled) {
		sakuraEnabled = defaultSakuraEnabled;
		setSakuraEnabled(defaultSakuraEnabled);
	}
	if (isRainSwitchable && rainEnabled !== defaultRainEnabled) {
		rainEnabled = defaultRainEnabled;
		setRainEnabled(defaultRainEnabled);
	}
	if (isSnowSwitchable && snowEnabled !== defaultSnowEnabled) {
		snowEnabled = defaultSnowEnabled;
		setSnowEnabled(defaultSnowEnabled);
	}
}

function switchWallpaperMode(newMode: WALLPAPER_MODE) {
	wallpaperMode = newMode;
	setWallpaperMode(newMode);

	if (newMode === WALLPAPER_OVERLAY) {
		requestAnimationFrame(refreshAllRangeProgress);
	}
}

function checkScreenSize() {
	isSmallScreen = window.innerWidth < 1200;
	isMobileWidth = window.innerWidth < 780;
	// 低于380px强制网格模式
	if (window.innerWidth < 380 && currentLayout === "list") {
		currentLayout = "grid";
		const event = new CustomEvent("layoutChange", {
			detail: { layout: "grid" },
		});
		window.dispatchEvent(event);
	}
}

function updateRangeProgress(input: HTMLInputElement) {
	const min = Number(input.min || 0);
	const max = Number(input.max || 100);
	const value = Number(input.value || 0);
	const progress = ((value - min) * 100) / (max - min || 1);
	input.style.setProperty(
		"--range-progress",
		`${Math.min(100, Math.max(0, progress))}%`,
	);
}

function refreshAllRangeProgress() {
	const panel = document.getElementById("display-setting");
	if (!panel) return;

	const rangeInputs = Array.from(
		panel.querySelectorAll('input[type="range"]'),
	) as HTMLInputElement[];

	rangeInputs.forEach((input) => {
		updateRangeProgress(input);
	});
}

function switchLayout() {
	if (!mounted || isSwitching) return;

	isSwitching = true;
	currentLayout = currentLayout === "list" ? "grid" : "list";
	localStorage.setItem("postListLayout", currentLayout);

	// 触发自定义事件，通知页面布局已改变
	const event = new CustomEvent("layoutChange", {
		detail: { layout: currentLayout },
	});
	window.dispatchEvent(event);

	// 动画完成后重置状态
	setTimeout(() => {
		isSwitching = false;
	}, 500);
}

onMount(() => {
	mounted = true;
	checkScreenSize();

	// 从localStorage读取保存的壁纸模式
	wallpaperMode = getStoredWallpaperMode();

	// 从localStorage读取水波纹动画状态
	wavesEnabled = getStoredWavesEnabled();

	// 从localStorage读取渐变过渡状态
	gradientEnabled = getStoredGradientEnabled();

	// 从localStorage读取横幅标题状态
	// 从localStorage读取横幅轮播状态
	bannerCarouselEnabled = getStoredBannerCarouselEnabled();

	// 从localStorage读取樱花特效状态
	sakuraEnabled = getStoredSakuraEnabled();

	// 雨滴和樱花独立保存，可同时启用
	rainEnabled = getStoredRainEnabled();
	snowEnabled = getStoredSnowEnabled();

	// 封面与全屏透明模式共享同一组透明度和模糊度
	localWallpaperOpacity = getLocalWallpaperOpacity();
	localWallpaperBlur = getLocalWallpaperBlur();
	localWallpaperTransparency = transparencyPercent(localWallpaperOpacity);
	setOverlayOpacity(localWallpaperOpacity);
	setOverlayBlur(localWallpaperBlur);
	overlayCardOpacity = getStoredOverlayCardOpacity();
	overlayCardTransparency = transparencyPercent(overlayCardOpacity);
	setOverlayCardOpacity(overlayCardOpacity);
	navbarOpacity = getStoredNavbarOpacity();
	navbarTransparency = transparencyPercent(navbarOpacity);
	setNavbarOpacity(navbarOpacity);

	// 从localStorage读取用户偏好布局
	const savedLayout = localStorage.getItem("postListLayout");
	if (savedLayout && (savedLayout === "list" || savedLayout === "grid")) {
		currentLayout = savedLayout;
	} else {
		currentLayout =
			window.innerWidth < 780 ? mobileDefaultLayout : defaultLayout;
	}

	// 监听窗口大小变化
	window.addEventListener("resize", checkScreenSize);

	return () => {
		window.removeEventListener("resize", checkScreenSize);
	};
});

// 监听布局变化事件
onMount(() => {
	const handleCustomEvent = (event: Event) => {
		const customEvent = event as CustomEvent<{ layout: "list" | "grid" }>;
		currentLayout = customEvent.detail.layout;
	};

	window.addEventListener("layoutChange", handleCustomEvent);

	return () => {
		window.removeEventListener("layoutChange", handleCustomEvent);
	};
});

onMount(() => {
	const panel = document.getElementById("display-setting");
	if (!panel) return;
	const handleRangeInput = (event: Event) => {
		const target = event.target;
		if (target instanceof HTMLInputElement && target.type === "range") {
			updateRangeProgress(target);
		}
	};

	refreshAllRangeProgress();
	panel.addEventListener("input", handleRangeInput);

	return () => {
		panel.removeEventListener("input", handleRangeInput);
	};
});

onMount(() => {
	const handleWallpaperModeChange = (event: Event) => {
		const customEvent = event as CustomEvent<{ mode: WALLPAPER_MODE }>;
		wallpaperMode = customEvent.detail.mode;
	};

	window.addEventListener("wallpaperModeChange", handleWallpaperModeChange);

	return () => {
		window.removeEventListener(
			"wallpaperModeChange",
			handleWallpaperModeChange,
		);
	};
});

onMount(() => {
	const handleThemeHueChange = (event: Event) => {
		const nextHue = Number(
			(event as CustomEvent<{ hue?: number }>).detail?.hue,
		);
		if (!Number.isFinite(nextHue) || nextHue === hue) return;
		hue = Math.round(Math.min(360, Math.max(0, nextHue)));
		requestAnimationFrame(refreshAllRangeProgress);
	};

	window.addEventListener("firefly:theme-hue-change", handleThemeHueChange);
	return () => {
		window.removeEventListener(
			"firefly:theme-hue-change",
			handleThemeHueChange,
		);
	};
});

$effect(() => {
	if (hue || hue === 0) {
		setHue(hue);
	}
});
</script>

{#if hasAnyContent}
<div id="display-setting" class="float-panel float-panel-closed display-setting-panel transition-all w-80 max-w-[calc(100vw-1.5rem)] px-4 py-2">
    <!-- Theme Color Section -->
    {#if showThemeColor}
    <div class="mt-2 mb-2">
        <div class="flex flex-row gap-2 mb-2 items-center justify-between">
            <div class="flex gap-2 font-bold text-lg text-neutral-900 dark:text-neutral-100 transition relative ml-3
                before:w-1 before:h-4 before:rounded-md before:bg-(--primary)
                before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2"
            >
                {i18n(I18nKey.themeColor)}
                <button aria-label="恢复默认" title="重置" data-tooltip="重置" class="reset-tooltip btn-regular w-7 h-7 rounded-md active:scale-90" onclick={resetHue}>
                    <div class="text-(--btn-content)">
                        <Icon icon="fa7-solid:arrow-rotate-left" class="text-[0.875rem]"></Icon>
                    </div>
                </button>
            </div>
            <div class="flex gap-1">
                <input
                    id="hueValue"
                    type="number"
                    min="0"
                    max="360"
                    step="1"
                    value={hue}
                    aria-label="主题色相数值"
                    oninput={(event) => updateHue((event.currentTarget as HTMLInputElement).valueAsNumber)}
                    class="transition bg-(--btn-regular-bg) w-14 h-8 rounded-lg px-1 text-center font-bold text-sm text-(--btn-content) outline-none focus:ring-1 focus:ring-(--primary)"
                />
            </div>
        </div>
        <div class="w-full h-6 px-1 bg-[oklch(0.80_0.10_0)] dark:bg-[oklch(0.70_0.10_0)] rounded-sm select-none">
            <input
                aria-label={i18n(I18nKey.themeColor)}
                aria-valuetext={`${hue}°`}
                type="range"
                min="0"
                max="360"
                bind:value={hue}
                oninput={(event) => updateHue((event.currentTarget as HTMLInputElement).valueAsNumber)}
                class="slider theme-hue-slider"
                id="colorSlider"
                step="1"
            >
        </div>
    </div>
    {/if}

    <!-- Unified Cover / Fullscreen Wallpaper Section -->
    <div class="mt-3 mb-3">
        <div class="flex gap-2 font-bold text-lg text-neutral-900 dark:text-neutral-100 transition relative ml-3 mb-2
            before:w-1 before:h-4 before:rounded-md before:bg-(--primary)
            before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2"
        >
            封面 / 全屏背景
            <button aria-label="重置透明度和模糊度" title="重置" data-tooltip="重置" class="reset-tooltip btn-regular w-7 h-7 rounded-md active:scale-90" onclick={resetBackgroundSettings}>
                <div class="text-(--btn-content)">
                    <Icon icon="fa7-solid:arrow-rotate-left" class="text-[0.875rem]"></Icon>
                </div>
            </button>
        </div>
        <div class="wallpaper-settings-shell rounded-xl p-3 space-y-2.5">
            {#if isWallpaperSwitchable}
                <div class="wallpaper-mode-grid grid grid-cols-3 gap-1.5">
                    <button
                        type="button"
                        class="wallpaper-mode-button btn-regular rounded-lg py-2.5 px-1.5 flex flex-col items-center justify-center gap-1 transition-all"
                        class:opacity-60={wallpaperMode !== WALLPAPER_FULLSCREEN}
                        class:bg-(--btn-regular-bg-hover)={wallpaperMode === WALLPAPER_FULLSCREEN}
                        class:wallpaper-mode-active={wallpaperMode === WALLPAPER_FULLSCREEN}
                        onclick={() => switchWallpaperMode(WALLPAPER_FULLSCREEN)}
                    >
                        <Icon icon="material-symbols:wallpaper" class="text-[1.2rem]"></Icon>
                        <span class="text-[0.68rem] font-medium">封面壁纸</span>
                    </button>
                    <button
                        type="button"
                        class="wallpaper-mode-button btn-regular rounded-lg py-2.5 px-1.5 flex flex-col items-center justify-center gap-1 transition-all"
                        class:opacity-60={wallpaperMode !== WALLPAPER_OVERLAY}
                        class:bg-(--btn-regular-bg-hover)={wallpaperMode === WALLPAPER_OVERLAY}
                        class:wallpaper-mode-active={wallpaperMode === WALLPAPER_OVERLAY}
                        onclick={() => switchWallpaperMode(WALLPAPER_OVERLAY)}
                    >
                        <Icon icon="material-symbols:full-coverage-outline-rounded" class="text-[1.2rem]"></Icon>
                        <span class="text-[0.68rem] font-medium">全屏透明</span>
                    </button>
                    <button
                        type="button"
                        class="wallpaper-mode-button btn-regular rounded-lg py-2.5 px-1.5 flex flex-col items-center justify-center gap-1 transition-all"
                        class:opacity-60={wallpaperMode !== WALLPAPER_NONE}
                        class:bg-(--btn-regular-bg-hover)={wallpaperMode === WALLPAPER_NONE}
                        class:wallpaper-mode-active={wallpaperMode === WALLPAPER_NONE}
                        onclick={() => switchWallpaperMode(WALLPAPER_NONE)}
                    >
                        <Icon icon="material-symbols:hide-image-outline" class="text-[1.2rem]"></Icon>
                        <span class="text-[0.68rem] font-medium">纯色背景</span>
                    </button>
                </div>
            {/if}

            {#if wallpaperMode !== WALLPAPER_NONE}
                <div class="wallpaper-control-card rounded-lg p-2.5">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium text-(--btn-content) opacity-80">壁纸透明度</span>
                        <div class="numeric-value-field">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                bind:value={localWallpaperTransparency}
                                aria-label="壁纸透明度数值"
                                oninput={(event) => updateLocalWallpaperOpacity((event.currentTarget as HTMLInputElement).valueAsNumber)}
                                class="numeric-value-input"
                            />
                            <span>%</span>
                        </div>
                    </div>
                    <input
                        aria-label="当前壁纸透明度"
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        bind:value={localWallpaperTransparency}
                        oninput={(event) => updateLocalWallpaperOpacity(Number((event.currentTarget as HTMLInputElement).value))}
                        class="slider w-full overlay-slider"
                    />
                </div>

                <div class="wallpaper-control-card rounded-lg p-2.5">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium text-(--btn-content) opacity-80">背景模糊</span>
                        <div class="numeric-value-field">
                            <input
                                type="number"
                                min="0"
                                max="20"
                                step="0.5"
                                bind:value={localWallpaperBlur}
                                aria-label="背景模糊数值"
                                oninput={(event) => updateLocalWallpaperBlur((event.currentTarget as HTMLInputElement).valueAsNumber)}
                                class="numeric-value-input"
                            />
                            <span>px</span>
                        </div>
                    </div>
                    <input
                        aria-label="当前背景模糊度"
                        type="range"
                        min="0"
                        max="20"
                        step="0.5"
                        bind:value={localWallpaperBlur}
                        oninput={(event) => updateLocalWallpaperBlur(Number((event.currentTarget as HTMLInputElement).value))}
                        class="slider w-full overlay-slider"
                    />
                </div>

                <div class="wallpaper-control-card rounded-lg p-2.5">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-sm font-medium text-(--btn-content) opacity-80">导航栏透明度</span>
                        <div class="numeric-value-field">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="1"
                                bind:value={navbarTransparency}
                                aria-label="导航栏透明度数值"
                                oninput={(event) => updateNavbarOpacity((event.currentTarget as HTMLInputElement).valueAsNumber)}
                                class="numeric-value-input"
                            />
                            <span>%</span>
                        </div>
                    </div>
                    <input
                        aria-label="当前导航栏透明度"
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        bind:value={navbarTransparency}
                        oninput={(event) => updateNavbarOpacity(Number((event.currentTarget as HTMLInputElement).value))}
                        class="slider w-full overlay-slider"
                    />
                </div>

                {#if isOverlayCardOpacitySwitchable}
                    <div class="wallpaper-control-card rounded-lg p-2.5">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-sm font-medium text-(--btn-content) opacity-80">卡片透明度</span>
                            <div class="numeric-value-field">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    bind:value={overlayCardTransparency}
                                    aria-label="卡片透明度数值"
                                    oninput={(event) => updateOverlayCardOpacity((event.currentTarget as HTMLInputElement).valueAsNumber)}
                                    class="numeric-value-input"
                                />
                                <span>%</span>
                            </div>
                        </div>
                        <input
                            aria-label="当前卡片透明度"
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            bind:value={overlayCardTransparency}
                            oninput={(event) => updateOverlayCardOpacity(Number((event.currentTarget as HTMLInputElement).value))}
                            class="slider w-full overlay-slider"
                        />
                    </div>
                {/if}

                {#if wallpaperMode === WALLPAPER_FULLSCREEN && hasWallpaperMotionSettings}
                    <div class="wallpaper-motion-settings">
                        <div class="wallpaper-motion-heading">
                            <span>壁纸动态</span>
                            <button
                                type="button"
                                aria-label="重置壁纸动态效果"
                                title="重置"
                                data-tooltip="重置"
                                class="reset-tooltip btn-regular w-7 h-7 rounded-md"
                                onclick={resetBannerSettings}
                            >
                                <Icon icon="fa7-solid:arrow-rotate-left" class="text-[0.875rem]"></Icon>
                            </button>
                        </div>
                        <div class="effect-toggle-list space-y-1.5">
                            {#if isBannerCarouselSwitchable}
                                <button
                                    type="button"
                                    class="effect-toggle-button w-full btn-regular rounded-lg py-2.5 px-3 flex items-center gap-3 text-left transition-all relative overflow-hidden"
                                    class:bg-(--btn-regular-bg-hover)={bannerCarouselEnabled}
                                    class:effect-toggle-active={bannerCarouselEnabled}
                                    aria-pressed={bannerCarouselEnabled}
                                    onclick={toggleBannerCarouselEnabled}
                                >
                                    <Icon icon="material-symbols:view-carousel-outline" class="text-[1.25rem] shrink-0"></Icon>
                                    <span class="text-sm flex-1">{i18n(I18nKey.wallpaperCarousel)}</span>
                                    <span class:toggle-on={bannerCarouselEnabled} class="settings-toggle" aria-hidden="true"><i></i></span>
                                </button>
                            {/if}
                            {#if isWavesSwitchable}
                                <button
                                    type="button"
                                    class="effect-toggle-button w-full btn-regular rounded-lg py-2.5 px-3 flex items-center gap-3 text-left transition-all relative overflow-hidden"
                                    class:bg-(--btn-regular-bg-hover)={wavesEnabled}
                                    class:effect-toggle-active={wavesEnabled}
                                    aria-pressed={wavesEnabled}
                                    onclick={toggleWavesEnabled}
                                >
                                    <Icon icon="material-symbols:airwave-rounded" class="text-[1.25rem] shrink-0"></Icon>
                                    <span class="text-sm flex-1">{i18n(I18nKey.wavesAnimation)}</span>
                                    <span class:toggle-on={wavesEnabled} class="settings-toggle" aria-hidden="true"><i></i></span>
                                </button>
                            {/if}
                            {#if isGradientSwitchable}
                                <button
                                    type="button"
                                    class="effect-toggle-button w-full btn-regular rounded-lg py-2.5 px-3 flex items-center gap-3 text-left transition-all relative overflow-hidden"
                                    class:bg-(--btn-regular-bg-hover)={gradientEnabled}
                                    class:effect-toggle-active={gradientEnabled}
                                    aria-pressed={gradientEnabled}
                                    onclick={toggleGradientEnabled}
                                >
                                    <Icon icon="material-symbols:gradient" class="text-[1.25rem] shrink-0"></Icon>
                                    <span class="text-sm flex-1">{i18n(I18nKey.gradientTransition)}</span>
                                    <span class:toggle-on={gradientEnabled} class="settings-toggle" aria-hidden="true"><i></i></span>
                                </button>
                            {/if}
                        </div>
                    </div>
                {/if}

                <p class="m-0 px-1 text-[0.68rem] leading-relaxed text-(--btn-content) opacity-60">
                    封面与全屏壁纸共用这一组透明度和模糊度；透明度越高，图层越透明（0% 完全显示，100% 完全透明）。
                </p>
            {:else}
                <p class="m-0 px-1 py-2 text-[0.68rem] leading-relaxed text-(--btn-content) opacity-60">
                    纯色背景不使用壁纸透明度和模糊度。
                </p>
            {/if}
        </div>
    </div>

    <!-- Effects Settings Section -->
    {#if isSakuraSwitchable || isRainSwitchable || isSnowSwitchable}
        <div class="mt-2 mb-2">
            <div class="flex gap-2 font-bold text-lg text-neutral-900 dark:text-neutral-100 transition relative ml-3 mb-2
                before:w-1 before:h-4 before:rounded-md before:bg-(--primary)
                before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2"
            >
                {i18n(I18nKey.effectsSettings)}
                <button aria-label="恢复默认" title="重置" data-tooltip="重置" class="reset-tooltip btn-regular w-7 h-7 rounded-md active:scale-90" onclick={resetEffectsSettings}>
                    <div class="text-(--btn-content)">
                        <Icon icon="fa7-solid:arrow-rotate-left" class="text-[0.875rem]"></Icon>
                    </div>
                </button>
            </div>
            <div class="space-y-1">
                {#if isSakuraSwitchable}
                    <button
                        class="effect-toggle-button w-full btn-regular rounded-lg py-2.5 px-3 flex items-center gap-3 text-left active:scale-[0.98] transition-all relative overflow-hidden"
                        class:bg-(--btn-regular-bg-hover)={sakuraEnabled}
                        class:effect-toggle-active={sakuraEnabled}
                        onclick={toggleSakuraEnabled}
                    >
                        <Icon icon="mdi:flower-poppy" class="text-[1.25rem] shrink-0"></Icon>
                        <span class="text-sm flex-1">{i18n(I18nKey.sakuraEffect)}</span>
                        <div class="w-10 h-5 rounded-full transition-all duration-200 relative"
                             class:bg-(--primary)={sakuraEnabled}
                             class:bg-(--btn-regular-bg-active)={!sakuraEnabled}>
                            <div class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
                                 class:left-0.5={!sakuraEnabled}
                                 class:left-5={sakuraEnabled}></div>
                        </div>
                    </button>
                {/if}
                {#if isRainSwitchable}
                    <button
                        class="effect-toggle-button w-full btn-regular rounded-lg py-2.5 px-3 flex items-center gap-3 text-left active:scale-[0.98] transition-all relative overflow-hidden"
                        class:bg-(--btn-regular-bg-hover)={rainEnabled}
                        class:effect-toggle-active={rainEnabled}
                        onclick={toggleRainEnabled}
                    >
                        <Icon icon="material-symbols:rainy" class="text-[1.25rem] shrink-0"></Icon>
                        <span class="text-sm flex-1">{i18n(I18nKey.rainEffect)}</span>
                        <div class="w-10 h-5 rounded-full transition-all duration-200 relative"
                             class:bg-(--primary)={rainEnabled}
                             class:bg-(--btn-regular-bg-active)={!rainEnabled}>
                            <div class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
                                 class:left-0.5={!rainEnabled}
                                 class:left-5={rainEnabled}></div>
                        </div>
                    </button>
                {/if}
                {#if isSnowSwitchable}
                    <button
                        class="effect-toggle-button w-full btn-regular rounded-lg py-2.5 px-3 flex items-center gap-3 text-left active:scale-[0.98] transition-all relative overflow-hidden"
                        class:bg-(--btn-regular-bg-hover)={snowEnabled}
                        class:effect-toggle-active={snowEnabled}
                        onclick={toggleSnowEnabled}
                    >
                        <Icon icon="material-symbols:ac-unit" class="text-[1.25rem] shrink-0"></Icon>
                        <span class="text-sm flex-1">{i18n(I18nKey.snowEffect)}</span>
                        <div class="w-10 h-5 rounded-full transition-all duration-200 relative"
                             class:bg-(--primary)={snowEnabled}
                             class:bg-(--btn-regular-bg-active)={!snowEnabled}>
                            <div class="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
                                 class:left-0.5={!snowEnabled}
                                 class:left-5={snowEnabled}></div>
                        </div>
                    </button>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Layout Switch Section -->
    {#if allowLayoutSwitch}
        <div class="mt-2 mb-2">
            <div class="flex gap-2 font-bold text-lg text-neutral-900 dark:text-neutral-100 transition relative ml-3 mb-2
                before:w-1 before:h-4 before:rounded-md before:bg-(--primary)
                before:absolute before:-left-3 before:top-1/2 before:-translate-y-1/2"
            >
                {i18n(I18nKey.postListLayout)}
                <button aria-label="恢复默认" title="重置" data-tooltip="重置" class="reset-tooltip btn-regular w-7 h-7 rounded-md active:scale-90" onclick={resetLayout}>
                    <div class="text-(--btn-content)">
                        <Icon icon="fa7-solid:arrow-rotate-left" class="text-[0.875rem]"></Icon>
                    </div>
                </button>
            </div>
            <div class="flex gap-2">
                <button
                    aria-label={i18n(I18nKey.postListLayoutList)}
                    class="flex-1 btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
                    class:opacity-60={currentLayout !== 'list'}
                    class:bg-(--btn-regular-bg-hover)={currentLayout === 'list'}
                    disabled={isSwitching}
                    onclick={switchLayout}
                    title={i18n(I18nKey.postListLayoutList)}
                >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
                    </svg>
                    <span class="text-xs font-medium">{i18n(I18nKey.postListLayoutList)}</span>
                </button>
                <button
                    aria-label={i18n(I18nKey.postListLayoutGrid)}
                    class="flex-1 btn-regular rounded-md py-2 px-3 flex items-center justify-center gap-2 active:scale-95 transition-all relative overflow-hidden"
                    class:opacity-60={currentLayout !== 'grid'}
                    class:bg-(--btn-regular-bg-hover)={currentLayout === 'grid'}
                    disabled={isSwitching}
                    onclick={switchLayout}
                    title={i18n(I18nKey.postListLayoutGrid)}
                >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z"/>
                    </svg>
                    <span class="text-xs font-medium">{i18n(I18nKey.postListLayoutGrid)}</span>
                </button>
            </div>
        </div>
    {/if}
</div>
{/if}


<style lang="stylus">
    #display-setting
        position fixed !important
        top 5.75rem
        right 0.75rem
        height unquote("min(48rem, calc(100dvh - 6.5rem))")
        max-height calc(100dvh - 6.5rem)
        overflow-x hidden !important
        overflow-y auto !important
        overscroll-behavior contain
        scrollbar-gutter stable
        touch-action pan-y
        -webkit-overflow-scrolling touch

        &::-webkit-scrollbar
            width 0.45rem

        &::-webkit-scrollbar-track
            background transparent

        &::-webkit-scrollbar-thumb
            border 0.12rem solid transparent
            border-radius 999px
            background unquote("color-mix(in oklch, var(--primary) 58%, transparent)")
            background-clip padding-box

        .reset-tooltip
            position relative
            overflow visible

            &::after
                content attr(data-tooltip)
                position absolute
                left calc(100% + 0.4rem)
                top 50%
                z-index 30
                transform translate(-0.2rem, -50%)
                padding 0.25rem 0.45rem
                border-radius 0.4rem
                background rgba(20, 24, 31, 0.9)
                color white
                font-size 0.68rem
                font-weight 500
                line-height 1
                white-space nowrap
                opacity 0
                pointer-events none
                transition opacity 0.15s ease, transform 0.15s ease

            &:hover::after,
            &:focus-visible::after
                opacity 1
                transform translate(0, -50%)

        .wallpaper-settings-shell
            border 1px solid rgba(90, 155, 92, 0.18)
            background linear-gradient(145deg, rgba(137, 196, 137, 0.14), rgba(246, 252, 246, 0.07))
            box-shadow inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 10px 28px rgba(23, 45, 32, 0.06)
            backdrop-filter blur(10px)

        .wallpaper-mode-grid
            padding 0.3rem
            border 1px solid rgba(90, 155, 92, 0.12)
            border-radius 0.85rem
            background rgba(137, 196, 137, 0.08)

        .wallpaper-mode-button
            min-height 4.6rem
            border 1px solid transparent

            &:hover
                transform translateY(-1px)
                border-color rgba(90, 155, 92, 0.22)

            &.wallpaper-mode-active
                opacity 1 !important
                transform translateY(-1px)
                border-color rgba(72, 151, 76, 0.28)
                box-shadow 0 5px 14px rgba(45, 92, 48, 0.12)

        .wallpaper-control-card
            border 1px solid rgba(90, 155, 92, 0.12)
            background var(--card-bg)
            box-shadow 0 4px 14px rgba(20, 45, 28, 0.045)
            transition border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease

            &:focus-within
                border-color rgba(72, 151, 76, 0.36)
                box-shadow 0 6px 18px rgba(45, 92, 48, 0.09)

        .wallpaper-motion-settings
            padding-top 0.15rem

        .wallpaper-motion-heading
            display flex
            align-items center
            justify-content space-between
            margin 0.15rem 0 0.35rem
            padding 0 0.25rem
            color var(--btn-content)
            font-size 0.72rem
            font-weight 700
            opacity 0.78

        .settings-toggle
            position relative
            display inline-flex
            width 2.5rem
            height 1.35rem
            flex 0 0 auto
            align-items center
            border-radius 999px
            background var(--btn-regular-bg-active)
            transition background-color 0.18s ease

            i
                width 1rem
                height 1rem
                margin-left 0.18rem
                border-radius 50%
                background white
                box-shadow 0 1px 3px rgba(0, 0, 0, 0.18)
                transition transform 0.18s ease

            &.toggle-on
                background var(--primary)

                i
                    transform translateX(1.08rem)

        .numeric-value-field
            display flex
            align-items center
            justify-content flex-end
            min-width 4.6rem
            height 1.9rem
            padding 0.1rem 0.45rem
            border 1px solid rgba(90, 155, 92, 0.12)
            border-radius 0.6rem
            background var(--btn-regular-bg)
            color var(--btn-content)
            transition border-color 0.15s ease, box-shadow 0.15s ease

            &:focus-within
                border-color var(--primary)
                box-shadow 0 0 0 2px rgba(72, 151, 76, 0.12)

            span
                margin-left 0.15rem
                font-size 0.68rem
                opacity 0.62

        .numeric-value-input
            width 2.9rem
            min-width 0
            border 0
            outline 0
            background transparent
            color inherit
            font-size 0.76rem
            font-weight 650
            line-height 1
            text-align right

        .effect-toggle-list
            padding 0.3rem
            border 1px solid rgba(90, 155, 92, 0.1)
            border-radius 0.85rem
            background rgba(137, 196, 137, 0.06)

        .effect-toggle-button
            border 1px solid transparent

            &:hover
                transform translateY(-1px)
                border-color rgba(90, 155, 92, 0.2)

            &.effect-toggle-active
                border-color rgba(72, 151, 76, 0.28)
                box-shadow 0 4px 12px rgba(45, 92, 48, 0.1)

        input[type="range"]
            -webkit-appearance none
            height 1.5rem
            border-radius 999px
            background-image unquote("linear-gradient(90deg, var(--primary) 0 var(--range-progress, 50%), hsla(var(--hue), 22%, 28%, 0.18) var(--range-progress, 50%) 100%)")
            transition background-image 0.15s ease-in-out
            cursor pointer

        input[type="range"].theme-hue-slider
            width 100%
            height 1.5rem
            touch-action none
            background-image linear-gradient(90deg, #f29cac 0%, #efc36f 18%, #8ad49b 36%, #58d2ca 52%, #72b9eb 70%, #b8a6ee 84%, #e69dcb 100%)

            &::-webkit-slider-thumb
                -webkit-appearance none
                width 0.72rem
                height 1.1rem
                border 2px solid rgba(255, 255, 255, 0.88)
                border-radius 0.25rem
                background var(--primary)
                box-shadow 0 1px 5px rgba(0, 0, 0, 0.25)
                cursor pointer

            &::-moz-range-thumb
                width 0.72rem
                height 1.1rem
                border 2px solid rgba(255, 255, 255, 0.88)
                border-radius 0.25rem
                background var(--primary)
                box-shadow 0 1px 5px rgba(0, 0, 0, 0.25)
                cursor pointer

        input[type="range"].overlay-slider
            height 0.85rem
            cursor pointer
            touch-action none

            /* Input Thumb */
            &::-webkit-slider-thumb
                -webkit-appearance none
                height 1rem
                width 1rem
                border 2px solid var(--primary)
                border-radius 50%
                background var(--card-bg)
                box-shadow 0 1px 4px rgba(0, 0, 0, 0.18)
                cursor pointer
                transition transform 0.15s ease, box-shadow 0.15s ease

                &:hover
                    transform scale(1.1)
                    box-shadow 0 2px 6px rgba(0, 0, 0, 0.22)

                &:active
                    transform scale(1.18)

            &::-moz-range-thumb
                height 1rem
                width 1rem
                border 2px solid var(--primary)
                border-radius 50%
                background var(--card-bg)
                box-shadow 0 1px 4px rgba(0, 0, 0, 0.18)
                cursor pointer

                &:hover
                    transform scale(1.1)

                &:active
                    transform scale(1.18)

            &::-ms-thumb
                -webkit-appearance none
                height 1rem
                width 1rem
                border 2px solid var(--primary)
                border-radius 50%
                background var(--card-bg)
                box-shadow 0 1px 4px rgba(0, 0, 0, 0.18)
                cursor pointer

        #colorSlider
            background-image var(--color-selection-bar)
            transition background-image 0.15s ease-in-out

            &::-webkit-slider-thumb
                -webkit-appearance none
                height 1rem
                width 0.5rem
                border 0
                border-radius 0.125rem
                background rgba(255, 255, 255, 0.72)
                box-shadow none

                &:hover
                    transform none
                    background rgba(255, 255, 255, 0.84)

                &:active
                    transform none
                    background rgba(255, 255, 255, 0.62)

            &::-moz-range-thumb
                -webkit-appearance none
                height 1rem
                width 0.5rem
                border 0
                border-radius 0.125rem
                background rgba(255, 255, 255, 0.72)
                box-shadow none

                &:hover
                    transform none
                    background rgba(255, 255, 255, 0.84)

                &:active
                    transform none
                    background rgba(255, 255, 255, 0.62)

            &::-ms-thumb
                -webkit-appearance none
                height 1rem
                width 0.5rem
                border 0
                border-radius 0.125rem
                background rgba(255, 255, 255, 0.72)
                box-shadow none

                &:hover
                    transform none
                    background rgba(255, 255, 255, 0.84)

                &:active
                    transform none
                    background rgba(255, 255, 255, 0.62)

</style>
