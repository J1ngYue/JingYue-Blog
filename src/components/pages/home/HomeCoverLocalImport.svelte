<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import { WALLPAPER_FULLSCREEN } from "@/constants/constants";
import {
	activateLocalWallpaperHistory,
	getLocalWallpaper,
	getLocalWallpaperHistory,
	LOCAL_WALLPAPER_CHANGE_EVENT,
	type LocalWallpaperChangeDetail,
	type LocalWallpaperHistoryRecord,
	type LocalWallpaperType,
	removeLocalWallpaper,
	removeLocalWallpaperHistory,
	saveLocalWallpaper,
} from "@/utils/local-wallpaper";
import { setWallpaperMode } from "@/utils/setting-utils";

const BUILT_IN_COVER_EVENT = "jingyue:select-built-in-cover";
const BUILT_IN_COVER_USED_EVENT = "jingyue:built-in-cover-used";
const BUILT_IN_COVER_HISTORY_SELECT_EVENT =
	"jingyue:select-built-in-cover-history";
const LOCAL_COVER_STATE_EVENT = "jingyue:local-cover-state-change";
const FAVORITE_ASSIGN_EVENT = "jingyue:assign-local-cover-favorite";
const FAVORITE_SELECT_EVENT = "jingyue:select-local-cover-history";
const FAVORITES_SYNC_EVENT = "jingyue:local-cover-favorites-sync";
const FAVORITES_REQUEST_EVENT = "jingyue:request-local-cover-favorites-sync";
const FAVORITES_KEY = "fireflyLocalCoverFavorites";
const HISTORY_DRAG_TYPE = "application/x-firefly-local-cover";
const BUILT_IN_HISTORY_KEY = "fireflyBuiltInCoverHistory";
const VIDEO_PATTERN = /\.(m4v|mov|mp4|ogv|webm)$/i;
let { compact = false }: { compact?: boolean } = $props();

type LocalRecentItem = LocalWallpaperHistoryRecord & {
	source: "local";
	previewUrl: string;
};

interface BuiltInRecentItem {
	id: string;
	source: "built-in";
	index: number;
	name: string;
	type: "image";
	previewUrl: string;
	createdAt: number;
}

type RecentItem = LocalRecentItem | BuiltInRecentItem;

let mediaInput: HTMLInputElement;
let fileName = $state("");
let fileType = $state<LocalWallpaperType | null>(null);
let busy = $state(false);
let message = $state("");
let error = $state("");
let dragging = $state(false);
let history = $state<RecentItem[]>([]);
let deleteCandidate = $state<string | null>(null);
const previewUrls = new Set<string>();

function publishLocalCoverState(active: boolean) {
	window.dispatchEvent(
		new CustomEvent(LOCAL_COVER_STATE_EVENT, { detail: { active } }),
	);
}

function isVideoFile(file: File) {
	return file.type.startsWith("video/") || VIDEO_PATTERN.test(file.name);
}

async function syncCurrentFile() {
	try {
		const record = await getLocalWallpaper();
		fileName = record?.name ?? "";
		fileType = record?.type ?? null;
		publishLocalCoverState(Boolean(record));
	} catch {
		error = "无法读取已保存的本地背景。";
	}
}

function openMediaPicker() {
	mediaInput?.click();
}

async function validateVideo(file: File) {
	const source = URL.createObjectURL(file);
	try {
		await new Promise<void>((resolve, reject) => {
			const video = document.createElement("video");
			const timer = window.setTimeout(() => {
				video.removeAttribute("src");
				reject(new Error("视频解析超时，请确认文件未损坏且浏览器支持该编码。"));
			}, 12000);
			const finish = (callback: () => void) => {
				window.clearTimeout(timer);
				video.removeAttribute("src");
				video.load();
				callback();
			};
			video.preload = "metadata";
			video.muted = true;
			video.onloadedmetadata = () => {
				if (!Number.isFinite(video.duration) || video.videoWidth < 1) {
					finish(() =>
						reject(new Error("没有从该文件中识别到可播放的视频画面。")),
					);
					return;
				}
				finish(resolve);
			};
			video.onerror = () =>
				finish(() =>
					reject(
						new Error(
							"这个视频的编码暂不受浏览器支持，建议使用 H.264 编码的 MP4 或 WebM。",
						),
					),
				);
			video.src = source;
		});
	} finally {
		URL.revokeObjectURL(source);
	}
}

