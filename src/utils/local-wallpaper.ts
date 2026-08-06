export const LOCAL_WALLPAPER_CHANGE_EVENT = "firefly:local-wallpaper-change";
export const LOCAL_WALLPAPER_PRESENCE_KEY = "fireflyHasLocalWallpaper";

export type LocalWallpaperType = "image" | "video";

export interface LocalWallpaperRecord {
	id: string;
	name: string;
	type: LocalWallpaperType;
	mime: string;
	blob: Blob;
	createdAt?: number;
}

export interface LocalWallpaperHistoryRecord extends LocalWallpaperRecord {
	createdAt: number;
}

export interface SavedLocalWallpaperRecord extends LocalWallpaperRecord {
	historyId: string;
}

export interface LocalWallpaperChangeDetail {
	kind: "media" | "appearance";
}

const DB_NAME = "firefly-local-wallpaper";
const DB_VERSION = 1;
const STORE_NAME = "media";
const ACTIVE_ID = "active";
const HISTORY_PREFIX = "history:";
const HISTORY_LIMIT = 12;
const OPACITY_KEY = "fireflyLocalWallpaperOpacity";
const BLUR_KEY = "fireflyLocalWallpaperBlur";
const DEFAULT_OPACITY = 1;
const DEFAULT_BLUR = 0;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function resolveWallpaperFile(file: File) {
	const imageExtension = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(
		file.name,
	);
	const videoExtension = /\.(m4v|mov|mp4|ogv|webm)$/i.test(file.name);
	const type: LocalWallpaperType | null =
		file.type.startsWith("image/") || imageExtension
			? "image"
			: file.type.startsWith("video/") || videoExtension
				? "video"
				: null;
	if (!type) throw new Error("请选择图片或视频文件。");
	const fallbackMime =
		type === "video"
			? /\.webm$/i.test(file.name)
				? "video/webm"
				: /\.ogv$/i.test(file.name)
					? "video/ogg"
					: "video/mp4"
			: /\.png$/i.test(file.name)
				? "image/png"
				: /\.webp$/i.test(file.name)
					? "image/webp"
					: "image/jpeg";
	return { type, mime: file.type || fallbackMime };
}

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (!("indexedDB" in window)) {
			reject(new Error("当前浏览器不支持本地背景存储。"));
			return;
		}

		const request = window.indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const database = request.result;
			if (!database.objectStoreNames.contains(STORE_NAME)) {
				database.createObjectStore(STORE_NAME, { keyPath: "id" });
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("无法打开本地背景存储。"));
	});
}

async function runStoreRequest<T>(
	mode: IDBTransactionMode,
	requestFactory: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	const database = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = database.transaction(STORE_NAME, mode);
		const request = requestFactory(transaction.objectStore(STORE_NAME));
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(request.error ?? new Error("本地背景操作失败。"));
		transaction.oncomplete = () => database.close();
		transaction.onabort = () => {
			database.close();
			reject(transaction.error ?? new Error("本地背景操作已取消。"));
		};
	});
}

function notify(kind: LocalWallpaperChangeDetail["kind"]) {
	if (typeof window === "undefined") return;
	window.dispatchEvent(
		new CustomEvent<LocalWallpaperChangeDetail>(LOCAL_WALLPAPER_CHANGE_EVENT, {
			detail: { kind },
		}),
	);
}

function syncLocalWallpaperPresence(hasWallpaper: boolean) {
	if (typeof window === "undefined") return;
	localStorage.setItem(
		LOCAL_WALLPAPER_PRESENCE_KEY,
		hasWallpaper ? "true" : "false",
	);
	document.documentElement.setAttribute(
		"data-has-local-wallpaper",
		hasWallpaper ? "true" : "false",
	);
}

function applyOpacityVariable(value: number) {
	if (typeof document === "undefined") return;
	document.documentElement.style.setProperty(
		"--home-background-opacity",
		String(value),
	);
}

function applyBlurVariables(value: number) {
	if (typeof document === "undefined") return;
	document.documentElement.style.setProperty(
		"--home-background-blur",
		`${value}px`,
	);
	document.documentElement.style.setProperty("--home-background-scale", "1");
}

export async function getLocalWallpaper(): Promise<LocalWallpaperRecord | null> {
	const record = await runStoreRequest<LocalWallpaperRecord | undefined>(
		"readonly",
		(store) => store.get(ACTIVE_ID),
	);
	syncLocalWallpaperPresence(Boolean(record));
	return record ?? null;
}

