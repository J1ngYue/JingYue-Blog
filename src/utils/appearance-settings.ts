import {
	argbFromHex,
	DynamicScheme,
	Hct,
	hexFromArgb,
	Variant,
} from "@material/material-color-utilities";
import { rainConfig, sakuraConfig, siteConfig, snowConfig } from "@/config";

export const APPEARANCE_CHANGE_EVENT = "firefly:appearance-change";
const storageKey = "jingyueAppearance";
export type PaletteStyle =
	| "tonal"
	| "vibrant"
	| "content"
	| "expressive"
	| "rainbow"
	| "fruit"
	| "monochrome"
	| "neutral"
	| "fidelity"
	| "original";
export const paletteStyles: ReadonlyArray<{
	id: Exclude<PaletteStyle, "original">;
	label: string;
	variant: Variant;
}> = [
	{ id: "tonal", label: "色调点", variant: Variant.TONAL_SPOT },
	{ id: "vibrant", label: "鲜艳", variant: Variant.VIBRANT },
	{ id: "content", label: "内容色", variant: Variant.CONTENT },
	{ id: "expressive", label: "表现力", variant: Variant.EXPRESSIVE },
	{ id: "rainbow", label: "彩虹", variant: Variant.RAINBOW },
	{ id: "fruit", label: "水果沙拉", variant: Variant.FRUIT_SALAD },
	{ id: "monochrome", label: "单色", variant: Variant.MONOCHROME },
	{ id: "neutral", label: "中性", variant: Variant.NEUTRAL },
	{ id: "fidelity", label: "保真", variant: Variant.FIDELITY },
] as const;
export const backgroundTextures = [
	{ id: "none", label: "无纹理" },
	{ id: "stardust", label: "星芒光斑" },
	{ id: "dots", label: "极客点阵" },
	{ id: "contours", label: "流光等高线" },
	{ id: "geometric", label: "几何晶体" },
	{ id: "sakura", label: "落樱微瓣" },
] as const;
export type AppearanceSettings = {
	palette: PaletteStyle;
	spec: "2021" | "2025";
	sourceColor: string;
	texture: (typeof backgroundTextures)[number]["id"];
	fullscreenLayout: "classic" | "hero";
	reducedMotion: boolean;
};
const defaults: AppearanceSettings = {
	palette: "original",
	spec: "2021",
	sourceColor: "",
	texture: "none",
	fullscreenLayout: "hero",
	reducedMotion: false,
};

export function getAppearanceSettings(): AppearanceSettings {
	if (typeof localStorage === "undefined") return { ...defaults };
	try {
		const stored = JSON.parse(localStorage.getItem(storageKey) || "{}");
		return {
			palette: paletteStyles.some((item) => item.id === stored.palette)
				? stored.palette
				: "original",
			spec: stored.spec === "2025" ? "2025" : "2021",
			sourceColor: /^#[\da-f]{6}$/i.test(stored.sourceColor)
				? stored.sourceColor
				: "",
			texture: backgroundTextures.some((item) => item.id === stored.texture)
				? stored.texture
				: "none",
			fullscreenLayout:
				stored.fullscreenLayout === "classic" ? "classic" : "hero",
			reducedMotion: stored.reducedMotion === true,
		};
	} catch {
		return { ...defaults };
	}
}

function getSource(hue: number, settings: AppearanceSettings) {
	return settings.sourceColor
		? Hct.fromInt(argbFromHex(settings.sourceColor))
		: Hct.from(hue, 48, 50);
}
export function getAppearanceSourceColor(
	hue: number,
	settings: AppearanceSettings,
): string {
	return hexFromArgb(getSource(hue, settings).toInt());
}
export function hueFromSourceColor(color: string): number {
	return Math.round(Hct.fromInt(argbFromHex(color)).hue);
}
function makeScheme(
	hue: number,
	settings: AppearanceSettings,
	palette: PaletteStyle,
	dark = false,
) {
	const variant =
		paletteStyles.find((item) => item.id === palette)?.variant ??
		Variant.TONAL_SPOT;
	return new DynamicScheme({
		sourceColorHct: getSource(hue, settings),
		variant,
		isDark: dark,
		contrastLevel: 0,
		specVersion: settings.spec,
	});
}
export function getPaletteSwatches(
	hue: number,
	settings: AppearanceSettings,
	palette: PaletteStyle,
): string[] {
	const scheme = makeScheme(hue, settings, palette);
	return [scheme.primary, scheme.secondary, scheme.tertiary].map(hexFromArgb);
}