async function applyLocalFile(file: File, successMessage: string) {
	if (isVideoFile(file)) await validateVideo(file);
	const record = await saveLocalWallpaper(file);
	fileName = record.name;
	fileType = record.type;
	publishLocalCoverState(true);
	setWallpaperMode(WALLPAPER_FULLSCREEN);
	message = successMessage;
}

async function runImport(file: File, successMessage: string) {
	busy = true;
	error = "";
	message = "";
	try {
		await applyLocalFile(file, successMessage);
	} catch (reason) {
		error = reason instanceof Error ? reason.message : "无法保存这个背景文件。";
	} finally {
		busy = false;
	}
}

async function handleMediaChange(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	input.value = "";
	if (!file) return;
	await runImport(file, "已应用到首页封面和站点背景。");
}

function readFavoriteMap(): Record<string, string> {
	try {
		return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "{}") ?? {};
	} catch {
		return {};
	}
}

function publishFavoritePreviews() {
	const favorites = readFavoriteMap();
	const items = Object.entries(favorites).flatMap(([index, id]) => {
		const item = history.find((entry) => entry.id === id);
		return item ? [{ index: Number(index), ...item }] : [];
	});
	window.dispatchEvent(
		new CustomEvent(FAVORITES_SYNC_EVENT, { detail: { items } }),
	);
}

async function refreshHistory() {
	previewUrls.forEach((url) => {
		URL.revokeObjectURL(url);
	});
	previewUrls.clear();
	const records = await getLocalWallpaperHistory();
	const localItems: LocalRecentItem[] = records.map((record) => {
		const previewUrl = URL.createObjectURL(record.blob);
		previewUrls.add(previewUrl);
		return { ...record, source: "local", previewUrl };
	});
	history = [...localItems, ...readBuiltInHistory()]
		.sort((left, right) => right.createdAt - left.createdAt)
		.slice(0, 12);
	publishFavoritePreviews();
}

function readBuiltInHistory(): BuiltInRecentItem[] {
	try {
		const stored = JSON.parse(
			localStorage.getItem(BUILT_IN_HISTORY_KEY) || "[]",
		);
		if (!Array.isArray(stored)) return [];
		return stored.filter(
			(item): item is BuiltInRecentItem =>
				item?.source === "built-in" &&
				Number.isInteger(item.index) &&
				typeof item.previewUrl === "string" &&
				Number.isFinite(item.createdAt),
		);
	} catch {
		return [];
	}
}

function rememberBuiltInCover(detail: {
	index?: number;
	name?: string;
	previewUrl?: string;
}) {
	if (!Number.isInteger(detail.index) || !detail.previewUrl) return;
	const item: BuiltInRecentItem = {
		id: `built-in:${detail.index}`,
		source: "built-in",
		index: Number(detail.index),
		name:
			detail.name ||
			`常用封面 ${String(Number(detail.index) + 1).padStart(2, "0")}`,
		type: "image",
		previewUrl: detail.previewUrl,
		createdAt: Date.now(),
	};
	const next = [
		item,
		...readBuiltInHistory().filter((entry) => entry.id !== item.id),
	].slice(0, 12);
	localStorage.setItem(BUILT_IN_HISTORY_KEY, JSON.stringify(next));
	void refreshHistory();
}

async function activateHistory(id: string) {
	if (busy) return;
	busy = true;
	error = "";
	message = "";
	try {
		const record = await activateLocalWallpaperHistory(id);
		fileName = record.name;
		fileType = record.type;
		publishLocalCoverState(true);
		setWallpaperMode(WALLPAPER_FULLSCREEN);
		message = `已重新应用 ${record.name}。`;
	} catch (reason) {
		error = reason instanceof Error ? reason.message : "无法应用这条历史媒体。";
	} finally {
		busy = false;
	}
}

function handleHistoryDragStart(event: DragEvent, item: RecentItem) {
	if (item.source !== "local") {
		event.preventDefault();
		return;
	}
	if (!event.dataTransfer) return;
	event.dataTransfer.effectAllowed = "copy";
	event.dataTransfer.setData(HISTORY_DRAG_TYPE, item.id);
	event.dataTransfer.setData("text/plain", item.name);
}

