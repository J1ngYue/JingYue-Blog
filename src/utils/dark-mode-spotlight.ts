export const DARK_MODE_SPOTLIGHT_CHANGE_EVENT =
	"firefly:dark-mode-spotlight-change";
export const DARK_MODE_SPOTLIGHT_STORAGE_KEY = "fireflyDarkModeSpotlightV1";

export interface DarkModeSpotlightSettings {
	enabled: boolean;
	color: string;
	angle: number;
	range: number;
}

export const DEFAULT_DARK_MODE_SPOTLIGHT: DarkModeSpotlightSettings = {
	enabled: true,
	color: "#ffb36b",
	angle: 34,
	range: 76,
};

const COLOR_PATTERN = /^#[\da-f]{6}$/i;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function canUseLocalStorage() {
	return (
		typeof localStorage !== "undefined" &&
		typeof localStorage.getItem === "function"
	);
}

function normalizeSettings(
	value: Partial<DarkModeSpotlightSettings> | null | undefined,
): DarkModeSpotlightSettings {
	return {
		enabled: value?.enabled !== false,
		color:
			typeof value?.color === "string" && COLOR_PATTERN.test(value.color)
				? value.color
				: DEFAULT_DARK_MODE_SPOTLIGHT.color,
		angle: Number.isFinite(value?.angle)
			? clamp(Number(value?.angle), 16, 58)
			: DEFAULT_DARK_MODE_SPOTLIGHT.angle,
		range: Number.isFinite(value?.range)
			? clamp(Number(value?.range), 40, 100)
			: DEFAULT_DARK_MODE_SPOTLIGHT.range,
	};
}

export function getDarkModeSpotlightSettings(): DarkModeSpotlightSettings {
	if (!canUseLocalStorage()) return { ...DEFAULT_DARK_MODE_SPOTLIGHT };
	try {
		const value = JSON.parse(
			localStorage.getItem(DARK_MODE_SPOTLIGHT_STORAGE_KEY) || "null",
		);
		return value && typeof value === "object" && !Array.isArray(value)
			? normalizeSettings(value as Partial<DarkModeSpotlightSettings>)
			: { ...DEFAULT_DARK_MODE_SPOTLIGHT };
	} catch {
		return { ...DEFAULT_DARK_MODE_SPOTLIGHT };
	}
}

export function setDarkModeSpotlightSettings(
	patch: Partial<DarkModeSpotlightSettings>,
) {
	const settings = normalizeSettings({
		...getDarkModeSpotlightSettings(),
		...patch,
	});
	if (canUseLocalStorage()) {
		localStorage.setItem(
			DARK_MODE_SPOTLIGHT_STORAGE_KEY,
			JSON.stringify(settings),
		);
	}
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent(DARK_MODE_SPOTLIGHT_CHANGE_EVENT, {
				detail: settings,
			}),
		);
	}
	return settings;
}

export function resetDarkModeSpotlightSettings() {
	if (canUseLocalStorage()) {
		localStorage.removeItem(DARK_MODE_SPOTLIGHT_STORAGE_KEY);
	}
	if (typeof window !== "undefined") {
		window.dispatchEvent(
			new CustomEvent(DARK_MODE_SPOTLIGHT_CHANGE_EVENT, {
				detail: { ...DEFAULT_DARK_MODE_SPOTLIGHT },
			}),
		);
	}
	return { ...DEFAULT_DARK_MODE_SPOTLIGHT };
}
