import { DEFAULT_PAGE_WALLPAPER_ID } from "@/config/pageWallpapers";

export const PAGE_WALLPAPER_CHANGE_EVENT = "firefly:page-wallpaper-change";
export const OPEN_WALLPAPER_PICKER_EVENT = "firefly:open-wallpaper-picker";

export const PAGE_WALLPAPER_PREFERENCES_KEY = "fireflyPageWallpapersV1";
export const PAGE_WALLPAPER_DEFAULT_KEY = "fireflyDefaultWallpaperV1";
export const PAGE_WALLPAPER_MOBILE_PREFERENCES_KEY =
	"fireflyMobilePageWallpapersV1";
export const PAGE_WALLPAPER_MOBILE_DEFAULT_KEY =
	"fireflyMobileDefaultWallpaperV1";
export const PAGE_WALLPAPER_SYNC_TARGETS_KEY =
	"fireflyPageWallpaperSyncTargetsV1";

export const SYSTEM_DEFAULT_WALLPAPER = DEFAULT_PAGE_WALLPAPER_ID;

export const PAGE_WALLPAPER_PAGES = [
	{ key: "home", label: "主页", paths: ["/"] },
	{
		key: "articles",
		label: "文章",
		paths: ["/archive", "/categories", "/tags", "/posts", "/search"],
	},
	{ key: "updates", label: "动态", paths: ["/dynamic"] },
	{
		key: "social",
		label: "社交",
		paths: ["/social", "/friends", "/guestbook"],
	},
	{
		key: "profile",
		label: "我的",
		paths: ["/mine", "/gallery", "/anime", "/bangumi"],
	},
	{ key: "about", label: "关于", paths: ["/about", "/sponsor"] },
	{ key: "links", label: "链接", paths: ["/links"] },
] as const;

export type PageWallpaperKey = (typeof PAGE_WALLPAPER_PAGES)[number]["key"];
export type PageWallpaperChoice = `wallpaper-${number}` | `local:${string}`;

export type PageWallpaperPreferences = Partial<
	Record<PageWallpaperKey, PageWallpaperChoice>
>;
export type WallpaperPreferenceDevice = "desktop" | "mobile";

// 管理员可在这里为七个主页面指定不同默认壁纸；未配置的页面回退到系统默认。
export const ADMIN_PAGE_WALLPAPERS: PageWallpaperPreferences = {
	home: "wallpaper-1",
	articles: "wallpaper-1",
	updates: "wallpaper-1",
	social: "wallpaper-1",
	profile: "wallpaper-1",
	about: "wallpaper-1",
	links: "wallpaper-1",
};

function canUseLocalStorage() {
	return (
		typeof localStorage !== "undefined" &&
		typeof localStorage.getItem === "function"
	);
}

export function getWallpaperPreferenceDevice(): WallpaperPreferenceDevice {
	return typeof window !== "undefined" &&
		window.matchMedia("(max-width: 640px)").matches
		? "mobile"
		: "desktop";
}

function getPreferenceStorageKey(device: WallpaperPreferenceDevice) {
	return device === "mobile"
		? PAGE_WALLPAPER_MOBILE_PREFERENCES_KEY
		: PAGE_WALLPAPER_PREFERENCES_KEY;
}

function getDefaultStorageKey(device: WallpaperPreferenceDevice) {
	return device === "mobile"
		? PAGE_WALLPAPER_MOBILE_DEFAULT_KEY
		: PAGE_WALLPAPER_DEFAULT_KEY;
}

function isPageKey(value: unknown): value is PageWallpaperKey {
	return PAGE_WALLPAPER_PAGES.some((page) => page.key === value);
}

export function isPageWallpaperChoice(
	value: unknown,
): value is PageWallpaperChoice {
	return (
		typeof value === "string" &&
		(/^wallpaper-\d+$/.test(value) || value.startsWith("local:history:"))
	);
}

export function resolvePageWallpaperKey(
	pathname = typeof window !== "undefined" ? window.location.pathname : "/",
): PageWallpaperKey {
	const normalized =
		`/${pathname}`.replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
	for (const page of PAGE_WALLPAPER_PAGES) {
		if (
			page.paths.some(
				(path) => normalized === path || normalized.startsWith(`${path}/`),
			)
		) {
			return page.key;
		}
	}
	return "home";
}

export function getPageWallpaperLabel(key: PageWallpaperKey) {
	return PAGE_WALLPAPER_PAGES.find((page) => page.key === key)?.label ?? "主页";
}

export function getUserPageWallpapers(
	device = getWallpaperPreferenceDevice(),
): PageWallpaperPreferences {
	if (!canUseLocalStorage()) return {};
	try {
		const value = JSON.parse(
			localStorage.getItem(getPreferenceStorageKey(device)) || "{}",
		);
		if (!value || typeof value !== "object" || Array.isArray(value)) return {};
		return Object.fromEntries(
			Object.entries(value).filter(
				([key, choice]) => isPageKey(key) && isPageWallpaperChoice(choice),
			),
		) as PageWallpaperPreferences;
	} catch {
		return {};
	}
}