function activateRecent(item: RecentItem) {
	deleteCandidate = null;
	if (item.source === "local") {
		void activateHistory(item.id);
		return;
	}
	window.dispatchEvent(
		new CustomEvent(BUILT_IN_COVER_HISTORY_SELECT_EVENT, {
			detail: { index: item.index },
		}),
	);
}

async function deleteRecent(item: RecentItem) {
	if (busy) return;
	busy = true;
	error = "";
	message = "";
	try {
		if (item.source === "local") {
			await removeLocalWallpaperHistory(item.id);
			const favorites = readFavoriteMap();
			for (const [index, id] of Object.entries(favorites)) {
				if (id === item.id) delete favorites[index];
			}
			localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
		} else {
			const next = readBuiltInHistory().filter((entry) => entry.id !== item.id);
			localStorage.setItem(BUILT_IN_HISTORY_KEY, JSON.stringify(next));
		}
		deleteCandidate = null;
		message = `已从最近使用中删除 ${item.name}。`;
		await refreshHistory();
	} catch (reason) {
		error =
			reason instanceof Error ? reason.message : "无法删除这条最近使用记录。";
	} finally {
		busy = false;
	}
}

function handleFavoriteAssign(event: Event) {
	const detail = (event as CustomEvent<{ index?: number; id?: string }>).detail;
	if (
		!Number.isInteger(detail?.index) ||
		!history.some((item) => item.id === detail?.id)
	)
		return;
	const favorites = readFavoriteMap();
	favorites[String(detail.index)] = String(detail.id);
	localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
	message = `已替换常用封面 ${String(Number(detail.index) + 1).padStart(2, "0")}。`;
	publishFavoritePreviews();
}

function handleFavoriteSelect(event: Event) {
	const id = (event as CustomEvent<{ id?: string }>).detail?.id;
	if (id) void activateHistory(id);
}

async function handleDrop(event: DragEvent) {
	event.preventDefault();
	dragging = false;
	const file = event.dataTransfer?.files?.[0];
	if (!file) return;
	await runImport(file, "已从拖放文件应用新的背景。");
}

async function clearLocalFile(showMessage = true) {
	if (!fileName || busy) return;
	busy = true;
	error = "";
	message = "";
	try {
		await removeLocalWallpaper();
		fileName = "";
		fileType = null;
		publishLocalCoverState(false);
		if (showMessage) message = "已恢复内置封面。";
	} catch (reason) {
		error = reason instanceof Error ? reason.message : "无法移除本地背景。";
	} finally {
		busy = false;
	}
}

onMount(() => {
	void syncCurrentFile();
	void refreshHistory();

	const handleWallpaperChange = (event: Event) => {
		const detail = (event as CustomEvent<LocalWallpaperChangeDetail>).detail;
		if (detail?.kind === "media") {
			void syncCurrentFile();
			void refreshHistory();
		}
	};
	const handleBuiltInCover = () => void clearLocalFile(false);
	const handleBuiltInCoverUsed = (event: Event) => {
		rememberBuiltInCover(
			(
				event as CustomEvent<{
					index?: number;
					name?: string;
					previewUrl?: string;
				}>
			).detail || {},
		);
	};

	window.addEventListener(LOCAL_WALLPAPER_CHANGE_EVENT, handleWallpaperChange);
	window.addEventListener(BUILT_IN_COVER_EVENT, handleBuiltInCover);
	window.addEventListener(BUILT_IN_COVER_USED_EVENT, handleBuiltInCoverUsed);
	window.addEventListener(FAVORITE_ASSIGN_EVENT, handleFavoriteAssign);
	window.addEventListener(FAVORITE_SELECT_EVENT, handleFavoriteSelect);
	window.addEventListener(FAVORITES_REQUEST_EVENT, publishFavoritePreviews);
	return () => {
		window.removeEventListener(
			LOCAL_WALLPAPER_CHANGE_EVENT,
			handleWallpaperChange,
		);
		window.removeEventListener(BUILT_IN_COVER_EVENT, handleBuiltInCover);
		window.removeEventListener(
			BUILT_IN_COVER_USED_EVENT,
			handleBuiltInCoverUsed,
		);
		window.removeEventListener(FAVORITE_ASSIGN_EVENT, handleFavoriteAssign);
		window.removeEventListener(FAVORITE_SELECT_EVENT, handleFavoriteSelect);
		window.removeEventListener(
			FAVORITES_REQUEST_EVENT,
			publishFavoritePreviews,
		);
		previewUrls.forEach((url) => {
			URL.revokeObjectURL(url);
		});
		previewUrls.clear();
	};
});
</script>