export async function saveLocalWallpaper(
	file: File,
): Promise<SavedLocalWallpaperRecord> {
	const { type, mime } = resolveWallpaperFile(file);
	const createdAt = Date.now();
	const record: LocalWallpaperRecord = {
		id: ACTIVE_ID,
		name: file.name,
		type,
		mime,
		blob: file,
		createdAt,
	};
	await runStoreRequest<IDBValidKey>("readwrite", (store) => store.put(record));
	const historyId = `${HISTORY_PREFIX}${createdAt}:${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
	const historyRecord: LocalWallpaperHistoryRecord = {
		...record,
		id: historyId,
		createdAt,
	};
	await runStoreRequest<IDBValidKey>("readwrite", (store) =>
		store.put(historyRecord),
	);
	const history = await getLocalWallpaperHistory();
	for (const stale of history.slice(HISTORY_LIMIT)) {
		await runStoreRequest<undefined>("readwrite", (store) =>
			store.delete(stale.id),
		);
	}
	syncLocalWallpaperPresence(true);
	notify("media");
	return { ...record, historyId };
}

export async function saveLocalWallpaperAsset(
	file: File,
): Promise<LocalWallpaperHistoryRecord> {
	const { type, mime } = resolveWallpaperFile(file);
	const createdAt = Date.now();
	const record: LocalWallpaperHistoryRecord = {
		id: `${HISTORY_PREFIX}${createdAt}:${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
		name: file.name,
		type,
		mime,
		blob: file,
		createdAt,
	};
	await runStoreRequest<IDBValidKey>("readwrite", (store) => store.put(record));
	const history = await getLocalWallpaperHistory();
	for (const stale of history.slice(HISTORY_LIMIT)) {
		await runStoreRequest<undefined>("readwrite", (store) =>
			store.delete(stale.id),
		);
	}
	notify("media");
	return record;
}

export async function getLocalWallpaperById(
	id: string,
): Promise<LocalWallpaperRecord | null> {
	if (!id.startsWith(HISTORY_PREFIX)) return null;
	const record = await runStoreRequest<LocalWallpaperRecord | undefined>(
		"readonly",
		(store) => store.get(id),
	);
	return record ?? null;
}

export async function getLocalWallpaperHistory(): Promise<
	LocalWallpaperHistoryRecord[]
> {
	const records = await runStoreRequest<LocalWallpaperRecord[]>(
		"readonly",
		(store) => store.getAll(),
	);
	return records
		.filter(
			(record): record is LocalWallpaperHistoryRecord =>
				record.id.startsWith(HISTORY_PREFIX) &&
				Number.isFinite(record.createdAt),
		)
		.sort((left, right) => right.createdAt - left.createdAt);
}

export async function activateLocalWallpaperHistory(
	id: string,
): Promise<LocalWallpaperRecord> {
	if (!id.startsWith(HISTORY_PREFIX)) throw new Error("无效的历史媒体记录。");
	const historyRecord = await runStoreRequest<LocalWallpaperRecord | undefined>(
		"readonly",
		(store) => store.get(id),
	);
	if (!historyRecord) throw new Error("这条历史媒体记录已不存在。");
	const activeRecord: LocalWallpaperRecord = {
		...historyRecord,
		id: ACTIVE_ID,
		createdAt: Date.now(),
	};
	await runStoreRequest<IDBValidKey>("readwrite", (store) =>
		store.put(activeRecord),
	);
	await runStoreRequest<IDBValidKey>("readwrite", (store) =>
		store.put({ ...historyRecord, createdAt: activeRecord.createdAt }),
	);
	syncLocalWallpaperPresence(true);
	notify("media");
	return activeRecord;
}

export async function removeLocalWallpaperHistory(id: string) {
	if (!id.startsWith(HISTORY_PREFIX)) throw new Error("无效的历史媒体记录。");
	await runStoreRequest<undefined>("readwrite", (store) => store.delete(id));
	notify("media");
}

export async function removeLocalWallpaper() {
	await runStoreRequest<undefined>("readwrite", (store) =>
		store.delete(ACTIVE_ID),
	);
	syncLocalWallpaperPresence(false);
	notify("media");
}

export function getLocalWallpaperOpacity() {
	if (typeof localStorage === "undefined")
		return getDefaultLocalWallpaperOpacity();
	const stored = localStorage.getItem(OPACITY_KEY);
	if (stored === null) return getDefaultLocalWallpaperOpacity();
	const value = Number(stored);
	return Number.isFinite(value) && value >= 0
		? clamp(value, 0, 1)
		: getDefaultLocalWallpaperOpacity();
}

export function getDefaultLocalWallpaperOpacity() {
	return DEFAULT_OPACITY;
}

export function setLocalWallpaperOpacity(value: number) {
	const safeValue = clamp(value, 0, 1);
	localStorage.setItem(OPACITY_KEY, String(safeValue));
	applyOpacityVariable(safeValue);
	notify("appearance");
}

export function getLocalWallpaperBlur() {
	if (typeof localStorage === "undefined")
		return getDefaultLocalWallpaperBlur();
	const stored = localStorage.getItem(BLUR_KEY);
	if (stored === null) return getDefaultLocalWallpaperBlur();
	const value = Number(stored);
	return Number.isFinite(value)
		? clamp(value, 0, 20)
		: getDefaultLocalWallpaperBlur();
}

export function getDefaultLocalWallpaperBlur() {
	return DEFAULT_BLUR;
}

export function setLocalWallpaperBlur(value: number) {
	const safeValue = clamp(value, 0, 20);
	localStorage.setItem(BLUR_KEY, String(safeValue));
	applyBlurVariables(safeValue);
	notify("appearance");
}
