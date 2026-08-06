export const SITE_PROFILE_COVER_CHANGE_EVENT =
	"firefly:site-profile-cover-change";

export interface SiteProfileCoverRecord {
	id: "active";
	name: string;
	mime: string;
	blob: Blob;
	updatedAt: number;
}

export interface SiteProfileCoverChangeDetail {
	action: "updated" | "reset";
}

const DB_NAME = "firefly-site-profile-cover";
const DB_VERSION = 1;
const STORE_NAME = "cover";
const ACTIVE_ID = "active";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function resolveCoverFile(file: File) {
	const imageExtension = /\.(avif|gif|jpe?g|png|webp)$/i.test(file.name);
	if (!file.type.startsWith("image/") && !imageExtension) {
		throw new Error("请选择 JPG、PNG、WebP、GIF 或 AVIF 图片。");
	}
	if (file.size > MAX_FILE_SIZE) {
		throw new Error("封面图片不能超过 10 MB。");
	}
	return file.type || "image/jpeg";
}

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (!("indexedDB" in window)) {
			reject(new Error("当前浏览器不支持本地封面存储。"));
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
			reject(request.error ?? new Error("无法打开封面存储。"));
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
			reject(request.error ?? new Error("封面操作失败。"));
		transaction.oncomplete = () => database.close();
		transaction.onabort = () => {
			database.close();
			reject(transaction.error ?? new Error("封面操作已取消。"));
		};
	});
}

function notify(action: SiteProfileCoverChangeDetail["action"]) {
	window.dispatchEvent(
		new CustomEvent<SiteProfileCoverChangeDetail>(
			SITE_PROFILE_COVER_CHANGE_EVENT,
			{ detail: { action } },
		),
	);
}

export async function getSiteProfileCover(): Promise<SiteProfileCoverRecord | null> {
	const record = await runStoreRequest<SiteProfileCoverRecord | undefined>(
		"readonly",
		(store) => store.get(ACTIVE_ID),
	);
	return record ?? null;
}

export async function saveSiteProfileCover(
	file: File,
): Promise<SiteProfileCoverRecord> {
	const mime = resolveCoverFile(file);
	const record: SiteProfileCoverRecord = {
		id: ACTIVE_ID,
		name: file.name,
		mime,
		blob: file,
		updatedAt: Date.now(),
	};
	await runStoreRequest<IDBValidKey>("readwrite", (store) => store.put(record));
	notify("updated");
	return record;
}

export async function removeSiteProfileCover(): Promise<void> {
	await runStoreRequest<undefined>("readwrite", (store) =>
		store.delete(ACTIVE_ID),
	);
	notify("reset");
}