<section
	class:compact
	class:is-dragging={dragging}
	class="local-cover-import"
	aria-labelledby="local-cover-import-title"
	ondragenter={(event) => {
		event.preventDefault();
		dragging = true;
	}}
	ondragover={(event) => event.preventDefault()}
	ondragleave={(event) => {
		if (event.currentTarget === event.target) dragging = false;
	}}
	ondrop={handleDrop}
>
	<header class="local-cover-header">
		<div class="local-cover-copy">
			<strong id="local-cover-import-title">
				{fileName ? "正在使用本地背景" : "导入本地媒体或动态壁纸"}
			</strong>
			<p title={fileName}>
				{fileName || "选择图片或视频，导入后会自动保存到历史记录"}
			</p>
		</div>
		{#if fileType}
			<span class="local-cover-format">{fileType === "video" ? "VIDEO" : "IMAGE"}</span>
		{/if}
	</header>

	<div class="local-cover-actions">
		<button type="button" class="local-cover-pick" disabled={busy} onclick={openMediaPicker}>
			<span class="local-cover-action-icon" aria-hidden="true">
				<Icon icon="material-symbols:upload-file-rounded" />
			</span>
			<span class="local-cover-action-copy">
				<strong>{busy ? "正在解析" : fileName ? "替换媒体文件" : "选择媒体文件"}</strong>
				<small>图片、视频文件</small>
			</span>
		</button>
	</div>

	<div class="local-cover-feedback" aria-live="polite">
		{#if busy}
			<Icon icon="svg-spinners:ring-resize" />
			<span>正在识别媒体并检查浏览器兼容性…</span>
		{:else if message}
			<Icon icon="material-symbols:check-circle-rounded" />
			<span class="is-success">{message}</span>
		{:else if error}
			<Icon icon="material-symbols:error-rounded" />
			<span class="is-error">{error}</span>
		{:else}
			<Icon icon="material-symbols:drag-pan-rounded" />
			<span>也可以把图片或视频直接拖到这里</span>
		{/if}
	</div>

	{#if history.length > 0}
		<section class="local-cover-history" aria-labelledby="local-cover-history-title">
			<header>
				<strong id="local-cover-history-title">最近使用</strong>
				<span>拖到右侧常用封面即可替换</span>
			</header>
			<div class="local-cover-history-list">
				{#each history as item (item.id)}
					<div
						class="local-cover-history-item"
						class:is-confirming={deleteCandidate === item.id}
						draggable={item.source === "local"}
						ondragstart={(event) => handleHistoryDragStart(event, item)}
					>
						<button
							type="button"
							class="local-cover-history-apply"
							title={`点击应用${item.source === "local" ? "，或拖到常用封面" : ""}：${item.name}`}
							onclick={() => activateRecent(item)}
						>
							<span class="local-cover-history-preview" aria-hidden="true">
								{#if item.type === "video"}
									<video src={item.previewUrl} muted playsinline preload="metadata"></video>
									<Icon icon="material-symbols:play-circle-rounded" />
								{:else}
									<img src={item.previewUrl} alt="" loading="lazy" />
								{/if}
							</span>
							<span>{item.name}</span>
						</button>
						<button
							type="button"
							class="local-cover-history-delete"
							aria-label={`从最近使用中删除 ${item.name}`}
							title="删除记录"
							onclick={() => (deleteCandidate = item.id)}
						>
							<Icon icon="material-symbols:close-rounded" />
						</button>
						{#if deleteCandidate === item.id}
							<div class="local-cover-history-confirm" role="alert">
								<strong>删除这条记录？</strong>
								<div>
									<button type="button" onclick={() => (deleteCandidate = null)}>取消</button>
									<button type="button" class="is-danger" onclick={() => deleteRecent(item)}>
										确定删除
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<input
		bind:this={mediaInput}
		hidden
		type="file"
		accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.m4v,.mov,.ogv"
		disabled={busy}
		onchange={handleMediaChange}
	/>
	{#if fileName}
		<button
			type="button"
			class="local-cover-remove"
			aria-label="删除本地背景并恢复内置封面"
			title="恢复内置封面"
			disabled={busy}
			onclick={() => clearLocalFile()}
		>
			<Icon icon="material-symbols:delete-outline-rounded" />
			<span>恢复内置封面</span>
		</button>
	{/if}
</section>

<style>
	.local-cover-import {
		position: relative;
		display: grid;
		gap: 0.9rem;
		border: 1px solid color-mix(in oklch, var(--primary) 32%, rgba(255, 255, 255, 0.16));
		border-radius: 1rem;
		background:
			radial-gradient(circle at 0 0, color-mix(in oklch, var(--primary) 20%, transparent), transparent 48%),
			rgba(18, 26, 42, 0.76);
		box-shadow: 0 0.9rem 2.4rem rgba(3, 8, 20, 0.26);
		padding: 1rem;
		color: white;
		backdrop-filter: blur(0.9rem);
		transition: border-color 180ms ease, background-color 180ms ease;
	}

	.local-cover-import.is-dragging {
		border-color: var(--primary);
		background-color: color-mix(in oklch, var(--primary) 20%, rgba(18, 26, 42, 0.88));
	}

	.local-cover-header {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.8rem;
	}

	.local-cover-actions :global(svg),
	.local-cover-feedback :global(svg),
	.local-cover-remove :global(svg) {
		width: 1.05rem;
		height: 1.05rem;
		flex: 0 0 auto;
	}

	.local-cover-copy {
		min-width: 0;
	}

	.local-cover-copy strong,
	.local-cover-copy p {
		display: block;
		margin: 0;
	}

	.local-cover-copy strong {
		font-size: 0.92rem;
		font-weight: 800;
		line-height: 1.25;
	}

	.local-cover-copy p {
		margin-top: 0.18rem;
		color: rgba(226, 232, 240, 0.68);
		font-size: 0.72rem;
		line-height: 1.45;
		white-space: normal;
	}

	.local-cover-format {
		border: 1px solid color-mix(in oklch, var(--primary) 38%, transparent);
		border-radius: 999px;
		background: color-mix(in oklch, var(--primary) 16%, transparent);
		padding: 0.22rem 0.42rem;
		color: color-mix(in oklch, var(--primary) 70%, white);
		font-size: 0.5rem;
		font-weight: 850;
		letter-spacing: 0.08em;
	}

	.local-cover-actions {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0.65rem;
	}

	.local-cover-actions button {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.6rem;
		min-width: 0;
		height: 3.75rem;
		border: 1px solid color-mix(in oklch, var(--primary) 28%, rgba(255, 255, 255, 0.12));
		border-radius: 0.85rem;
		background: rgba(255, 255, 255, 0.075);
		padding: 0.55rem 0.7rem;
		color: white;
		cursor: pointer;
		transition: background-color 180ms ease, border-color 180ms ease, transform 180ms ease;
	}

	.local-cover-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.32rem;
		min-width: 0;
		height: 2.25rem;
		border: 1px solid color-mix(in oklch, var(--primary) 28%, rgba(255, 255, 255, 0.12));
		border-radius: 0.65rem;
		background: rgba(255, 255, 255, 0.075);
		padding-inline: 0.48rem;
		color: white;
		font-size: 0.68rem;
		font-weight: 780;
		cursor: pointer;
		transition: background-color 180ms ease, border-color 180ms ease;
	}

	.local-cover-actions button:hover,
	.local-cover-actions button:focus-visible,
	.local-cover-remove:hover,
	.local-cover-remove:focus-visible {
		border-color: color-mix(in oklch, var(--primary) 72%, white);
		background: color-mix(in oklch, var(--primary) 22%, rgba(255, 255, 255, 0.08));
		outline: 2px solid color-mix(in oklch, var(--primary) 48%, transparent);
		outline-offset: 2px;
	}

	.local-cover-actions button:hover {
		transform: translateY(-1px);
	}

	.local-cover-actions button:disabled,
	.local-cover-remove:disabled {
		cursor: wait;
		opacity: 0.58;
	}

	.local-cover-pick {
		background: color-mix(in oklch, var(--primary) 38%, rgba(15, 23, 42, 0.74)) !important;
	}

	.local-cover-action-icon {
		display: grid;
		flex: 0 0 auto;
		place-items: center;
		width: 2.2rem;
		height: 2.2rem;
		border: 1px solid color-mix(in oklch, var(--primary) 42%, rgba(255, 255, 255, 0.16));
		border-radius: 0.68rem;
		background: color-mix(in oklch, var(--primary) 24%, rgba(255, 255, 255, 0.1));
		color: color-mix(in oklch, var(--primary) 82%, white);
	}

	.local-cover-action-icon :global(svg) {
		width: 1.3rem;
		height: 1.3rem;
	}

	.local-cover-action-copy {
		display: grid;
		min-width: 0;
		gap: 0.2rem;
		text-align: left;
	}

	.local-cover-action-copy strong,
	.local-cover-action-copy small {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.local-cover-action-copy strong {
		font-size: 0.75rem;
		font-weight: 820;
	}

	.local-cover-action-copy small {
		color: rgba(226, 232, 240, 0.62);
		font-size: 0.6rem;
		font-weight: 650;
	}

	.local-cover-history {
		display: grid;
		min-width: 0;
		gap: 0.52rem;
		border-top: 1px solid rgba(226, 232, 240, 0.12);
		padding-top: 0.72rem;
	}

	.local-cover-history > header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.local-cover-history > header strong {
		font-size: 0.72rem;
		font-weight: 820;
	}

	.local-cover-history > header span {
		color: rgba(226, 232, 240, 0.56);
		font-size: 0.58rem;
	}

	.local-cover-history-list {
		display: grid;
		grid-auto-columns: 7.25rem;
		grid-auto-flow: column;
		gap: 0.48rem;
		overflow-x: auto;
		overscroll-behavior-inline: contain;
		padding: 0.08rem 0.08rem 0.35rem;
		scroll-snap-type: inline proximity;
		scrollbar-color: color-mix(in oklch, var(--primary) 48%, transparent) transparent;
		scrollbar-width: thin;
	}

	.local-cover-history-item {
		position: relative;
		display: block;
		min-width: 0;
		overflow: hidden;
		border: 1px solid rgba(226, 232, 240, 0.12);
		border-radius: 0.82rem;
		background: rgba(255, 255, 255, 0.065);
		padding: 0;
		color: rgba(241, 245, 249, 0.78);
		scroll-snap-align: start;
		text-align: left;
		transition: border-color 160ms ease, background-color 160ms ease;
	}

	.local-cover-history-item[draggable="true"] {
		cursor: grab;
	}

	.local-cover-history-item[draggable="true"]:active {
		cursor: grabbing;
	}

	.local-cover-history-item:hover,
	.local-cover-history-item:focus-visible {
		border-color: color-mix(in oklch, var(--primary) 66%, white);
		background: color-mix(in oklch, var(--primary) 18%, rgba(255, 255, 255, 0.08));
		outline: none;
	}

	.local-cover-history-apply {
		display: grid;
		width: 100%;
		min-width: 0;
		gap: 0.38rem;
		border: 0;
		background: transparent;
		padding: 0.38rem;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}

	.local-cover-history-apply:focus-visible {
		outline: 2px solid color-mix(in oklch, var(--primary) 68%, white);
		outline-offset: -2px;
	}

	.local-cover-history-preview {
		position: relative;
		display: grid;
		place-items: center;
		overflow: hidden;
		width: 100%;
		aspect-ratio: 16 / 10;
		border-radius: 0.48rem;
		background: rgba(15, 23, 42, 0.5);
	}

	.local-cover-history-preview img,
	.local-cover-history-preview video {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.local-cover-history-preview :global(svg) {
		position: absolute;
		width: 1.2rem;
		height: 1.2rem;
		color: white;
		filter: drop-shadow(0 0.12rem 0.35rem rgba(0, 0, 0, 0.45));
	}

	.local-cover-history-apply > span:last-child {
		overflow: hidden;
		padding-inline: 0.08rem;
		font-size: 0.62rem;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.local-cover-history-delete {
		position: absolute;
		right: 0.56rem;
		top: 0.56rem;
		display: grid;
		place-items: center;
		width: 1.55rem;
		height: 1.55rem;
		border: 1px solid rgba(255, 255, 255, 0.48);
		border-radius: 999px;
		background: rgba(15, 23, 42, 0.68);
		color: white;
		cursor: pointer;
		opacity: 0;
		transform: translateY(-0.2rem);
		transition: opacity 150ms ease, transform 150ms ease, background-color 150ms ease;
	}

	.local-cover-history-delete :global(svg) {
		width: 0.92rem;
		height: 0.92rem;
	}

	.local-cover-history-item:hover .local-cover-history-delete,
	.local-cover-history-delete:focus-visible,
	.local-cover-history-item.is-confirming .local-cover-history-delete {
		opacity: 1;
		transform: translateY(0);
	}

	.local-cover-history-delete:hover,
	.local-cover-history-delete:focus-visible {
		background: #b83e53;
		outline: 2px solid rgba(255, 255, 255, 0.72);
		outline-offset: 1px;
	}

	.local-cover-history-confirm {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		gap: 0.55rem;
		background: rgba(250, 252, 251, 0.96);
		padding: 0.55rem;
		color: #293a36;
		text-align: center;
		backdrop-filter: blur(0.55rem);
	}

	.local-cover-history-confirm > strong {
		font-size: 0.66rem;
	}

	.local-cover-history-confirm > div {
		display: flex;
		gap: 0.35rem;
	}

	.local-cover-history-confirm button {
		min-height: 1.75rem;
		border: 1px solid rgba(42, 76, 67, 0.18);
		border-radius: 0.48rem;
		background: white;
		padding-inline: 0.48rem;
		color: #47645c;
		font-size: 0.56rem;
		font-weight: 760;
		cursor: pointer;
	}

	.local-cover-history-confirm button.is-danger {
		border-color: rgba(184, 62, 83, 0.3);
		background: #b83e53;
		color: white;
	}

	.local-cover-feedback {
		display: flex;
		min-height: 1rem;
		align-items: flex-start;
		gap: 0.35rem;
		color: rgba(226, 232, 240, 0.58);
		font-size: 0.65rem;
		line-height: 1.45;
	}

	.local-cover-feedback :global(svg) {
		margin-top: 0.02rem;
		color: color-mix(in oklch, var(--primary) 72%, white);
	}

	.local-cover-feedback .is-success {
		color: #bbf7d0;
	}

	.local-cover-feedback .is-error {
		color: #fecaca;
	}

	.local-cover-remove {
		width: 100%;
		background: transparent;
		color: rgba(226, 232, 240, 0.7);
	}

	:global(html:not(.dark)) .local-cover-import {
		border-color: color-mix(in oklch, var(--primary) 25%, #cadbd5);
		background:
			radial-gradient(circle at 0 0, color-mix(in oklch, var(--primary) 13%, transparent), transparent 48%),
			rgba(249, 252, 251, 0.9);
		box-shadow: 0 0.9rem 2.4rem rgba(48, 85, 75, 0.1);
		color: #203c35;
	}

	:global(html:not(.dark)) .local-cover-import.is-dragging {
		background-color: color-mix(in oklch, var(--primary) 12%, white);
	}

	:global(html:not(.dark)) .local-cover-copy p,
	:global(html:not(.dark)) .local-cover-action-copy small,
	:global(html:not(.dark)) .local-cover-history > header span,
	:global(html:not(.dark)) .local-cover-feedback {
		color: #6e847e;
	}

	:global(html:not(.dark)) .local-cover-actions button,
	:global(html:not(.dark)) .local-cover-remove,
	:global(html:not(.dark)) .local-cover-history-item {
		border-color: rgba(66, 115, 101, 0.16);
		background: rgba(255, 255, 255, 0.82);
		color: #29483f;
	}

	:global(html:not(.dark)) .local-cover-pick {
		background: color-mix(in oklch, var(--primary) 14%, white) !important;
	}

	:global(html:not(.dark)) .local-cover-action-icon {
		background: color-mix(in oklch, var(--primary) 13%, white);
		color: color-mix(in oklch, var(--primary) 78%, #285c4e);
	}

	:global(html:not(.dark)) .local-cover-history {
		border-top-color: rgba(66, 115, 101, 0.14);
	}

	:global(html:not(.dark)) .local-cover-history-preview {
		background: #e6efec;
	}

	:global(html:not(.dark)) .local-cover-feedback .is-success {
		color: #28785f;
	}

	:global(html:not(.dark)) .local-cover-feedback .is-error {
		color: #b83e53;
	}

	@media (max-width: 640px) {
		.local-cover-actions {
			grid-template-columns: minmax(0, 1fr);
		}

		.local-cover-actions button {
			height: 3.35rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.local-cover-import,
		.local-cover-actions button,
		.local-cover-remove {
			transition: none;
		}
	}
</style>