const colorProperties = [
	"--primary",
	"--page-bg",
	"--card-bg",
	"--card-bg-transparent",
	"--deep-text",
	"--content-meta",
	"--btn-content",
	"--btn-regular-bg",
	"--btn-regular-bg-hover",
	"--btn-regular-bg-active",
	"--title-active",
	"--selection-bg",
	"--link-hover",
	"--link-active",
	"--muted",
];
export function applyAppearanceColors(
	hue: number,
	settings: AppearanceSettings = getAppearanceSettings(),
): void {
	const root = document.documentElement;
	root.dataset.colorStyle = settings.palette;
	root.dataset.colorSpec = settings.spec;
	if (settings.palette === "original") {
		for (const property of colorProperties) root.style.removeProperty(property);
		return;
	}
	const scheme = makeScheme(
		hue,
		settings,
		settings.palette,
		root.classList.contains("dark"),
	);
	const roles: Record<string, number> = {
		"--primary": scheme.primary,
		"--page-bg": scheme.surface,
		"--card-bg": scheme.surfaceContainerLowest,
		"--deep-text": scheme.onSurface,
		"--content-meta": scheme.onSurfaceVariant,
		"--btn-content": scheme.onPrimaryContainer,
		"--btn-regular-bg": scheme.primaryContainer,
		"--btn-regular-bg-hover": scheme.secondaryContainer,
		"--btn-regular-bg-active": scheme.tertiaryContainer,
		"--title-active": scheme.primary,
		"--selection-bg": scheme.primaryContainer,
		"--link-hover": scheme.secondaryContainer,
		"--link-active": scheme.primaryContainer,
		"--muted": scheme.surfaceContainerHigh,
	};
	for (const [property, color] of Object.entries(roles))
		root.style.setProperty(property, hexFromArgb(color));
	root.style.setProperty(
		"--card-bg-transparent",
		`color-mix(in srgb, ${hexFromArgb(scheme.surfaceContainerLowest)} calc(var(--card-transparent-opacity, .65) * 100%), transparent)`,
	);
}

type EffectManager = {
	start?: () => void;
	init?: () => void;
	stop?: () => void;
	stopImmediate?: () => void;
};
let previousReducedMotion = false;
function applyMotionPreference(reduced: boolean) {
	document.documentElement.dataset.reduceMotion = String(reduced);
	if (previousReducedMotion === reduced) return;
	previousReducedMotion = reduced;
	const effects = window as Window & {
		sakuraManager?: EffectManager;
		rainEffectManager?: EffectManager;
		snowEffectManager?: EffectManager;
	};
	for (const [manager, key, enabled] of [
		[effects.sakuraManager, "sakuraEnabled", sakuraConfig.enable],
		[effects.rainEffectManager, "rainEnabled", rainConfig.enable],
		[effects.snowEffectManager, "snowEnabled", snowConfig.enable],
	] as const) {
		if (reduced) (manager?.stopImmediate ?? manager?.stop)?.call(manager);
		else if ((localStorage.getItem(key) ?? String(enabled)) === "true")
			(manager?.start ?? manager?.init)?.call(manager);
	}
	window.dispatchEvent(new Event("firefly:motion-preference-change"));
}

export function applyAppearanceSettings(
	settings: AppearanceSettings = getAppearanceSettings(),
): void {
	const root = document.documentElement;
	root.dataset.backgroundTexture = settings.texture;
	root.dataset.fullscreenLayout = settings.fullscreenLayout;
	applyMotionPreference(
		settings.reducedMotion ||
			matchMedia("(prefers-reduced-motion: reduce)").matches,
	);
	applyAppearanceColors(
		Number(localStorage.getItem("hue") || siteConfig.themeColor.hue),
		settings,
	);
}
export function setAppearanceSettings(
	patch: Partial<AppearanceSettings>,
): AppearanceSettings {
	const settings = { ...getAppearanceSettings(), ...patch };
	localStorage.setItem(storageKey, JSON.stringify(settings));
	applyAppearanceSettings(settings);
	window.dispatchEvent(
		new CustomEvent(APPEARANCE_CHANGE_EVENT, { detail: settings }),
	);
	return settings;
}

let initialized = false;
export function initAppearanceSettings(): void {
	applyAppearanceSettings();
	if (initialized) return;
	initialized = true;
	let dark = document.documentElement.classList.contains("dark");
	new MutationObserver(() => {
		const nextDark = document.documentElement.classList.contains("dark");
		if (nextDark === dark) return;
		dark = nextDark;
		applyAppearanceSettings();
	}).observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});
	window.addEventListener("firefly:theme-hue-change", (event) => {
		const hue = (event as CustomEvent<{ hue: number }>).detail.hue;
		const settings = getAppearanceSettings();
		if (
			settings.sourceColor &&
			Math.abs(hueFromSourceColor(settings.sourceColor) - hue) > 1
		)
			setAppearanceSettings({ sourceColor: "" });
		else applyAppearanceColors(hue, settings);
	});
	matchMedia("(prefers-reduced-motion: reduce)").addEventListener(
		"change",
		() => applyAppearanceSettings(),
	);
	document.addEventListener("astro:page-load", () => applyAppearanceSettings());
	document.addEventListener("swup:contentReplaced", () =>
		applyAppearanceSettings(),
	);
}
