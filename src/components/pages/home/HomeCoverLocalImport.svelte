<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import { WALLPAPER_FULLSCREEN } from "@/constants/constants";
import {
	getLocalWallpaper,
	LOCAL_WALLPAPER_CHANGE_EVENT,
	type LocalWallpaperChangeDetail,
	type LocalWallpaperType,
	removeLocalWallpaper,
	saveLocalWallpaper,
} from "@/utils/local-wallpaper";
import { setWallpaperMode } from "@/utils/setting-utils";

const BUILT_IN_COVER_EVENT = "jingyue:select-built-in-cover";
const LOCAL_COVER_STATE_EVENT = "jingyue:local-cover-state-change";
let { compact = false }: { compact?: boolean } = $props();

let fileInput: HTMLInputElement;
let wallpaperEngineInput: HTMLInputElement;
let fileName = $state("");
let fileType = $state<LocalWallpaperType | null>(null);
let busy = $state(false);
let message = $state("");
let error = $state("");

function publishLocalCoverState(active: boolean) {
	window.dispatchEvent(
		new CustomEvent(LOCAL_COVER_STATE_EVENT, { detail: { active } }),
	);
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

function openFilePicker() {
	fileInput?.click();
}

function openWallpaperEnginePicker() {
	wallpaperEngineInput?.click();
}

async function applyLocalFile(file: File, successMessage: string) {
	const record = await saveLocalWallpaper(file);
	fileName = record.name;
	fileType = record.type;
	publishLocalCoverState(true);
	setWallpaperMode(WALLPAPER_FULLSCREEN);
	message = successMessage;
}

async function handleFileChange(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	input.value = "";
	if (!file) return;

	busy = true;
	error = "";
	message = "";
	try {
		await applyLocalFile(file, "已应用到首页封面与站点背景");
	} catch (reason) {
		error = reason instanceof Error ? reason.message : "无法保存这个背景文件。";
	} finally {
		busy = false;
	}
}

async function handleWallpaperEngineDirectory(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const files = Array.from(input.files ?? []);
	input.value = "";
	if (!files.length) return;

	busy = true;
	error = "";
	message = "";
	try {
		const videos = files
			.filter(
				(file) =>
					file.type.startsWith("video/") ||
					/\.(m4v|mov|mp4|ogv|webm)$/i.test(file.name),
			)
			.sort((left, right) => right.size - left.size);
		const wallpaper = videos[0];
		if (!wallpaper) {
			const isSceneProject = files.some((file) =>
				/(^|[/\\])scene\.pkg$/i.test(file.webkitRelativePath || file.name),
			);
			const isWebProject = files.some((file) =>
				/(^|[/\\])index\.html?$/i.test(file.webkitRelativePath || file.name),
			);
			const projectType = isSceneProject
				? "Scene 场景"
				: isWebProject
					? "网页"
					: "非视频";
			throw new Error(
				`检测到${projectType}壁纸。浏览器只能直接使用 Wallpaper Engine 的视频壁纸，请选择包含 MP4 或 WebM 的项目文件夹。`,
			);
		}

		await applyLocalFile(
			wallpaper,
			"已接入 Wallpaper Engine 视频壁纸并开始静音循环播放",
		);
	} catch (reason) {
		error =
			reason instanceof Error
				? reason.message
				: "无法读取这个 Wallpaper Engine 项目。";
	} finally {
		busy = false;
	}
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
		if (showMessage) message = "已恢复内置封面";
	} catch (reason) {
		error = reason instanceof Error ? reason.message : "无法移除本地背景。";
	} finally {
		busy = false;
	}
}

onMount(() => {
	wallpaperEngineInput?.setAttribute("webkitdirectory", "");
	wallpaperEngineInput?.setAttribute("directory", "");
	void syncCurrentFile();

	const handleWallpaperChange = (event: Event) => {
		const detail = (event as CustomEvent<LocalWallpaperChangeDetail>).detail;
		if (detail?.kind === "media") void syncCurrentFile();
	};
	const handleBuiltInCover = () => void clearLocalFile(false);

	window.addEventListener(LOCAL_WALLPAPER_CHANGE_EVENT, handleWallpaperChange);
	window.addEventListener(BUILT_IN_COVER_EVENT, handleBuiltInCover);
	return () => {
		window.removeEventListener(
			LOCAL_WALLPAPER_CHANGE_EVENT,
			handleWallpaperChange,
		);
		window.removeEventListener(BUILT_IN_COVER_EVENT, handleBuiltInCover);
	};
});
</script>

