export const SITE_AVATAR_CHANGE_EVENT = "firefly:site-avatar-change";

export interface SiteAvatarRecord {
	id: "active";
	name: string;
	mime: string;
	blob: Blob;
	updatedAt: number;
}

export interface SiteAvatarChangeDetail {
	action: "updated" | "reset";
}

const DB_NAME = "firefly-site-avatar";
const DB_VERSION = 1;
const STORE_NAME = "avatar";
const ACTIVE_ID = "active";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function resolveAvatarFile(file: File) {
	const imageExtension = /\.(avif|gif|jpe?g|png|webp)$/i.test(file.name);
	if (!file.type.startsWith("image/") && !imageExtension) {
		throw new Error("请选择 JPG、PNG、WebP、GIF 或 AVIF 图片。");
	}
	if (file.size > MAX_FILE_SIZE) {
		throw new Error("头像图片不能超过 10 MB。");
	}
	return file.type || "image/jpeg";
}

function openDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (!("indexedDB" in window)) {
			reject(new Error("当前浏览器不支持本地头像存储。"));
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
			reject(request.error ?? new Error("无法打开头像存储。"));
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
			reject(request.error ?? new Error("头像操作失败。"));
		transaction.oncomplete = () => database.close();
		transaction.onabort = () => {
			database.close();
			reject(transaction.error ?? new Error("头像操作已取消。"));
		};
	});
}

function notify(action: SiteAvatarChangeDetail["action"]) {
	window.dispatchEvent(
		new CustomEvent<SiteAvatarChangeDetail>(SITE_AVATAR_CHANGE_EVENT, {
			detail: { action },
		}),
	);
}

export async function getSiteAvatar(): Promise<SiteAvatarRecord | null> {
	const record = await runStoreRequest<SiteAvatarRecord | undefined>(
		"readonly",
		(store) => store.get(ACTIVE_ID),
	);
	return record ?? null;
}

export async function saveSiteAvatar(file: File): Promise<SiteAvatarRecord> {
	const mime = resolveAvatarFile(file);
	const record: SiteAvatarRecord = {
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

export async function removeSiteAvatar(): Promise<void> {
	await runStoreRequest<undefined>("readwrite", (store) =>
		store.delete(ACTIVE_ID),
	);
	notify("reset");
}