export function getUserDefaultPageWallpaper(
	device = getWallpaperPreferenceDevice(),
): PageWallpaperChoice | null {
	if (!canUseLocalStorage()) return null;
	const choice = localStorage.getItem(getDefaultStorageKey(device));
	return isPageWallpaperChoice(choice) ? choice : null;
}

export function getEffectivePageWallpaper(
	pageKey = resolvePageWallpaperKey(),
): PageWallpaperChoice {
	const device = getWallpaperPreferenceDevice();
	const devicePreferences = getUserPageWallpapers(device);
	const desktopPreferences =
		device === "mobile" ? getUserPageWallpapers("desktop") : devicePreferences;
	return (
		devicePreferences[pageKey] ??
		getUserDefaultPageWallpaper(device) ??
		desktopPreferences[pageKey] ??
		getUserDefaultPageWallpaper("desktop") ??
		ADMIN_PAGE_WALLPAPERS[pageKey] ??
		SYSTEM_DEFAULT_WALLPAPER
	);
}

export function setPageWallpapers(
	choice: PageWallpaperChoice,
	pageKeys: readonly PageWallpaperKey[],
	options: { setAsDefault?: boolean } = {},
) {
	if (!canUseLocalStorage() || !isPageWallpaperChoice(choice)) return;
	const device = getWallpaperPreferenceDevice();
	const preferences = getUserPageWallpapers(device);
	for (const key of pageKeys) preferences[key] = choice;
	localStorage.setItem(
		getPreferenceStorageKey(device),
		JSON.stringify(preferences),
	);
	if (options.setAsDefault) {
		localStorage.setItem(getDefaultStorageKey(device), choice);
	}
	window.dispatchEvent(
		new CustomEvent(PAGE_WALLPAPER_CHANGE_EVENT, {
			detail: {
				choice,
				device,
				pageKeys: [...pageKeys],
				setAsDefault: options.setAsDefault === true,
			},
		}),
	);
}

export function resetDefaultPageWallpaper() {
	if (!canUseLocalStorage()) return;
	localStorage.removeItem(getDefaultStorageKey(getWallpaperPreferenceDevice()));
	window.dispatchEvent(
		new CustomEvent(PAGE_WALLPAPER_CHANGE_EVENT, {
			detail: { resetDefault: true },
		}),
	);
}

export function resetPageWallpapers(pageKeys: readonly PageWallpaperKey[]) {
	if (!canUseLocalStorage()) return;
	const device = getWallpaperPreferenceDevice();
	const preferences = getUserPageWallpapers(device);
	for (const key of pageKeys) delete preferences[key];
	localStorage.setItem(
		getPreferenceStorageKey(device),
		JSON.stringify(preferences),
	);
	window.dispatchEvent(
		new CustomEvent(PAGE_WALLPAPER_CHANGE_EVENT, {
			detail: { pageKeys: [...pageKeys], reset: true },
		}),
	);
}

export function removePageWallpaperReferences(choice: PageWallpaperChoice) {
	if (!canUseLocalStorage()) return;
	const affected = new Set<PageWallpaperKey>();
	for (const device of ["desktop", "mobile"] as const) {
		const preferences = getUserPageWallpapers(device);
		for (const page of PAGE_WALLPAPER_PAGES) {
			if (preferences[page.key] !== choice) continue;
			delete preferences[page.key];
			affected.add(page.key);
		}
		localStorage.setItem(
			getPreferenceStorageKey(device),
			JSON.stringify(preferences),
		);
		if (getUserDefaultPageWallpaper(device) === choice) {
			localStorage.removeItem(getDefaultStorageKey(device));
		}
	}
	if (affected.size === 0) return;
	window.dispatchEvent(
		new CustomEvent(PAGE_WALLPAPER_CHANGE_EVENT, {
			detail: { pageKeys: [...affected], reset: true },
		}),
	);
}

export function getLastWallpaperSyncTargets(): PageWallpaperKey[] {
	if (!canUseLocalStorage()) return [];
	try {
		const value = JSON.parse(
			localStorage.getItem(PAGE_WALLPAPER_SYNC_TARGETS_KEY) || "[]",
		);
		return Array.isArray(value) ? value.filter(isPageKey) : [];
	} catch {
		return [];
	}
}

export function setLastWallpaperSyncTargets(
	pageKeys: readonly PageWallpaperKey[],
) {
	if (!canUseLocalStorage()) return;
	localStorage.setItem(
		PAGE_WALLPAPER_SYNC_TARGETS_KEY,
		JSON.stringify(pageKeys.filter(isPageKey)),
	);
}
