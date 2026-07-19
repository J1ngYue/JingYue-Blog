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
const VIDEO_PATTERN = /\.(m4v|mov|mp4|ogv|webm)$/i;
let { compact = false }: { compact?: boolean } = $props();

let mediaInput: HTMLInputElement;
let wallpaperEngineVideoInput: HTMLInputElement;
let wallpaperEngineDirectoryInput: HTMLInputElement;
let fileName = $state("");
let fileType = $state<LocalWallpaperType | null>(null);
let busy = $state(false);
let message = $state("");
let error = $state("");
let dragging = $state(false);

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

function openWallpaperEngineVideoPicker() {
	wallpaperEngineVideoInput?.click();
}

function openWallpaperEngineDirectoryPicker() {
	wallpaperEngineDirectoryInput?.click();
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

async function handleWallpaperEngineVideo(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	input.value = "";
	if (!file) return;
	await runImport(file, "已识别 Wallpaper Engine 视频并开始静音循环播放。");
}

async function findWallpaperEngineVideo(files: File[]) {
	const projectFile = files.find((file) =>
		/(^|[/\\])project\.json$/i.test(file.webkitRelativePath || file.name),
	);
	if (projectFile) {
		try {
			const project = JSON.parse(await projectFile.text()) as { file?: string };
			const target = String(project.file || "")
				.replaceAll("\\", "/")
				.toLocaleLowerCase();
			if (target && VIDEO_PATTERN.test(target)) {
				const exact = files.find((file) => {
					const relative = (file.webkitRelativePath || file.name)
						.replaceAll("\\", "/")
						.toLocaleLowerCase();
					return relative.endsWith(`/${target}`) || relative === target;
				});
				if (exact) return exact;
			}
		} catch {
			// project.json 不是有效 JSON 时继续扫描目录中的视频文件。
		}
	}

	return files.filter(isVideoFile).sort((left, right) => {
		const leftPriority = /(?:wallpaper|background|video|main)/i.test(left.name)
			? 1
			: 0;
		const rightPriority = /(?:wallpaper|background|video|main)/i.test(
			right.name,
		)
			? 1
			: 0;
		return rightPriority - leftPriority || right.size - left.size;
	})[0];
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
		const wallpaper = await findWallpaperEngineVideo(files);
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
				`检测到${projectType}壁纸，浏览器只能直接播放视频壁纸。请选择包含 MP4 或 WebM 的项目文件夹。`,
			);
		}

		await applyLocalFile(
			wallpaper,
			`已从项目中识别 ${wallpaper.name}，并开始静音循环播放。`,
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
	wallpaperEngineDirectoryInput?.setAttribute("webkitdirectory", "");
	wallpaperEngineDirectoryInput?.setAttribute("directory", "");
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
		<div class="local-cover-icon" aria-hidden="true">
			<Icon
				icon={fileType === "video"
					? "material-symbols:movie-outline-rounded"
					: "material-symbols:wallpaper-rounded"}
			/>
		</div>
		<div class="local-cover-copy">
			<strong id="local-cover-import-title">
				{fileName ? "正在使用本地背景" : "导入图片或动态壁纸"}
			</strong>
			<p title={fileName}>
				{fileName || "支持图片、H.264 MP4、WebM 和 Wallpaper Engine 视频项目"}
			</p>
		</div>
		{#if fileType}
			<span class="local-cover-format">{fileType === "video" ? "VIDEO" : "IMAGE"}</span>
		{/if}
	</header>

	<div class="local-cover-actions">
		<div class="local-cover-action-group">
			<span>本地媒体</span>
			<button type="button" class="local-cover-pick" disabled={busy} onclick={openMediaPicker}>
				<Icon icon="material-symbols:upload-rounded" />
				<span>{busy ? "正在解析" : fileName ? "替换文件" : "选择图片 / 视频"}</span>
			</button>
		</div>
		<div class="local-cover-action-group local-cover-engine-group">
			<span>Wallpaper Engine</span>
			<div>
				<button
					type="button"
					class="local-cover-engine"
					disabled={busy}
					onclick={openWallpaperEngineVideoPicker}
				>
					<Icon icon="material-symbols:movie-edit-outline-rounded" />
					<span>选择 MP4</span>
				</button>
				<button
					type="button"
					class="local-cover-engine"
					disabled={busy}
					title="扫描 Wallpaper Engine 视频项目文件夹"
					onclick={openWallpaperEngineDirectoryPicker}
				>
					<Icon icon="material-symbols:folder-open-rounded" />
					<span>扫描项目</span>
				</button>
			</div>
		</div>
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
			<span>也可以把单个图片或 MP4 直接拖到这里</span>
		{/if}
	</div>

	<input
		bind:this={mediaInput}
		hidden
		type="file"
		accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.m4v,.mov,.ogv"
		disabled={busy}
		onchange={handleMediaChange}
	/>
	<input
		bind:this={wallpaperEngineVideoInput}
		hidden
		type="file"
		accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.m4v,.mov,.ogv"
		disabled={busy}
		onchange={handleWallpaperEngineVideo}
	/>
	<input
		bind:this={wallpaperEngineDirectoryInput}
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
			<span>恢复内置封面</span>
		</button>
	{/if}
</section>

<style>
	.local-cover-import {
		position: relative;
		display: grid;
		gap: 0.7rem;
		border: 1px solid color-mix(in oklch, var(--primary) 32%, rgba(255, 255, 255, 0.16));
		border-radius: 1rem;
		background:
			radial-gradient(circle at 0 0, color-mix(in oklch, var(--primary) 20%, transparent), transparent 48%),
			rgba(18, 26, 42, 0.76);
		box-shadow: 0 0.9rem 2.4rem rgba(3, 8, 20, 0.26);
		padding: 0.8rem;
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
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.65rem;
	}

	.local-cover-icon {
		display: grid;
		place-items: center;
		width: 2.5rem;
		height: 2.5rem;
		border: 1px solid color-mix(in oklch, var(--primary) 45%, transparent);
		border-radius: 0.8rem;
		background: color-mix(in oklch, var(--primary) 24%, rgba(255, 255, 255, 0.08));
		color: color-mix(in oklch, var(--primary) 72%, white);
	}

	.local-cover-icon :global(svg),
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
		font-size: 0.76rem;
		font-weight: 800;
	}

	.local-cover-copy p {
		overflow: hidden;
		margin-top: 0.18rem;
		color: rgba(226, 232, 240, 0.68);
		font-size: 0.61rem;
		line-height: 1.45;
		text-overflow: ellipsis;
		white-space: nowrap;
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
		grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
		gap: 0.5rem;
	}

	.local-cover-action-group {
		display: grid;
		align-content: start;
		gap: 0.38rem;
		min-width: 0;
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: 0.78rem;
		background: rgba(255, 255, 255, 0.055);
		padding: 0.48rem;
	}

	.local-cover-action-group > span {
		color: rgba(226, 232, 240, 0.58);
		font-size: 0.55rem;
		font-weight: 750;
		letter-spacing: 0.06em;
	}

	.local-cover-engine-group > div {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.35rem;
	}

	.local-cover-actions button,
	.local-cover-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.32rem;
		min-width: 0;
		height: 2.15rem;
		border: 1px solid color-mix(in oklch, var(--primary) 28%, rgba(255, 255, 255, 0.12));
		border-radius: 0.65rem;
		background: rgba(255, 255, 255, 0.075);
		padding-inline: 0.48rem;
		color: white;
		font-size: 0.58rem;
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

	.local-cover-actions button:disabled,
	.local-cover-remove:disabled {
		cursor: wait;
		opacity: 0.58;
	}

	.local-cover-pick {
		background: color-mix(in oklch, var(--primary) 38%, rgba(15, 23, 42, 0.74)) !important;
	}

	.local-cover-feedback {
		display: flex;
		min-height: 1rem;
		align-items: flex-start;
		gap: 0.35rem;
		color: rgba(226, 232, 240, 0.58);
		font-size: 0.56rem;
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

	@media (max-width: 640px) {
		.local-cover-actions {
			grid-template-columns: minmax(0, 1fr);
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
