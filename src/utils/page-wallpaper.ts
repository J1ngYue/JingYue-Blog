import { DEFAULT_PAGE_WALLPAPER_ID } from "@/config/pageWallpapers";

export const PAGE_WALLPAPER_CHANGE_EVENT = "firefly:page-wallpaper-change";
export const OPEN_WALLPAPER_PICKER_EVENT = "firefly:open-wallpaper-picker";

export const PAGE_WALLPAPER_PREFERENCES_KEY = "fireflyPageWallpapersV1";
export const PAGE_WALLPAPER_DEFAULT_KEY = "fireflyDefaultWallpaperV1";
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

export function getUserPageWallpapers(): PageWallpaperPreferences {
	if (!canUseLocalStorage()) return {};
	try {
		const value = JSON.parse(
			localStorage.getItem(PAGE_WALLPAPER_PREFERENCES_KEY) || "{}",
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

export function getUserDefaultPageWallpaper(): PageWallpaperChoice | null {
	if (!canUseLocalStorage()) return null;
	const choice = localStorage.getItem(PAGE_WALLPAPER_DEFAULT_KEY);
	return isPageWallpaperChoice(choice) ? choice : null;
}

export function getEffectivePageWallpaper(
	pageKey = resolvePageWallpaperKey(),
): PageWallpaperChoice {
	return (
		getUserPageWallpapers()[pageKey] ??
		getUserDefaultPageWallpaper() ??
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
	const preferences = getUserPageWallpapers();
	for (const key of pageKeys) preferences[key] = choice;
	localStorage.setItem(
		PAGE_WALLPAPER_PREFERENCES_KEY,
		JSON.stringify(preferences),
	);
	if (options.setAsDefault) {
		localStorage.setItem(PAGE_WALLPAPER_DEFAULT_KEY, choice);
	}
	window.dispatchEvent(
		new CustomEvent(PAGE_WALLPAPER_CHANGE_EVENT, {
			detail: {
				choice,
				pageKeys: [...pageKeys],
				setAsDefault: options.setAsDefault === true,
			},
		}),
	);
}

export function resetDefaultPageWallpaper() {
	if (!canUseLocalStorage()) return;
	localStorage.removeItem(PAGE_WALLPAPER_DEFAULT_KEY);
	window.dispatchEvent(
		new CustomEvent(PAGE_WALLPAPER_CHANGE_EVENT, {
			detail: { resetDefault: true },
		}),
	);
}

export function resetPageWallpapers(pageKeys: readonly PageWallpaperKey[]) {
	if (!canUseLocalStorage()) return;
	const preferences = getUserPageWallpapers();
	for (const key of pageKeys) delete preferences[key];
	localStorage.setItem(
		PAGE_WALLPAPER_PREFERENCES_KEY,
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
	const preferences = getUserPageWallpapers();
	const affected = PAGE_WALLPAPER_PAGES.flatMap((page) => {
		if (preferences[page.key] !== choice) return [];
		delete preferences[page.key];
		return [page.key];
	});
	if (affected.length === 0) return;
	localStorage.setItem(
		PAGE_WALLPAPER_PREFERENCES_KEY,
		JSON.stringify(preferences),
	);
	window.dispatchEvent(
		new CustomEvent(PAGE_WALLPAPER_CHANGE_EVENT, {
			detail: { pageKeys: affected, reset: true },
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