<section class:compact class="local-cover-import" aria-labelledby="local-cover-import-title">
	<div class="local-cover-icon" aria-hidden="true">
		{#if fileType === "video"}
			<Icon icon="material-symbols:movie-outline-rounded" />
		{:else}
			<Icon icon="material-symbols:add-photo-alternate-outline-rounded" />
		{/if}
	</div>
	<div class="local-cover-copy">
		<strong id="local-cover-import-title">
			{fileName ? "正在使用本地背景" : "导入本地图片或视频"}
		</strong>
		<p title={fileName}>
			{fileName || "支持图片、视频与 Wallpaper Engine 视频项目"}
		</p>
		{#if message}
			<small class="is-success" role="status">{message}</small>
		{:else if error}
			<small class="is-error" role="alert">{error}</small>
		{/if}
	</div>
	<div class="local-cover-actions">
		<button type="button" class="local-cover-pick" disabled={busy} onclick={openFilePicker}>
			<Icon icon="material-symbols:upload-rounded" />
			<span>{busy ? "处理中…" : fileName ? "替换" : "选择文件"}</span>
		</button>
		<button
			type="button"
			class="local-cover-engine"
			disabled={busy}
			title="选择 Wallpaper Engine 视频项目所在文件夹"
			onclick={openWallpaperEnginePicker}
		>
			<Icon icon="material-symbols:folder-open-rounded" />
			<span>导入 WE 项目</span>
		</button>
		<input
			bind:this={fileInput}
			hidden
			type="file"
			accept="image/*,video/*"
			disabled={busy}
			 onchange={handleFileChange}
		/>
		<input
			bind:this={wallpaperEngineInput}
			hidden
			type="file"
			multiple
			disabled={busy}
			onchange={handleWallpaperEngineDirectory}
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
			</button>
		{/if}
	</div>
</section>

<style>
	.local-cover-import {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.8rem;
		min-height: 4.2rem;
		border: 1px solid rgba(196, 181, 253, 0.24);
		border-radius: 1rem;
		background:
			linear-gradient(135deg, rgba(139, 92, 246, 0.13), rgba(56, 189, 248, 0.06)),
			rgba(26, 28, 64, 0.78);
		box-shadow: 0 0.8rem 2.2rem rgba(3, 5, 22, 0.32);
		padding: 0.65rem 0.75rem;
		color: white;
		backdrop-filter: blur(0.9rem);
	}

	.local-cover-import.compact {
		grid-template-columns: auto minmax(0, 1fr);
		align-content: center;
		min-height: 0;
		padding: 0.8rem;
	}

	.local-cover-import.compact .local-cover-actions {
		grid-column: 1 / -1;
		width: 100%;
	}

	.local-cover-import.compact .local-cover-pick {
		flex: 1;
	}

	.local-cover-import.compact .local-cover-engine {
		flex: 1.2;
	}

	.local-cover-icon {
		display: grid;
		place-items: center;
		width: 2.6rem;
		height: 2.6rem;
		border-radius: 0.8rem;
		background: linear-gradient(145deg, rgba(167, 139, 250, 0.9), rgba(56, 189, 248, 0.7));
		box-shadow: 0 0.5rem 1.4rem rgba(139, 92, 246, 0.28);
		color: white;
	}

	.local-cover-icon :global(svg),
	.local-cover-actions :global(svg) {
		width: 1.15rem;
		height: 1.15rem;
	}

	.local-cover-copy {
		min-width: 0;
	}

	.local-cover-copy strong,
	.local-cover-copy p,
	.local-cover-copy small {
		display: block;
		margin: 0;
	}

	.local-cover-copy strong {
		font-size: 0.76rem;
		font-weight: 800;
	}

	.local-cover-copy p {
		overflow: hidden;
		margin-top: 0.18rem;
		color: rgba(222, 224, 246, 0.68);
		font-size: 0.64rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.local-cover-copy small {
		margin-top: 0.18rem;
		font-size: 0.58rem;
	}

	.local-cover-copy .is-success {
		color: #c4b5fd;
	}

	.local-cover-copy .is-error {
		color: #fecaca;
	}

	.local-cover-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.local-cover-actions button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		height: 2.35rem;
		border: 1px solid rgba(196, 181, 253, 0.24);
		border-radius: 0.72rem;
		background: rgba(41, 42, 86, 0.82);
		color: white;
		cursor: pointer;
		transition: background-color 180ms ease, border-color 180ms ease, transform 180ms ease;
	}

	.local-cover-actions button:hover,
	.local-cover-actions button:focus-visible {
		border-color: #c4b5fd;
		background: rgba(76, 63, 132, 0.82);
		outline: 2px solid rgba(196, 181, 253, 0.76);
		outline-offset: 2px;
	}

	.local-cover-actions button:active {
		transform: scale(0.96);
	}

	.local-cover-actions button:disabled {
		cursor: wait;
		opacity: 0.58;
	}

	.local-cover-pick {
		padding-inline: 0.8rem;
		background: linear-gradient(135deg, rgba(124, 58, 237, 0.84), rgba(99, 102, 241, 0.78)) !important;
		font-size: 0.68rem;
		font-weight: 800;
	}

	.local-cover-engine {
		padding-inline: 0.8rem;
		font-size: 0.68rem;
		font-weight: 800;
	}

	.local-cover-remove {
		width: 2.35rem;
		padding: 0;
	}

	@media (max-width: 640px) {
		.local-cover-import {
			grid-template-columns: auto minmax(0, 1fr);
			gap: 0.65rem;
		}

		.local-cover-actions {
			grid-column: 1 / -1;
		}

		.local-cover-pick {
			flex: 1;
		}

		.local-cover-engine {
			flex: 1.2;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.local-cover-actions button {
			transition: none;
		}
	}
</style>
