export const LOCAL_WALLPAPER_CHANGE_EVENT = "firefly:local-wallpaper-change";

export type LocalWallpaperType = "image" | "video";

export interface LocalWallpaperRecord {
	id: "active";
	name: string;
	type: LocalWallpaperType;
	mime: string;
	blob: Blob;
}

export interface LocalWallpaperChangeDetail {
	kind: "media" | "appearance";
}

const DB_NAME = "firefly-local-wallpaper";
const DB_VERSION = 1;
const STORE_NAME = "media";
const ACTIVE_ID = "active";
const OPACITY_KEY = "fireflyLocalWallpaperOpacity";
const BLUR_KEY = "fireflyLocalWallpaperBlur";
const DEFAULT_OPACITY = 0.82;
const DEFAULT_BLUR = 0;

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
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
		request.onerror = () => reject(request.error ?? new Error("无法打开本地背景存储。"));
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
		request.onerror = () => reject(request.error ?? new Error("本地背景操作失败。"));
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

function applyOpacityVariable(value: number) {
	if (typeof document === "undefined") return;
	document.documentElement.style.setProperty("--home-background-opacity", String(value));
}

function applyBlurVariables(value: number) {
	if (typeof document === "undefined") return;
	document.documentElement.style.setProperty("--home-background-blur", `${value}px`);
	document.documentElement.style.setProperty("--home-background-scale", "1");
}

export async function getLocalWallpaper(): Promise<LocalWallpaperRecord | null> {
	const record = await runStoreRequest<LocalWallpaperRecord | undefined>("readonly", (store) =>
		store.get(ACTIVE_ID),
	);
	return record ?? null;
}

export async function saveLocalWallpaper(file: File): Promise<LocalWallpaperRecord> {
	const imageExtension = /\.(avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file.name);
	const videoExtension = /\.(m4v|mov|mp4|ogv|webm)$/i.test(file.name);
	const type: LocalWallpaperType | null = file.type.startsWith("image/") || imageExtension
		? "image"
		: file.type.startsWith("video/") || videoExtension
			? "video"
			: null;
	if (!type) throw new Error("请选择图片或视频文件。");

	const record: LocalWallpaperRecord = {
		id: ACTIVE_ID,
		name: file.name,
		type,
		mime: file.type,
		blob: file,
	};
	await runStoreRequest<IDBValidKey>("readwrite", (store) => store.put(record));
	notify("media");
	return record;
}

export async function removeLocalWallpaper() {
	await runStoreRequest<undefined>("readwrite", (store) => store.delete(ACTIVE_ID));
	notify("media");
}

export function getLocalWallpaperOpacity() {
	if (typeof localStorage === "undefined") return getDefaultLocalWallpaperOpacity();
	const value = Number(localStorage.getItem(OPACITY_KEY));
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
	if (typeof localStorage === "undefined") return getDefaultLocalWallpaperBlur();
	const value = Number(localStorage.getItem(BLUR_KEY));
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
