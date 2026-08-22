<script lang="ts">
import { WALLPAPER_BANNER, WALLPAPER_NONE } from "@constants/constants";
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import { pageWallpaperAssets } from "@/config/pageWallpapers";
import {
	getLocalWallpaperHistory,
	LOCAL_WALLPAPER_CHANGE_EVENT,
	type LocalWallpaperHistoryRecord,
	removeLocalWallpaperHistory,
	saveLocalWallpaperAsset,
} from "@/utils/local-wallpaper";
import {
	getEffectivePageWallpaper,
	getLastWallpaperSyncTargets,
	getPageWallpaperLabel,
	getWallpaperPreferenceDevice,
	OPEN_WALLPAPER_PICKER_EVENT,
	PAGE_WALLPAPER_CHANGE_EVENT,
	PAGE_WALLPAPER_PAGES,
	type PageWallpaperChoice,
	type PageWallpaperKey,
	removePageWallpaperReferences,
	resetDefaultPageWallpaper,
	resetPageWallpapers,
	resolvePageWallpaperKey,
	setLastWallpaperSyncTargets,
	setPageWallpapers,
	type WallpaperPreferenceDevice,
} from "@/utils/page-wallpaper";
import {
	getHue,
	getStoredWallpaperMode,
	setHue,
	setWallpaperMode,
} from "@/utils/setting-utils";

type ApplyMode = "current" | "sync";
type HistoryPreview = LocalWallpaperHistoryRecord & { previewUrl: string };

const FAVORITES_KEY = "fireflyLocalCoverFavorites";
const VIDEO_PATTERN = /\.(m4v|mov|mp4|ogv|webm)$/i;
const CLOSE_WALLPAPER_PICKER_EVENT = "firefly:close-wallpaper-picker";
const WALLPAPER_PICKER_APPLIED_EVENT = "firefly:wallpaper-picker-applied";

let open = $state(false);
let currentPage = $state<PageWallpaperKey>("home");
let currentDevice = $state<WallpaperPreferenceDevice>("desktop");
let selectedChoice = $state<PageWallpaperChoice>("wallpaper-1");
let applyMode = $state<ApplyMode>("current");
let syncPages = $state<PageWallpaperKey[]>([]);
let history = $state<HistoryPreview[]>([]);
let favoriteMap = $state<Record<string, string>>({});
let busy = $state(false);
let message = $state("");
let error = $state("");
let deleteCandidate = $state<string | null>(null);
let draggingHistoryId = $state<string | null>(null);
let isDarkTheme = $state(true);
let fileInput: HTMLInputElement;
let dialog: HTMLElement;
let orbit: HTMLElement;
let particleArrow: HTMLElement;
let particleArrowVisible = $state(false);
let hue = $state(getHue());
const previewUrls = new Set<string>();
let previousBodyOverflow = "";
let hueFrame = 0;
let particleArrowFrame = 0;
let particleArrowAngle = 0;
let particleArrowLength = 0;

function readFavorites() {
	try {
		const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "{}");
		return value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, string>)
			: {};
	} catch {
		return {};
	}
}

function writeFavorites(next: Record<string, string>) {
	favoriteMap = next;
	localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
	window.dispatchEvent(new Event(PAGE_WALLPAPER_CHANGE_EVENT));
}

async function refreshHistory() {
	const records = await getLocalWallpaperHistory();
	const stalePreviewUrls = [...previewUrls];
	const nextPreviewUrls = new Set<string>();
	const nextHistory = records.map((record) => {
		const previewUrl = URL.createObjectURL(record.blob);
		nextPreviewUrls.add(previewUrl);
		return { ...record, previewUrl };
	});
	previewUrls.clear();
	nextPreviewUrls.forEach((url) => {
		previewUrls.add(url);
	});
	history = nextHistory;
	favoriteMap = readFavorites();
	requestAnimationFrame(() => {
		stalePreviewUrls.forEach((url) => {
			URL.revokeObjectURL(url);
		});
	});
}

function getFavorite(index: number) {
	const id = favoriteMap[String(index)];
	return id ? history.find((item) => item.id === id) : undefined;
}

function getSelectedHistory() {
	if (!selectedChoice.startsWith("local:")) return undefined;
	return history.find(
		(item) => item.id === selectedChoice.slice("local:".length),
	);
}

function getSelectedAsset() {
	if (!selectedChoice.startsWith("wallpaper-")) return undefined;
	return pageWallpaperAssets.find((asset) => asset.id === selectedChoice);
}

function selectedName() {
	const local = getSelectedHistory();
	if (local) return local.name;
	const asset = getSelectedAsset();
	if (!asset) return "系统默认壁纸";
	const index = pageWallpaperAssets.indexOf(asset);
	return getFavorite(index)?.name || asset.label;
}

function openPicker() {
	window.dispatchEvent(
		new CustomEvent("jingyue:floating-panel-open", {
			detail: { panel: "wallpaper" },
		}),
	);
	currentPage = resolvePageWallpaperKey();
	currentDevice = getWallpaperPreferenceDevice();
	selectedChoice = getEffectivePageWallpaper(currentPage);
	applyMode = "current";
	syncPages = getLastWallpaperSyncTargets();
	message = "";
	error = "";
	deleteCandidate = null;
	isDarkTheme = document.documentElement.classList.contains("dark");
	open = true;
	previousBodyOverflow = document.body.style.overflow;
	document.body.style.overflow = "hidden";
	document.documentElement.classList.add("page-wallpaper-picker-open");
	void refreshHistory();
	requestAnimationFrame(() => {
		dialog?.focus({ preventScroll: true });
	});
}

function closePicker() {
	if (!open) return;
	open = false;
	particleArrowVisible = false;
	document.body.style.overflow = previousBodyOverflow;
	document.documentElement.classList.remove("page-wallpaper-picker-open");
}

function previewHue(value: number) {
	if (!Number.isFinite(value)) return;
	hue = Math.round(Math.min(360, Math.max(0, value)));
	if (hueFrame) cancelAnimationFrame(hueFrame);
	hueFrame = requestAnimationFrame(() => {
		hueFrame = 0;
		document.documentElement.style.setProperty("--hue", String(hue));
	});
}

function commitHue(value = hue) {
	previewHue(value);
	setHue(hue);
}

function pointParticleArrowToPoint(targetX: number, targetY: number) {
	if (!orbit || !particleArrow) return;
	const orbitRect = orbit.getBoundingClientRect();
	const centerX = orbitRect.left + orbitRect.width / 2;
	const centerY = orbitRect.top + orbitRect.height / 2;
	const deltaX = targetX - centerX;
	const deltaY = targetY - centerY;
	const distance = Math.hypot(deltaX, deltaY);
	const orbitSize = Math.min(orbitRect.width, orbitRect.height);
	const minimumLength = orbitSize * 0.12;
	const maximumLength = orbitSize * 0.48;
	particleArrowLength = Math.max(
		minimumLength,
		Math.min(distance - 14, maximumLength),
	);
	particleArrowAngle = Math.atan2(deltaY, deltaX);

	if (particleArrowFrame) cancelAnimationFrame(particleArrowFrame);
	particleArrowFrame = requestAnimationFrame(() => {
		particleArrowFrame = 0;
		particleArrow.style.setProperty(
			"--particle-length",
			`${particleArrowLength}px`,
		);
		particleArrow.style.setProperty(
			"--particle-angle",
			`${particleArrowAngle}rad`,
		);
		particleArrowVisible = true;
	});
}

function pointParticleArrowToOption(option: HTMLElement) {
	const optionRect = option.getBoundingClientRect();
	pointParticleArrowToPoint(
		optionRect.left + optionRect.width / 2,
		optionRect.top + optionRect.height / 2,
	);
}

function handleOrbitPointerMove(event: PointerEvent) {
	if (event.pointerType === "touch") return;
	pointParticleArrowToPoint(event.clientX, event.clientY);
}

function handleOrbitPointerLeave() {
	if (particleArrowFrame) {
		cancelAnimationFrame(particleArrowFrame);
		particleArrowFrame = 0;
	}
	particleArrowVisible = false;
}

function handleWindowPointerMove(event: PointerEvent) {
	if (!open || event.pointerType === "touch" || !orbit) return;
	const rect = orbit.getBoundingClientRect();
	const isInside =
		event.clientX >= rect.left &&
		event.clientX <= rect.right &&
		event.clientY >= rect.top &&
		event.clientY <= rect.bottom;
	if (!isInside) handleOrbitPointerLeave();
}

function handleOrbitFocusIn(event: FocusEvent) {
	const option =
		event.target instanceof Element
			? event.target.closest(".home-cover-option")
			: null;
	if (!(option instanceof HTMLElement)) return;
	pointParticleArrowToOption(option);
}

function handleOrbitFocusOut(event: FocusEvent) {
	if (
		event.relatedTarget instanceof Node &&
		orbit?.contains(event.relatedTarget)
	) {
		return;
	}
	particleArrowVisible = false;
}

function particleFieldStyle(index: number) {
	const x = (index * 37 + 11) % 97;
	const y = (index * 53 + 7) % 94;
	const size = 1.5 + ((index * 7) % 5) * 0.55;
	const duration = 3.8 + ((index * 11) % 7) * 0.52;
	const delay = -((index * 0.41) % duration);
	const drift = ((index * 17) % 13) - 6;
	return `--field-x:${x};--field-y:${y};--field-size:${size};--field-duration:${duration};--field-delay:${delay};--field-drift:${drift}`;
}

function selectAsset(choice: PageWallpaperChoice) {
	selectedChoice = choice;
	if (applyWallpaper(choice)) closeAfterSelection();
}

function selectHistory(item: HistoryPreview) {
	const choice = `local:${item.id}` as PageWallpaperChoice;
	selectedChoice = choice;
	if (applyWallpaper(choice)) closeAfterSelection();
}

function toggleAllPages(selectAll: boolean) {
	syncPages = selectAll ? PAGE_WALLPAPER_PAGES.map((page) => page.key) : [];
}

function applyWallpaper(choice = selectedChoice) {
	const targets = applyMode === "current" ? [currentPage] : syncPages;
	if (targets.length === 0) {
		error = "请至少勾选一个需要同步的页面。";
		return false;
	}
	if (getStoredWallpaperMode() === WALLPAPER_NONE) {
		setWallpaperMode(WALLPAPER_BANNER);
	}
	setPageWallpapers(choice, targets, { setAsDefault: true });
	if (applyMode === "sync") setLastWallpaperSyncTargets(syncPages);
	message =
		applyMode === "current"
			? `已将 ${selectedName()} 应用到${getPageWallpaperLabel(currentPage)}的${currentDevice === "mobile" ? "手机端" : "电脑端"}。`
			: `已同步到${currentDevice === "mobile" ? "手机端" : "电脑端"}的 ${targets.map(getPageWallpaperLabel).join("、")}。`;
	error = "";
	return true;
}

function closeAfterSelection() {
	window.dispatchEvent(new Event(WALLPAPER_PICKER_APPLIED_EVENT));
	if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
		closePicker();
		return;
	}
	window.setTimeout(closePicker, 180);
}

function restoreCurrentDefault() {
	resetPageWallpapers([currentPage]);
	resetDefaultPageWallpaper();
	selectedChoice = getEffectivePageWallpaper(currentPage);
	applyMode = "current";
	message = `${getPageWallpaperLabel(currentPage)}的${currentDevice === "mobile" ? "手机端" : "电脑端"}已恢复默认壁纸。`;
	error = "";
	closeAfterSelection();
}

function isVideoFile(file: File) {
	return file.type.startsWith("video/") || VIDEO_PATTERN.test(file.name);
}

async function validateVideo(file: File) {
	const source = URL.createObjectURL(file);
	try {
		await new Promise<void>((resolve, reject) => {
			const video = document.createElement("video");
			const timer = window.setTimeout(
				() => reject(new Error("视频解析超时，请确认文件未损坏。")),
				12000,
			);
			const finish = (callback: () => void) => {
				window.clearTimeout(timer);
				video.removeAttribute("src");
				video.load();
				callback();
			};
			video.preload = "metadata";
			video.muted = true;
			video.onloadedmetadata = () =>
				video.videoWidth > 0
					? finish(resolve)
					: finish(() => reject(new Error("没有识别到可播放的视频画面。")));
			video.onerror = () =>
				finish(() =>
					reject(new Error("建议使用 H.264 编码的 MP4 或 WebM 视频。")),
				);
			video.src = source;
		});
	} finally {
		URL.revokeObjectURL(source);
	}
}

async function importMedia(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	input.value = "";
	if (!file || busy) return;
	busy = true;
	error = "";
	message = "";
	try {
		if (isVideoFile(file)) await validateVideo(file);
		const record = await saveLocalWallpaperAsset(file);
		await refreshHistory();
		selectedChoice = `local:${record.id}`;
		message = `已导入并应用 ${record.name}。`;
		if (applyWallpaper(selectedChoice)) closeAfterSelection();
	} catch (reason) {
		error = reason instanceof Error ? reason.message : "无法导入这个媒体文件。";
	} finally {
		busy = false;
	}
}

async function deleteHistory(item: HistoryPreview) {
	if (busy) return;
	busy = true;
	error = "";
	try {
		await removeLocalWallpaperHistory(item.id);
		removePageWallpaperReferences(`local:${item.id}`);
		const nextFavorites = Object.fromEntries(
			Object.entries(favoriteMap).filter(([, id]) => id !== item.id),
		);
		writeFavorites(nextFavorites);
		if (selectedChoice === `local:${item.id}`) {
			selectedChoice = getEffectivePageWallpaper(currentPage);
		}
		deleteCandidate = null;
		await refreshHistory();
		message = `已删除 ${item.name}。`;
	} catch (reason) {
		error = reason instanceof Error ? reason.message : "无法删除这条记录。";
	} finally {
		busy = false;
	}
}

function handleHistoryDragStart(event: DragEvent, item: HistoryPreview) {
	draggingHistoryId = item.id;
	event.dataTransfer?.setData("application/x-firefly-wallpaper", item.id);
	if (event.dataTransfer) event.dataTransfer.effectAllowed = "copy";
}

function assignFavorite(event: DragEvent, index: number) {
	event.preventDefault();
	const id =
		event.dataTransfer?.getData("application/x-firefly-wallpaper") ||
		draggingHistoryId;
	draggingHistoryId = null;
	if (!id || !history.some((item) => item.id === id)) return;
	writeFavorites({ ...favoriteMap, [String(index)]: id });
	message = `已替换 ${pageWallpaperAssets[index].label}。`;
}

onMount(() => {
	const handleOpen = () => openPicker();
	const handleClose = () => closePicker();
	const handleDocumentClick = (event: MouseEvent) => {
		if (!(event.target instanceof Element)) return;
		const trigger = event.target.closest<HTMLElement>(
			"[data-global-wallpaper-trigger]",
		);
		if (!trigger) return;
		event.preventDefault();
		handleOpen();
	};
	const handleKeydown = (event: KeyboardEvent) => {
		if (open && event.key === "Escape") closePicker();
	};
	const handleLocalChange = () => void refreshHistory();

	window.addEventListener(OPEN_WALLPAPER_PICKER_EVENT, handleOpen);
	window.addEventListener(CLOSE_WALLPAPER_PICKER_EVENT, handleClose);
	window.addEventListener(LOCAL_WALLPAPER_CHANGE_EVENT, handleLocalChange);
	window.addEventListener("pointermove", handleWindowPointerMove, true);
	document.addEventListener("click", handleDocumentClick);
	document.addEventListener("keydown", handleKeydown);

	return () => {
		window.removeEventListener(OPEN_WALLPAPER_PICKER_EVENT, handleOpen);
		window.removeEventListener(CLOSE_WALLPAPER_PICKER_EVENT, handleClose);
		window.removeEventListener(LOCAL_WALLPAPER_CHANGE_EVENT, handleLocalChange);
		window.removeEventListener("pointermove", handleWindowPointerMove, true);
		document.removeEventListener("click", handleDocumentClick);
		document.removeEventListener("keydown", handleKeydown);
		if (open) closePicker();
		if (hueFrame) cancelAnimationFrame(hueFrame);
		if (particleArrowFrame) cancelAnimationFrame(particleArrowFrame);
		previewUrls.forEach((url) => {
			URL.revokeObjectURL(url);
		});
		previewUrls.clear();
	};
});
</script>

{#if open}
	<div class="home-cover-switcher is-open" class:is-light={!isDarkTheme} role="presentation">
		<button
			type="button"
			class="home-cover-switcher-backdrop"
			aria-label="关闭壁纸选择器"
			onclick={closePicker}
		></button>
		<section
			bind:this={dialog}
			id="page-wallpaper-picker"
			class="home-cover-switcher-dialog"
			role="dialog"
			aria-modal="true"
			aria-labelledby="wallpaper-picker-title"
			tabindex="-1"
		>
			<div class="home-cover-ambient" aria-hidden="true">
				<i></i><i></i><i></i><i></i><i></i><i></i>
			</div>
			<button type="button" class="home-cover-switcher-close" aria-label="关闭" onclick={closePicker}>
				<Icon icon="material-symbols:close-rounded" />
			</button>

			<div class="home-cover-switcher-layout">
				<aside class="home-cover-switcher-sidebar">
					<div class="home-cover-switcher-heading">
						<div class="home-cover-switcher-kicker">
							<span>WALLPAPER CONTROL</span>
							<i aria-hidden="true"></i>
							<small>JINGYUE / SC-01</small>
						</div>
						<h2 id="wallpaper-picker-title">场景切换台<small>SCENE CONSOLE</small></h2>
						<span class="home-cover-favorites-note">
							<Icon icon="material-symbols:check-circle-rounded" />
							<span>当前页面</span>
							<strong>{getPageWallpaperLabel(currentPage)}</strong>
							<em>{currentDevice === "mobile" ? "手机端" : "电脑端"}</em>
							<i aria-hidden="true"></i>
							<b>{selectedName()}</b>
						</span>
						<p class="home-cover-switcher-description">
							选择预设、指定应用范围，或载入本地图片与动态影像。
						</p>
					</div>

					<div class="home-cover-switcher-utilities">
						<section class="home-cover-theme-control" aria-labelledby="wallpaper-theme-title">
							<div class="home-cover-theme-heading">
								<span id="wallpaper-theme-title"><Icon icon="material-symbols:gradient" /><i>01</i>氛围色</span>
								<output>{hue}°</output>
							</div>
							<input
								type="range"
								min="0"
								max="360"
								step="1"
								value={hue}
								aria-label="调整壁纸选择器与站点主题色"
								oninput={(event) => previewHue(event.currentTarget.valueAsNumber)}
								onchange={(event) => commitHue(event.currentTarget.valueAsNumber)}
							/>
							<div class="home-cover-theme-presets">
								{#each [140, 190, 230, 285, 330] as preset}
									<button
										type="button"
										style={`--preset-hue: ${preset}`}
										aria-label={`切换到 ${preset} 度主题色`}
										aria-pressed={hue === preset}
										onclick={() => commitHue(preset)}
									></button>
								{/each}
							</div>
						</section>

						<section class="home-cover-apply-control" aria-labelledby="wallpaper-apply-title">
							<div class="home-cover-apply-heading">
								<strong id="wallpaper-apply-title"><i>02</i>应用范围</strong>
							</div>
							<div class="home-cover-apply-modes">
								<label class:is-selected={applyMode === "current"}>
									<input type="radio" value="current" bind:group={applyMode} />
									<Icon icon="material-symbols:filter-center-focus-rounded" />
									<span><strong>仅当前页面</strong><small>{getPageWallpaperLabel(currentPage)}</small></span>
								</label>
								<label class:is-selected={applyMode === "sync"}>
									<input type="radio" value="sync" bind:group={applyMode} />
									<Icon icon="material-symbols:select-all-rounded" />
									<span><strong>同步指定页面</strong><small>批量应用</small></span>
								</label>
							</div>
							{#if applyMode === "sync"}
								<div class="home-cover-sync-toolbar">
									<span>勾选同步页面</span>
									<div>
										<button type="button" onclick={() => toggleAllPages(true)}>全选</button>
										<button type="button" onclick={() => toggleAllPages(false)}>取消全选</button>
									</div>
								</div>
								<div class="home-cover-page-options">
									{#each PAGE_WALLPAPER_PAGES as page}
										<label>
											<input type="checkbox" value={page.key} bind:group={syncPages} />
											<span>{page.label}</span>
										</label>
									{/each}
								</div>
							{/if}
							<div class="home-cover-feedback" aria-live="polite">
								{#if error}<span class="is-error">{error}</span>{:else if message}<span>{message}</span>{/if}
							</div>
						</section>

						<section class="home-cover-local-library" aria-labelledby="local-wallpapers-title">
							<div class="home-cover-local-heading">
								<div>
									<strong id="local-wallpapers-title"><i>03</i>本地收藏</strong>
									<small>图片、MP4、WebM</small>
								</div>
								<button type="button" disabled={busy} onclick={() => fileInput.click()}>
									<Icon icon="material-symbols:upload-file-rounded" />{busy ? "解析中" : "选择媒体"}
								</button>
							</div>
							{#if history.length > 0}
								<div class="home-cover-history">
									{#each history as item (item.id)}
										<div class="home-cover-history-item" draggable="true" ondragstart={(event) => handleHistoryDragStart(event, item)}>
											<button type="button" class:is-selected={selectedChoice === `local:${item.id}`} onclick={() => selectHistory(item)}>
												<span>
													{#if item.type === "video"}
														<video src={item.previewUrl} muted playsinline preload="metadata"></video>
														<Icon icon="material-symbols:play-circle-rounded" />
													{:else}
														<img src={item.previewUrl} alt="" loading="lazy" />
													{/if}
												</span>
												<strong title={item.name}>{item.name}</strong>
											</button>
											<button type="button" class="home-cover-history-delete" aria-label={`删除 ${item.name}`} onclick={() => (deleteCandidate = item.id)}>
												<Icon icon="material-symbols:close-rounded" />
											</button>
											{#if deleteCandidate === item.id}
												<div class="home-cover-delete-confirm" role="alert">
													<strong>确定删除？</strong>
													<div>
														<button type="button" onclick={() => (deleteCandidate = null)}>取消</button>
														<button type="button" class="is-danger" onclick={() => deleteHistory(item)}>删除</button>
													</div>
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{:else}
								<p class="home-cover-empty">还没有本地收藏，导入后会自动保存在这里。</p>
							{/if}
						</section>
						<p class="home-cover-switcher-hint"><Icon icon="material-symbols:gradient" />图片与视频会自动裁切并适配屏幕。</p>
					</div>
				</aside>

				<main
					bind:this={orbit}
					class="home-cover-orbit"
					aria-label="可选封面插画"
					onpointermove={handleOrbitPointerMove}
					onpointerleave={handleOrbitPointerLeave}
					onfocusin={handleOrbitFocusIn}
					onfocusout={handleOrbitFocusOut}
				>
					<div class="home-cover-orbit-heading">
						<div>
							<span>JINGYUE SCENE LIBRARY</span>
							<strong>常用封面</strong>
						</div>
						<p><i aria-hidden="true"></i>点击卡片后自动应用并关闭</p>
					</div>
					<div class="home-cover-stars" aria-hidden="true">
						{#each Array(18) as _}<i></i>{/each}
					</div>
					<div class="home-cover-particle-field" aria-hidden="true">
						{#each Array(48) as _, index}<i style={particleFieldStyle(index)}></i>{/each}
					</div>
					<div class="home-cover-orbit-lines" aria-hidden="true"><i></i><i></i><i></i></div>
					{#each pageWallpaperAssets as asset, index}
						{@const favorite = getFavorite(index)}
						<button
							type="button"
							class="home-cover-option"
							class:is-active={selectedChoice === asset.id}
							aria-pressed={selectedChoice === asset.id}
							onclick={() => selectAsset(asset.id)}
							ondragover={(event) => event.preventDefault()}
							ondrop={(event) => assignFavorite(event, index)}
						>
							<span class="home-cover-option-number">0{index + 1}</span>
							<span class="home-cover-option-preview">
								{#if favorite?.type === "video" || (!favorite && asset.type === "video")}
									<video
										src={favorite?.previewUrl || (currentDevice === "mobile" ? asset.mobileUrl : asset.desktopUrl)}
										autoplay
										muted
										loop
										playsinline
										preload="metadata"
									></video>
									<Icon icon="material-symbols:play-circle-rounded" />
								{:else}
									<img src={favorite?.previewUrl || (currentDevice === "mobile" ? asset.mobileUrl : asset.desktopUrl)} alt="" loading={index === 0 ? "eager" : "lazy"} />
								{/if}
							</span>
							<span class="home-cover-option-copy">
								<small>SCENE 0{index + 1}</small>
								<strong>{asset.label}</strong>
							</span>
							<span class="home-cover-option-state">
								<Icon icon={selectedChoice === asset.id ? "material-symbols:check" : "fa7-solid:arrow-right"} />
							</span>
						</button>
					{/each}
					<div class="home-cover-orbit-center" aria-hidden="true">
						<div><Icon icon="material-symbols:gradient" /></div>
						<span>JINGYUE</span>
						<strong>{selectedName()}</strong>
						<small>SELECT YOUR SCENE</small>
					</div>
					<div
						bind:this={particleArrow}
						class="home-cover-particle-arrow"
						class:is-visible={particleArrowVisible}
						aria-hidden="true"
					>
						<span class="home-cover-particle-origin"></span>
						{#each Array(28) as _}<i></i>{/each}
						<span class="home-cover-particle-head"><span></span></span>
					</div>
					<div class="home-cover-orbit-actions">
						<button type="button" class="home-cover-orbit-reset" onclick={restoreCurrentDefault}>
							<Icon icon="fa7-solid:arrow-rotate-left" />恢复默认壁纸
						</button>
						<span><Icon icon="material-symbols:drag-pan-rounded" />支持拖入本地收藏替换预设</span>
					</div>
				</main>
			</div>
			<input
				bind:this={fileInput}
				type="file"
				hidden
				accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.m4v,.mov,.ogv"
				onchange={importMedia}
			/>
		</section>
	</div>
{/if}

<style>
	@import "./page-wallpaper-picker.css";

	@layer legacy {
	.wallpaper-picker {
		position: fixed;
		inset: 0;
		z-index: 2400;
		display: grid;
		padding: clamp(0.75rem, 2vw, 1.75rem);
		place-items: center;
		overscroll-behavior: contain;
	}

	.wallpaper-picker-backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		background: color-mix(in oklch, var(--page-bg) 72%, transparent);
		backdrop-filter: blur(1rem) saturate(0.9);
		cursor: default;
	}

	.wallpaper-picker-dialog {
		position: relative;
		display: grid;
		width: min(94vw, 92rem);
		max-height: 92dvh;
		overflow: hidden;
		border: 1px solid color-mix(in oklch, var(--primary) 28%, var(--line-divider));
		border-radius: 1.5rem;
		background: color-mix(in oklch, var(--page-bg) 94%, white);
		box-shadow: 0 2rem 6rem rgba(28, 55, 48, 0.22);
		color: var(--deep-text);
		animation: wallpaper-picker-enter 220ms cubic-bezier(0.22, 1, 0.36, 1);
		outline: none;
	}

	.wallpaper-picker-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.4rem;
		border-bottom: 1px solid color-mix(in oklch, var(--primary) 16%, var(--line-divider));
		background: color-mix(in oklch, var(--card-bg) 88%, transparent);
	}

	.wallpaper-picker-eyebrow,
	.wallpaper-section-heading span {
		color: var(--primary);
		font-size: 0.66rem;
		font-weight: 850;
		letter-spacing: 0.18em;
	}

	.wallpaper-picker-header h2 {
		margin: 0.18rem 0 0;
		font-size: clamp(1.25rem, 2vw, 1.85rem);
		line-height: 1.2;
	}

	.wallpaper-picker-header p {
		margin: 0.3rem 0 0;
		color: var(--meta-divider);
		font-size: 0.78rem;
	}

	.wallpaper-picker-header p strong {
		color: var(--primary);
	}

	.wallpaper-picker-close {
		display: grid;
		width: 2.7rem;
		height: 2.7rem;
		border: 1px solid color-mix(in oklch, var(--primary) 22%, var(--line-divider));
		border-radius: 999px;
		background: var(--card-bg);
		color: var(--deep-text);
		cursor: pointer;
		place-items: center;
		transition: color 180ms ease, background-color 180ms ease, border-color 180ms ease;
	}

	.wallpaper-picker-close:hover,
	.wallpaper-picker-close:focus-visible {
		border-color: var(--primary);
		background: color-mix(in oklch, var(--primary) 12%, var(--card-bg));
		color: var(--primary);
		outline: none;
	}

	.wallpaper-picker-close :global(svg) {
		width: 1.3rem;
		height: 1.3rem;
	}

	.wallpaper-picker-layout {
		display: grid;
		grid-template-columns: minmax(20rem, 25rem) minmax(0, 1fr);
		min-height: 0;
		overflow: hidden;
	}

	.wallpaper-picker-sidebar,
	.wallpaper-picker-content {
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.wallpaper-picker-sidebar {
		display: grid;
		align-content: start;
		gap: 0.9rem;
		padding: 1rem;
		border-right: 1px solid color-mix(in oklch, var(--primary) 15%, var(--line-divider));
		background: color-mix(in oklch, var(--primary) 5%, var(--card-bg));
	}

	.wallpaper-current,
	.wallpaper-theme-control,
	.wallpaper-apply-options {
		border: 1px solid color-mix(in oklch, var(--primary) 20%, var(--line-divider));
		border-radius: 1rem;
		background: color-mix(in oklch, var(--card-bg) 94%, transparent);
		padding: 0.85rem;
	}

	.wallpaper-current {
		display: grid;
		grid-template-columns: 6.2rem minmax(0, 1fr);
		gap: 0.8rem;
		align-items: center;
	}

	.wallpaper-current-preview {
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border-radius: 0.7rem;
		background: color-mix(in oklch, var(--primary) 8%, var(--page-bg));
	}

	.wallpaper-current-preview img,
	.wallpaper-current-preview video,
	.wallpaper-card-preview img,
	.wallpaper-card-preview video,
	.wallpaper-history-item img,
	.wallpaper-history-item video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.wallpaper-current > div:last-child {
		display: grid;
		min-width: 0;
	}

	.wallpaper-current > div:last-child span {
		color: var(--meta-divider);
		font-size: 0.68rem;
	}

	.wallpaper-current > div:last-child strong {
		overflow: hidden;
		margin-top: 0.18rem;
		font-size: 0.86rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.wallpaper-theme-control header,
	.wallpaper-sync-toolbar,
	.wallpaper-section-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.wallpaper-theme-control header span {
		display: flex;
		align-items: center;
		gap: 0.42rem;
		font-size: 0.78rem;
		font-weight: 750;
	}

	.wallpaper-theme-control header :global(svg) {
		width: 1rem;
		height: 1rem;
		color: var(--ui-icon-color);
	}

	.wallpaper-theme-control output {
		border-radius: 999px;
		background: color-mix(in oklch, var(--primary) 12%, var(--card-bg));
		padding: 0.25rem 0.55rem;
		color: var(--primary);
		font-size: 0.72rem;
		font-weight: 800;
	}

	.wallpaper-theme-control input[type="range"] {
		width: 100%;
		margin: 0.75rem 0 0.5rem;
		accent-color: var(--primary);
		cursor: pointer;
	}

	.wallpaper-theme-control > button {
		display: inline-flex;
		align-items: center;
		gap: 0.32rem;
		border: 0;
		background: transparent;
		color: var(--meta-divider);
		font-size: 0.68rem;
		cursor: pointer;
	}

	.wallpaper-theme-control > button:hover,
	.wallpaper-theme-control > button:focus-visible {
		color: var(--primary);
		outline: none;
	}

	.wallpaper-apply-options h3 {
		margin: 0 0 0.6rem;
		font-size: 0.86rem;
	}

	.wallpaper-apply-options > label {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-top: 0.45rem;
		border: 1px solid transparent;
		border-radius: 0.75rem;
		padding: 0.65rem;
		cursor: pointer;
		transition: border-color 160ms ease, background-color 160ms ease;
	}

	.wallpaper-apply-options > label.is-selected {
		border-color: color-mix(in oklch, var(--primary) 34%, transparent);
		background: color-mix(in oklch, var(--primary) 9%, transparent);
	}

	.wallpaper-apply-options input {
		accent-color: var(--primary);
	}

	.wallpaper-apply-options label span {
		display: grid;
	}

	.wallpaper-apply-options label strong {
		font-size: 0.75rem;
	}

	.wallpaper-apply-options label small {
		margin-top: 0.12rem;
		color: var(--meta-divider);
		font-size: 0.64rem;
	}

	.wallpaper-sync-toolbar {
		margin-top: 0.8rem;
		font-size: 0.7rem;
		font-weight: 750;
	}

	.wallpaper-sync-toolbar div {
		display: flex;
		gap: 0.35rem;
	}

	.wallpaper-sync-toolbar button {
		border: 0;
		background: transparent;
		color: var(--primary);
		font-size: 0.66rem;
		cursor: pointer;
	}

	.wallpaper-page-options {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.38rem;
		margin-top: 0.55rem;
	}

	.wallpaper-page-options label {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		border-radius: 0.55rem;
		background: color-mix(in oklch, var(--primary) 6%, transparent);
		padding: 0.45rem;
		font-size: 0.68rem;
		cursor: pointer;
	}

	.wallpaper-picker-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.55rem;
	}

	.wallpaper-picker-actions button,
	.wallpaper-import {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.42rem;
		min-height: 2.65rem;
		border-radius: 0.75rem;
		font-size: 0.75rem;
		font-weight: 800;
		cursor: pointer;
		transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
	}

	.wallpaper-picker-actions :global(svg),
	.wallpaper-import :global(svg) {
		width: 1.05rem;
		height: 1.05rem;
	}

	.wallpaper-apply {
		border: 1px solid var(--primary);
		background: var(--primary);
		color: var(--page-bg);
	}

	.wallpaper-apply:hover,
	.wallpaper-apply:focus-visible {
		background: color-mix(in oklch, var(--primary) 84%, black);
		outline: none;
	}

	.wallpaper-reset {
		border: 1px solid color-mix(in oklch, var(--primary) 24%, var(--line-divider));
		background: var(--card-bg);
		color: var(--deep-text);
	}

	.wallpaper-reset:hover,
	.wallpaper-reset:focus-visible {
		border-color: var(--primary);
		color: var(--primary);
		outline: none;
	}

	.wallpaper-feedback {
		min-height: 1rem;
		color: var(--primary);
		font-size: 0.68rem;
		line-height: 1.4;
	}

	.wallpaper-feedback .is-error {
		color: #c24151;
	}

	.wallpaper-picker-content {
		display: grid;
		align-content: start;
		gap: 1.35rem;
		padding: 1.25rem;
	}

	.wallpaper-section-heading h3 {
		margin: 0.15rem 0 0;
		font-size: 1rem;
	}

	.wallpaper-section-heading p {
		margin: 0;
		color: var(--meta-divider);
		font-size: 0.68rem;
	}

	.wallpaper-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.8rem;
		margin-top: 0.75rem;
	}

	.wallpaper-card {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.65rem;
		min-width: 0;
		overflow: hidden;
		border: 1px solid color-mix(in oklch, var(--primary) 18%, var(--line-divider));
		border-radius: 1rem;
		background: var(--card-bg);
		padding: 0.55rem;
		text-align: left;
		cursor: pointer;
		transition: border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease;
	}

	.wallpaper-card:hover,
	.wallpaper-card:focus-visible {
		border-color: color-mix(in oklch, var(--primary) 54%, var(--line-divider));
		box-shadow: 0 0.75rem 1.8rem color-mix(in oklch, var(--primary) 12%, transparent);
		outline: none;
	}

	.wallpaper-card.is-selected {
		border-color: var(--primary);
		background: color-mix(in oklch, var(--primary) 9%, var(--card-bg));
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--primary) 16%, transparent);
	}

	.wallpaper-card-preview {
		grid-column: 1 / -1;
		position: relative;
		aspect-ratio: 16 / 8;
		overflow: hidden;
		border-radius: 0.7rem;
		background: color-mix(in oklch, var(--primary) 8%, var(--page-bg));
	}

	.wallpaper-card-preview :global(svg),
	.wallpaper-history-item span :global(svg) {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 2rem;
		height: 2rem;
		color: white;
		filter: drop-shadow(0 0.2rem 0.5rem rgba(0, 0, 0, 0.35));
		transform: translate(-50%, -50%);
	}

	.wallpaper-card-meta {
		display: grid;
		min-width: 0;
		padding: 0.1rem 0.25rem 0.2rem;
	}

	.wallpaper-card-meta strong {
		font-size: 0.76rem;
	}

	.wallpaper-card-meta small {
		margin-top: 0.12rem;
		color: var(--meta-divider);
		font-size: 0.62rem;
	}

	.wallpaper-card-check {
		display: grid;
		align-self: center;
		width: 1.35rem;
		height: 1.35rem;
		border: 1px solid color-mix(in oklch, var(--primary) 25%, var(--line-divider));
		border-radius: 999px;
		color: transparent;
		place-items: center;
	}

	.wallpaper-card.is-selected .wallpaper-card-check {
		border-color: var(--primary);
		background: var(--primary);
		color: var(--page-bg);
	}

	.wallpaper-card-check :global(svg) {
		width: 0.8rem;
		height: 0.8rem;
	}

	.wallpaper-local-library {
		border-top: 1px solid color-mix(in oklch, var(--primary) 14%, var(--line-divider));
		padding-top: 1.2rem;
	}

	.wallpaper-import {
		min-height: 2.35rem;
		border: 1px solid color-mix(in oklch, var(--primary) 42%, transparent);
		background: color-mix(in oklch, var(--primary) 12%, var(--card-bg));
		padding: 0.55rem 0.8rem;
		color: var(--primary);
	}

	.wallpaper-import:hover,
	.wallpaper-import:focus-visible {
		background: color-mix(in oklch, var(--primary) 18%, var(--card-bg));
		outline: none;
	}

	.wallpaper-import:disabled {
		cursor: wait;
		opacity: 0.62;
	}

	.wallpaper-history {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.65rem;
		margin-top: 0.75rem;
	}

	.wallpaper-history-item {
		position: relative;
		min-width: 0;
	}

	.wallpaper-history-item > button:first-child {
		display: grid;
		width: 100%;
		min-width: 0;
		border: 1px solid color-mix(in oklch, var(--primary) 16%, var(--line-divider));
		border-radius: 0.8rem;
		background: var(--card-bg);
		padding: 0.35rem;
		color: var(--deep-text);
		text-align: left;
		cursor: grab;
	}

	.wallpaper-history-item > button:first-child:hover,
	.wallpaper-history-item > button:first-child:focus-visible,
	.wallpaper-history-item > button:first-child.is-selected {
		border-color: var(--primary);
		outline: none;
	}

	.wallpaper-history-item > button:first-child > span {
		position: relative;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border-radius: 0.55rem;
	}

	.wallpaper-history-item > button:first-child > strong {
		overflow: hidden;
		padding: 0.45rem 0.2rem 0.25rem;
		font-size: 0.65rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.wallpaper-history-delete {
		position: absolute;
		top: 0.55rem;
		right: 0.55rem;
		display: grid;
		width: 1.55rem;
		height: 1.55rem;
		border: 1px solid rgba(255, 255, 255, 0.58);
		border-radius: 999px;
		background: rgba(20, 28, 36, 0.68);
		color: white;
		cursor: pointer;
		place-items: center;
	}

	.wallpaper-history-delete:hover,
	.wallpaper-history-delete:focus-visible {
		background: #b73f4e;
		outline: none;
	}

	.wallpaper-history-delete :global(svg) {
		width: 0.9rem;
		height: 0.9rem;
	}

	.wallpaper-delete-confirm {
		position: absolute;
		inset: 0;
		z-index: 3;
		display: grid;
		align-content: center;
		gap: 0.55rem;
		border-radius: 0.8rem;
		background: color-mix(in oklch, var(--card-bg) 92%, transparent);
		padding: 0.7rem;
		text-align: center;
		backdrop-filter: blur(0.65rem);
	}

	.wallpaper-delete-confirm strong {
		font-size: 0.7rem;
	}

	.wallpaper-delete-confirm div {
		display: flex;
		justify-content: center;
		gap: 0.35rem;
	}

	.wallpaper-delete-confirm button {
		border: 1px solid var(--line-divider);
		border-radius: 0.45rem;
		background: var(--card-bg);
		padding: 0.32rem 0.48rem;
		color: var(--deep-text);
		font-size: 0.62rem;
		cursor: pointer;
	}

	.wallpaper-delete-confirm button.is-danger {
		border-color: #c45a66;
		background: #c45a66;
		color: white;
	}

	.wallpaper-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.7rem;
		width: 100%;
		margin-top: 0.75rem;
		border: 1px dashed color-mix(in oklch, var(--primary) 34%, var(--line-divider));
		border-radius: 0.9rem;
		background: color-mix(in oklch, var(--primary) 5%, transparent);
		padding: 1.2rem;
		color: var(--deep-text);
		cursor: pointer;
	}

	.wallpaper-empty :global(svg) {
		width: 1.7rem;
		height: 1.7rem;
		color: var(--ui-icon-color);
	}

	.wallpaper-empty span {
		display: grid;
		text-align: left;
	}

	.wallpaper-empty strong {
		font-size: 0.76rem;
	}

	.wallpaper-empty small {
		margin-top: 0.12rem;
		color: var(--meta-divider);
		font-size: 0.64rem;
	}

	:global(html.dark) .wallpaper-picker-backdrop {
		background: rgba(6, 12, 20, 0.72);
	}

	:global(html.dark) .wallpaper-picker-dialog {
		background: color-mix(in oklch, var(--page-bg) 92%, #111b26);
		box-shadow: 0 2rem 6rem rgba(0, 0, 0, 0.48);
	}

	@media (max-width: 900px) {
		.wallpaper-picker-dialog {
			overflow-y: auto;
		}

		.wallpaper-picker-layout {
			display: block;
			overflow: visible;
		}

		.wallpaper-picker-sidebar,
		.wallpaper-picker-content {
			overflow: visible;
		}

		.wallpaper-picker-sidebar {
			border-right: 0;
			border-bottom: 1px solid color-mix(in oklch, var(--primary) 15%, var(--line-divider));
		}
	}

	@media (max-width: 560px) {
		.wallpaper-picker {
			padding: 0;
		}

		.wallpaper-picker-dialog {
			width: 100vw;
			max-height: 100dvh;
			border: 0;
			border-radius: 0;
		}

		.wallpaper-picker-header,
		.wallpaper-picker-content {
			padding: 1rem;
		}

		.wallpaper-grid,
		.wallpaper-history {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.wallpaper-page-options {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.wallpaper-picker-actions {
			grid-template-columns: 1fr;
		}

		.wallpaper-section-heading {
			align-items: flex-start;
			flex-direction: column;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.wallpaper-picker-dialog {
			animation: none;
		}
	}

	@keyframes wallpaper-picker-enter {
		from {
			opacity: 0;
			transform: translateY(0.8rem) scale(0.985);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	/* 保留原版“动态封面轨道”视觉，新增功能只嵌入左侧控制区。 */
	.home-cover-switcher {
		position: fixed;
		inset: 0;
		z-index: 2400;
		display: grid;
		place-items: center;
		padding: 1rem;
	}

	.home-cover-switcher-backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		background:
			radial-gradient(circle at 20% 18%, color-mix(in oklch, var(--primary) 28%, transparent), transparent 36%),
			radial-gradient(circle at 78% 74%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 38%),
			rgba(8, 10, 27, 0.86);
		cursor: pointer;
		backdrop-filter: blur(1.15rem) saturate(0.9);
	}

	.home-cover-switcher-dialog {
		position: relative;
		width: min(96rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 2rem);
		overflow: hidden;
		border: 1px solid color-mix(in oklch, var(--primary) 36%, rgba(255, 255, 255, 0.12));
		border-radius: 1.8rem;
		background:
			linear-gradient(145deg, color-mix(in oklch, var(--primary) 17%, rgba(27, 34, 55, 0.97)), rgba(15, 22, 46, 0.98)),
			#15172f;
		box-shadow: 0 2rem 7rem rgba(3, 5, 22, 0.58), inset 0 1px 0 rgba(255, 255, 255, 0.08);
		padding: 1.2rem;
		color: #f8f7ff;
		animation: original-cover-dialog-enter 360ms cubic-bezier(0.22, 0.61, 0.36, 1);
		outline: none;
		backdrop-filter: blur(1.5rem) saturate(1.08);
	}

	.home-cover-switcher-layout {
		display: grid;
		grid-template-columns: minmax(23rem, 26rem) minmax(0, 1fr);
		gap: 1.2rem;
		height: min(88dvh, 51rem);
		min-height: 38rem;
	}

	.home-cover-switcher-sidebar {
		position: relative;
		z-index: 4;
		display: flex;
		min-height: 0;
		justify-content: space-between;
		flex-direction: column;
		gap: 1.25rem;
		overflow: hidden;
		border: 1px solid color-mix(in oklch, var(--primary) 28%, rgba(255, 255, 255, 0.08));
		border-radius: 1.3rem;
		background:
			linear-gradient(180deg, color-mix(in oklch, var(--primary) 16%, transparent), color-mix(in oklch, var(--primary) 5%, transparent)),
			rgba(24, 25, 55, 0.74);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
		padding: 1.6rem;
		backdrop-filter: blur(1rem);
	}

	.home-cover-switcher-heading {
		display: flex;
		align-items: flex-start;
		flex-direction: column;
		flex: 0 0 auto;
	}

	.home-cover-switcher-heading p,
	.home-cover-switcher-heading h2,
	.home-cover-switcher-description,
	.home-cover-switcher-hint {
		margin: 0;
	}

	.home-cover-switcher-heading > p:first-child {
		color: rgba(216, 205, 255, 0.78);
		font-size: 0.72rem;
		font-weight: 800;
		letter-spacing: 0.2em;
	}

	.home-cover-switcher-heading h2 {
		margin-top: 0.7rem;
		font-size: clamp(1.9rem, 2.4vw, 2.35rem);
		font-weight: 800;
		line-height: 1.18;
		white-space: nowrap;
	}

	.home-cover-favorites-note {
		display: inline-flex;
		align-items: center;
		max-width: 100%;
		gap: 0.35rem;
		margin-top: 1rem;
		overflow: hidden;
		border: 1px solid rgba(196, 181, 253, 0.22);
		border-radius: 999px;
		background: rgba(139, 92, 246, 0.12);
		padding: 0.42rem 0.7rem;
		color: rgba(232, 226, 255, 0.82);
		font-size: 0.72rem;
		font-weight: 750;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.home-cover-favorites-note :global(svg) {
		width: 0.85rem;
		height: 0.85rem;
		color: #c4b5fd;
	}

	.home-cover-favorites-note em {
		border: 1px solid currentColor;
		border-radius: 999px;
		padding: 0.15rem 0.4rem;
		font-size: 0.62rem;
		font-style: normal;
		font-weight: 800;
		line-height: 1;
		opacity: 0.76;
	}

	.home-cover-switcher-description {
		margin-top: 0.8rem;
		color: rgba(222, 224, 246, 0.72);
		font-size: 0.82rem;
		line-height: 1.65;
	}

	.home-cover-switcher-utilities {
		display: grid;
		min-height: 0;
		gap: 0.72rem;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding-right: 0.2rem;
		scrollbar-width: thin;
	}

	.home-cover-theme-control,
	.home-cover-apply-control,
	.home-cover-local-library {
		display: grid;
		gap: 0.7rem;
		border: 1px solid color-mix(in oklch, var(--primary) 25%, rgba(255, 255, 255, 0.08));
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.055);
		padding: 0.9rem;
	}

	.home-cover-theme-heading,
	.home-cover-theme-heading > span,
	.home-cover-theme-presets,
	.home-cover-apply-heading,
	.home-cover-sync-toolbar,
	.home-cover-local-heading,
	.home-cover-local-heading > div {
		display: flex;
		align-items: center;
	}

	.home-cover-theme-heading,
	.home-cover-apply-heading,
	.home-cover-sync-toolbar,
	.home-cover-local-heading {
		justify-content: space-between;
		gap: 0.5rem;
	}

	.home-cover-theme-heading > span,
	.home-cover-apply-heading strong,
	.home-cover-local-heading strong {
		gap: 0.42rem;
		font-size: 0.78rem;
		font-weight: 800;
	}

	.home-cover-theme-heading :global(svg),
	.home-cover-local-heading :global(svg) {
		width: 1.05rem;
		height: 1.05rem;
		color: var(--ui-icon-color);
	}

	.home-cover-theme-heading output {
		min-width: 3.25rem;
		border-radius: 999px;
		background: color-mix(in oklch, var(--primary) 20%, transparent);
		padding: 0.32rem 0.55rem;
		color: color-mix(in oklch, var(--primary) 70%, white);
		font-size: 0.72rem;
		font-weight: 850;
		text-align: center;
	}

	.home-cover-theme-control input[type="range"] {
		width: 100%;
		height: 0.5rem;
		appearance: none;
		border-radius: 999px;
		background: linear-gradient(90deg, #f2a2b7, #e6c16e, #69d3b2, #6ec9e9, #aaa4f5, #ef9fc7);
		cursor: pointer;
		touch-action: none;
	}

	.home-cover-theme-control input[type="range"]::-webkit-slider-thumb {
		width: 0.82rem;
		height: 1rem;
		appearance: none;
		border: 2px solid rgba(255, 255, 255, 0.92);
		border-radius: 0.28rem;
		background: var(--primary);
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.12);
	}

	.home-cover-theme-control input[type="range"]::-moz-range-thumb {
		width: 0.7rem;
		height: 0.9rem;
		border: 2px solid rgba(255, 255, 255, 0.92);
		border-radius: 0.28rem;
		background: var(--primary);
	}

	.home-cover-theme-presets {
		gap: 0.5rem;
	}

	.home-cover-theme-presets > button {
		width: 1.35rem;
		height: 1.35rem;
		border: 2px solid transparent;
		border-radius: 50%;
		background: oklch(0.72 0.16 var(--preset-hue));
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.16);
		cursor: pointer;
	}

	.home-cover-theme-presets > button[aria-pressed="true"] {
		border-color: white;
		box-shadow: 0 0 0 2px var(--primary);
	}

	.home-cover-local-heading small,
	.home-cover-empty,
	.home-cover-switcher-hint {
		color: rgba(222, 224, 246, 0.66);
		font-size: 0.66rem;
	}

	.home-cover-local-heading > div {
		align-items: flex-start;
		flex-direction: column;
		gap: 0.14rem;
	}

	.home-cover-apply-modes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.55rem;
	}

	.home-cover-apply-modes label {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		min-width: 0;
		border: 1px solid color-mix(in oklch, var(--primary) 20%, rgba(255, 255, 255, 0.08));
		border-radius: 0.78rem;
		background: rgba(255, 255, 255, 0.045);
		padding: 0.62rem 0.68rem;
		cursor: pointer;
		transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
	}

	.home-cover-apply-modes label.is-selected {
		border-color: color-mix(in oklch, var(--primary) 58%, transparent);
		background: color-mix(in oklch, var(--primary) 20%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--primary) 16%, transparent);
		color: color-mix(in oklch, var(--primary) 65%, white);
	}

	.home-cover-apply-modes input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.home-cover-apply-modes label > :global(svg) {
		width: 1.1rem;
		height: 1.1rem;
		flex: 0 0 auto;
	}

	.home-cover-apply-modes label > span {
		display: grid;
		min-width: 0;
		gap: 0.08rem;
	}

	.home-cover-apply-modes label strong {
		font-size: 0.66rem;
		font-weight: 820;
		white-space: nowrap;
	}

	.home-cover-apply-modes label small {
		overflow: hidden;
		color: rgba(222, 224, 246, 0.58);
		font-size: 0.56rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.home-cover-page-options label {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 0.28rem;
		border: 1px solid transparent;
		border-radius: 0.62rem;
		background: rgba(255, 255, 255, 0.045);
		padding: 0.38rem;
		font-size: 0.66rem;
		font-weight: 750;
		cursor: pointer;
	}

	.home-cover-page-options label:has(input:checked) {
		border-color: color-mix(in oklch, var(--primary) 58%, transparent);
		background: color-mix(in oklch, var(--primary) 20%, transparent);
		color: color-mix(in oklch, var(--primary) 65%, white);
	}

	.home-cover-page-options input {
		accent-color: var(--primary);
	}

	.home-cover-sync-toolbar span {
		font-size: 0.64rem;
		font-weight: 750;
	}

	.home-cover-sync-toolbar div {
		display: flex;
		gap: 0.45rem;
	}

	.home-cover-sync-toolbar button {
		border: 0;
		background: transparent;
		color: color-mix(in oklch, var(--primary) 68%, white);
		font-size: 0.62rem;
		cursor: pointer;
	}

	.home-cover-page-options {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.34rem;
	}

	.home-cover-local-heading > button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		min-height: 2.25rem;
		border: 1px solid color-mix(in oklch, var(--primary) 34%, rgba(255, 255, 255, 0.12));
		border-radius: 0.68rem;
		background: rgba(255, 255, 255, 0.055);
		padding: 0.45rem 0.62rem;
		color: inherit;
		font-size: 0.66rem;
		font-weight: 800;
		cursor: pointer;
	}

	.home-cover-local-heading > button :global(svg) {
		width: 0.9rem;
		height: 0.9rem;
	}

	.home-cover-feedback {
		min-height: 0.8rem;
		color: color-mix(in oklch, var(--primary) 65%, white);
		font-size: 0.63rem;
		line-height: 1.35;
	}

	.home-cover-feedback .is-error {
		color: #fda4af;
	}

	.home-cover-history {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding: 0.1rem 0 0.25rem;
		overscroll-behavior-inline: contain;
		scrollbar-width: thin;
	}

	.home-cover-history-item {
		position: relative;
		flex: 0 0 5.4rem;
	}

	.home-cover-history-item > button:first-child {
		display: grid;
		width: 100%;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.12);
		border-radius: 0.68rem;
		background: rgba(255, 255, 255, 0.055);
		padding: 0.28rem;
		color: inherit;
		text-align: left;
		cursor: grab;
	}

	.home-cover-history-item > button:first-child.is-selected {
		border-color: var(--primary);
	}

	.home-cover-history-item > button:first-child > span {
		position: relative;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border-radius: 0.48rem;
	}

	.home-cover-history img,
	.home-cover-history video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.home-cover-history-item > button:first-child > span :global(svg) {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 1.35rem;
		height: 1.35rem;
		color: white;
		transform: translate(-50%, -50%);
	}

	.home-cover-history-item > button:first-child > strong {
		overflow: hidden;
		padding: 0.34rem 0.15rem 0.14rem;
		font-size: 0.58rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.home-cover-history-delete {
		position: absolute;
		right: 0.38rem;
		top: 0.38rem;
		display: grid;
		width: 1.25rem;
		height: 1.25rem;
		border: 1px solid rgba(255, 255, 255, 0.45);
		border-radius: 50%;
		background: rgba(10, 15, 32, 0.72);
		color: white;
		cursor: pointer;
		place-items: center;
	}

	.home-cover-history-delete :global(svg) {
		width: 0.7rem;
		height: 0.7rem;
	}

	.home-cover-delete-confirm {
		position: absolute;
		inset: 0;
		z-index: 3;
		display: grid;
		align-content: center;
		gap: 0.35rem;
		border: 1px solid #efc55b;
		border-radius: 0.68rem;
		background: linear-gradient(135deg, #fff8d9 0%, #fff 100%);
		padding: 0.35rem;
		color: #4e3d05;
		font-size: 0.58rem;
		font-weight: 700;
		text-align: center;
		backdrop-filter: blur(0.6rem);
		box-shadow: 0 0.5rem 1.2rem rgb(100 74 0 / 18%);
	}

	.home-cover-delete-confirm div {
		display: flex;
		justify-content: center;
		gap: 0.25rem;
	}

	.home-cover-delete-confirm button {
		border: 1px solid #dbc46f;
		border-radius: 0.35rem;
		background: rgb(255 255 255 / 82%);
		padding: 0.2rem 0.3rem;
		color: #66500a;
		font-size: 0.55rem;
		font-weight: 700;
		cursor: pointer;
	}

	.home-cover-delete-confirm button.is-danger {
		border-color: #e14d69;
		background: #e14d69;
		color: #fff;
	}

	:global(html.dark) .home-cover-delete-confirm {
		border: 0;
		background: rgba(16, 22, 43, 0.94);
		color: inherit;
		box-shadow: none;
	}

	:global(html.dark) .home-cover-delete-confirm button {
		border-color: rgba(255, 255, 255, 0.2);
		background: transparent;
		color: inherit;
	}

	:global(html.dark) .home-cover-delete-confirm button.is-danger {
		border-color: #be4455;
		background: #be4455;
		color: inherit;
	}

	.home-cover-switcher-close {
		position: absolute;
		right: 1.65rem;
		top: 1.65rem;
		z-index: 20;
		display: grid;
		width: 2.6rem;
		height: 2.6rem;
		border: 1px solid rgba(196, 181, 253, 0.28);
		border-radius: 999px;
		background: rgba(35, 35, 72, 0.78);
		color: white;
		cursor: pointer;
		place-items: center;
		transition: background-color 180ms ease, transform 180ms ease;
	}

	.home-cover-switcher-close:hover,
	.home-cover-switcher-close:focus-visible {
		background: rgba(139, 92, 246, 0.28);
		outline: 2px solid #c4b5fd;
		outline-offset: 2px;
		transform: rotate(6deg);
	}

	.home-cover-switcher-close :global(svg) {
		width: 1.2rem;
		height: 1.2rem;
	}

	.home-cover-orbit {
		position: relative;
		height: 100%;
		overflow: hidden;
		border: 1px solid color-mix(in oklch, var(--primary) 30%, transparent);
		border-radius: 1.3rem;
		background:
			radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--primary) 24%, transparent), transparent 34%),
			radial-gradient(circle at 76% 28%, color-mix(in oklch, var(--primary) 12%, transparent), transparent 32%),
			linear-gradient(145deg, rgba(34, 35, 73, 0.94), rgba(12, 19, 43, 0.98));
		isolation: isolate;
	}

	.home-cover-orbit-lines,
	.home-cover-orbit-lines i {
		position: absolute;
		left: 50%;
		top: 50%;
		border: 1px solid color-mix(in oklch, var(--primary) 30%, transparent);
		border-radius: 50%;
		transform: translate(-50%, -50%);
		pointer-events: none;
	}

	.home-cover-orbit-lines {
		width: min(38vw, 34rem);
		height: min(46vh, 24rem);
		border-style: dashed;
		animation: home-cover-orbit-spin 32s linear infinite;
	}

	.home-cover-orbit-lines i:nth-child(1) {
		width: 88%;
		height: 150%;
		transform: translate(-50%, -50%) rotate(34deg);
	}

	.home-cover-orbit-lines i:nth-child(2) {
		width: 108%;
		height: 68%;
		transform: translate(-50%, -50%) rotate(-24deg);
	}

	.home-cover-orbit-lines i:nth-child(3) {
		width: 58%;
		height: 94%;
		border-style: dashed;
	}

	.home-cover-orbit-center {
		position: absolute;
		left: 50%;
		top: 50%;
		z-index: 4;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		width: clamp(10rem, 15vw, 14.5rem);
		aspect-ratio: 1;
		border: 1px solid color-mix(in oklch, var(--primary) 48%, rgba(255, 255, 255, 0.12));
		border-radius: 50%;
		background: radial-gradient(circle, color-mix(in oklch, var(--primary) 27%, transparent), rgba(18, 25, 55, 0.78));
		box-shadow: 0 0 4rem color-mix(in oklch, var(--primary) 28%, transparent);
		transform: translate(-50%, -50%);
		backdrop-filter: blur(0.8rem);
	}

	.home-cover-orbit-center :global(svg) {
		width: 1.8rem;
		height: 1.8rem;
		color: #c4b5fd;
	}

	.home-cover-orbit-center span {
		margin-top: 0;
		font-size: 1rem;
		font-weight: 900;
		letter-spacing: 0.22em;
	}

	.home-cover-orbit-center small {
		margin-top: 0.18rem;
		color: rgba(222, 224, 246, 0.62);
		font-size: 0.6rem;
		font-weight: 800;
		letter-spacing: 0.16em;
	}

	.home-cover-option {
		position: absolute;
		z-index: 5;
		width: clamp(11rem, 15vw, 15rem);
		border: 1px solid color-mix(in oklch, var(--primary) 28%, rgba(255, 255, 255, 0.08));
		border-radius: 1rem;
		background: rgba(31, 32, 69, 0.78);
		box-shadow: 0 1rem 2.5rem rgba(3, 5, 22, 0.38);
		padding: 0.52rem;
		color: white;
		cursor: pointer;
		backdrop-filter: blur(0.65rem);
		transition: border-color 220ms ease, box-shadow 220ms ease, transform 320ms cubic-bezier(0.22, 0.61, 0.36, 1);
	}

	.home-cover-option:nth-of-type(1) {
		left: 50%;
		top: 2%;
		transform: translateX(-50%);
	}

	.home-cover-option:nth-of-type(2) {
		right: 2.5%;
		top: 50%;
		transform: translateY(-50%);
	}

	.home-cover-option:nth-of-type(3) {
		left: 50%;
		bottom: 1%;
		transform: translateX(-50%);
	}

	.home-cover-option:nth-of-type(4) {
		left: 2.5%;
		top: 50%;
		transform: translateY(-50%);
	}

	.home-cover-option:hover,
	.home-cover-option:focus-visible {
		border-color: color-mix(in oklch, var(--primary) 75%, white);
		box-shadow: 0 1.2rem 3rem rgba(3, 5, 22, 0.46), 0 0 2rem color-mix(in oklch, var(--primary) 32%, transparent);
		outline: none;
	}

	.home-cover-option.is-active {
		border-color: var(--primary);
		background: color-mix(in oklch, var(--primary) 28%, rgba(24, 30, 58, 0.78));
		box-shadow: 0 1rem 2.5rem rgba(3, 5, 22, 0.42), 0 0 0 2px color-mix(in oklch, var(--primary) 18%, transparent), 0 0 2rem color-mix(in oklch, var(--primary) 24%, transparent);
	}

	.home-cover-option:nth-of-type(1):hover,
	.home-cover-option:nth-of-type(3):hover {
		transform: translateX(-50%) scale(1.045);
	}

	.home-cover-option:nth-of-type(2):hover,
	.home-cover-option:nth-of-type(4):hover {
		transform: translateY(-50%) scale(1.045);
	}

	.home-cover-option-preview {
		position: relative;
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border-radius: 0.72rem;
		background: rgba(10, 16, 34, 0.7);
	}

	.home-cover-option-preview img,
	.home-cover-option-preview video {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.home-cover-option-preview :global(svg) {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 2rem;
		height: 2rem;
		color: white;
		transform: translate(-50%, -50%);
	}

	.home-cover-option > span:last-child {
		display: block;
		padding: 0.65rem 0.42rem 0.28rem;
		color: rgba(239, 235, 255, 0.84);
		font-size: 0.68rem;
		font-weight: 850;
		letter-spacing: 0.13em;
	}

	.home-cover-particle-arrow {
		--particle-length: 9.4rem;
		--particle-angle: 0rad;
		position: absolute;
		left: 50%;
		top: 50%;
		z-index: 12;
		display: none;
		align-items: center;
		justify-content: flex-end;
		width: var(--particle-length);
		height: 3.2rem;
		margin-top: 0;
		opacity: 0;
		color: var(--scene-cyan, #22d3ee);
		filter: drop-shadow(0 0 0.6rem color-mix(in oklch, var(--scene-cyan, #22d3ee) 52%, transparent));
		transform-origin: left center;
		pointer-events: none;
		transform: translateY(-50%) rotate(var(--particle-angle)) scaleX(0.88);
		transition: opacity 220ms ease, transform 55ms linear;
		will-change: width, transform, opacity;
	}

	.home-cover-particle-arrow.is-visible {
		opacity: 1;
		transform: translateY(-50%) rotate(var(--particle-angle)) scaleX(1);
	}

	.home-cover-orbit-actions {
		position: absolute;
		inset: auto 1rem 1rem;
		z-index: 18;
		display: flex;
		align-items: center;
		justify-content: space-between;
		pointer-events: none;
	}

	.home-cover-orbit-actions button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.42rem;
		min-height: 2.55rem;
		border: 1px solid color-mix(in oklch, var(--primary) 38%, rgba(255, 255, 255, 0.14));
		border-radius: 0.82rem;
		background: rgba(24, 28, 58, 0.78);
		box-shadow: 0 0.75rem 2rem rgba(3, 5, 22, 0.22);
		padding: 0.62rem 0.9rem;
		color: rgba(244, 242, 255, 0.88);
		font-size: 0.7rem;
		font-weight: 820;
		cursor: pointer;
		pointer-events: auto;
		backdrop-filter: blur(0.75rem);
		transition: border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease;
	}

	.home-cover-orbit-actions button:hover,
	.home-cover-orbit-actions button:focus-visible {
		border-color: color-mix(in oklch, var(--primary) 72%, white);
		box-shadow: 0 0.9rem 2.3rem rgba(3, 5, 22, 0.28), 0 0 1.5rem color-mix(in oklch, var(--primary) 22%, transparent);
		outline: none;
	}

	.home-cover-orbit-actions :global(svg) {
		width: 1rem;
		height: 1rem;
	}

	.home-cover-particle-arrow::before {
		content: "";
		position: absolute;
		left: 0.45rem;
		right: 1.35rem;
		height: 1rem;
		border-radius: 999px;
		background:
			linear-gradient(90deg, transparent 0%, var(--scene-cyan, #22d3ee) 18%, var(--scene-violet, #8b5cf6) 62%, var(--scene-pink, #ec4899) 100%) center / 100% 2px no-repeat,
			linear-gradient(90deg, transparent 2%, color-mix(in oklch, var(--scene-cyan, #22d3ee) 34%, transparent), color-mix(in oklch, var(--scene-pink, #ec4899) 20%, transparent)) center / 100% 0.7rem no-repeat;
		box-shadow: none;
		filter: drop-shadow(0 0 0.38rem var(--scene-cyan, #22d3ee));
		animation: home-cover-energy-breathe 1.7s ease-in-out infinite;
	}

	.home-cover-particle-arrow::after {
		content: "";
		position: absolute;
		left: 12%;
		right: 1.55rem;
		height: 1.15rem;
		background:
			radial-gradient(circle at 16% 32%, var(--scene-gold, #facc15) 0 0.08rem, transparent 0.11rem),
			radial-gradient(circle at 48% 72%, var(--scene-pink, #ec4899) 0 0.09rem, transparent 0.13rem),
			radial-gradient(circle at 78% 38%, var(--scene-cyan, #22d3ee) 0 0.07rem, transparent 0.11rem);
		opacity: 0.76;
		animation: home-cover-energy-sparks 1.25s ease-in-out infinite;
	}

	.home-cover-particle-arrow i {
		position: absolute;
		left: var(--particle-left, 10%);
		top: 50%;
		width: var(--particle-size, 0.18rem);
		height: var(--particle-size, 0.18rem);
		border-radius: 999px;
		background: currentColor;
		box-shadow: 0 0 0.34rem currentColor;
		opacity: 0;
		animation: home-cover-particle-flow 1.5s ease-out var(--particle-delay, 0s) infinite;
	}

	.home-cover-particle-arrow i:nth-child(3n + 1) { --particle-left: 18%; --particle-size: 0.12rem; --particle-delay: -0.3s; }
	.home-cover-particle-arrow i:nth-child(3n + 2) { --particle-left: 48%; --particle-size: 0.18rem; --particle-delay: -0.85s; background: var(--scene-pink, #ec4899); }
	.home-cover-particle-arrow i:nth-child(3n) { --particle-left: 76%; --particle-size: 0.14rem; --particle-delay: -1.2s; background: var(--scene-gold, #facc15); }

	.home-cover-particle-head {
		position: relative;
		z-index: 13;
		width: 1.65rem;
		height: 2rem;
		flex: 0 0 1.65rem;
		filter: drop-shadow(0 0 0.35rem var(--scene-pink, #ec4899));
		animation: home-cover-arrowhead-pulse 1.55s ease-in-out infinite;
	}

	.home-cover-particle-head::before,
	.home-cover-particle-head::after {
		content: "";
		position: absolute;
		right: 0.16rem;
		top: 50%;
		width: 1.18rem;
		height: 0.16rem;
		border-radius: 999px;
		background: linear-gradient(90deg, var(--scene-violet, #8b5cf6), #fff 64%, var(--scene-pink, #ec4899));
		transform-origin: right center;
	}

	.home-cover-particle-head::before {
		transform: translateY(-50%) rotate(38deg);
	}

	.home-cover-particle-head::after {
		transform: translateY(-50%) rotate(-38deg);
	}

	.home-cover-particle-head > span {
		position: absolute;
		right: 0.03rem;
		top: 50%;
		width: 0.38rem;
		height: 0.38rem;
		border: 1px solid rgba(255, 255, 255, 0.88);
		border-radius: 50%;
		background: var(--scene-pink, #ec4899);
		box-shadow: 0 0 0.4rem var(--scene-pink, #ec4899), 0 0 1rem var(--scene-violet, #8b5cf6);
		transform: translateY(-50%);
	}

	@media (min-width: 901px) and (pointer: fine) {
		.home-cover-particle-arrow {
			display: flex;
		}
	}

	:global(html:not(.dark)) .home-cover-switcher-backdrop {
		background:
			radial-gradient(circle at 20% 18%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 36%),
			radial-gradient(circle at 78% 74%, color-mix(in oklch, var(--primary) 10%, transparent), transparent 38%),
			rgba(235, 244, 241, 0.84);
		backdrop-filter: blur(1.15rem) saturate(0.96);
	}

	:global(html:not(.dark)) .home-cover-switcher-dialog {
		border-color: color-mix(in oklch, var(--primary) 28%, #c8dbd4);
		background: linear-gradient(145deg, color-mix(in oklch, var(--primary) 7%, rgba(255, 255, 255, 0.98)), rgba(244, 249, 247, 0.98)), #f6faf8;
		box-shadow: 0 2rem 7rem rgba(44, 85, 73, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.94);
		color: #173a31;
	}

	:global(html:not(.dark)) .home-cover-switcher-sidebar {
		border-color: color-mix(in oklch, var(--primary) 24%, #d6e5e0);
		background: linear-gradient(180deg, color-mix(in oklch, var(--primary) 8%, transparent), transparent), rgba(250, 253, 252, 0.88);
		box-shadow: inset 0 1px 0 white;
	}

	:global(html:not(.dark)) .home-cover-switcher-heading > p:first-child,
	:global(html:not(.dark)) .home-cover-switcher-description,
	:global(html:not(.dark)) .home-cover-switcher-hint,
	:global(html:not(.dark)) .home-cover-local-heading small,
	:global(html:not(.dark)) .home-cover-empty {
		color: #688079;
	}

	:global(html:not(.dark)) .home-cover-favorites-note,
	:global(html:not(.dark)) .home-cover-theme-control,
	:global(html:not(.dark)) .home-cover-apply-control,
	:global(html:not(.dark)) .home-cover-local-library {
		border-color: color-mix(in oklch, var(--primary) 24%, #d4e6df);
		background: color-mix(in oklch, var(--primary) 6%, white);
		color: #345d52;
	}

	:global(html:not(.dark)) .home-cover-apply-modes label,
	:global(html:not(.dark)) .home-cover-page-options label,
	:global(html:not(.dark)) .home-cover-local-heading > button,
	:global(html:not(.dark)) .home-cover-history-item > button:first-child {
		border-color: color-mix(in oklch, var(--primary) 18%, #d6e5e0);
		background: rgba(255, 255, 255, 0.72);
		color: #36584f;
	}

	:global(html:not(.dark)) .home-cover-apply-modes label small {
		color: #688079;
	}

	:global(html:not(.dark)) .home-cover-switcher-close {
		border-color: color-mix(in oklch, var(--primary) 25%, #c8dbd4);
		background: rgba(255, 255, 255, 0.88);
		color: #315c51;
	}

	:global(html:not(.dark)) .home-cover-orbit {
		border-color: color-mix(in oklch, var(--primary) 24%, #d7e5e0);
		background:
			radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--primary) 15%, transparent), transparent 34%),
			radial-gradient(circle at 76% 28%, color-mix(in oklch, var(--primary) 8%, transparent), transparent 32%),
			linear-gradient(145deg, rgba(250, 253, 252, 0.96), rgba(232, 242, 238, 0.98));
	}

	:global(html:not(.dark)) .home-cover-orbit-center {
		border-color: color-mix(in oklch, var(--primary) 34%, #cbded7);
		background: radial-gradient(circle, color-mix(in oklch, var(--primary) 15%, white), rgba(246, 251, 249, 0.88));
		box-shadow: 0 0 4rem color-mix(in oklch, var(--primary) 18%, transparent);
	}

	:global(html:not(.dark)) .home-cover-orbit-center small {
		color: #789088;
	}

	:global(html:not(.dark)) .home-cover-option {
		border-color: color-mix(in oklch, var(--primary) 22%, #d4e3de);
		background: rgba(255, 255, 255, 0.88);
		box-shadow: 0 1rem 2.5rem rgba(47, 84, 74, 0.14);
		color: #23453c;
	}

	:global(html:not(.dark)) .home-cover-option.is-active {
		background: color-mix(in oklch, var(--primary) 12%, white);
	}

	:global(html:not(.dark)) .home-cover-option > span:last-child {
		color: #36584f;
	}

	:global(html:not(.dark)) .home-cover-orbit-actions button {
		border-color: color-mix(in oklch, var(--primary) 24%, #c9ded6);
		background: rgba(255, 255, 255, 0.84);
		box-shadow: 0 0.75rem 2rem rgba(47, 84, 74, 0.13);
		color: #315c51;
	}

	@media (max-width: 900px) {
		.home-cover-switcher-dialog {
			overflow-y: auto;
		}

		.home-cover-switcher-layout {
			grid-template-columns: 1fr;
			height: auto;
			min-height: 0;
		}

		.home-cover-switcher-sidebar {
			overflow: visible;
		}

		.home-cover-switcher-utilities {
			overflow: visible;
		}

		.home-cover-orbit {
			height: 34rem;
		}
	}

	@media (max-width: 560px) {
		.home-cover-switcher {
			padding: 0;
		}

		.home-cover-switcher-dialog {
			width: 100vw;
			max-height: 100dvh;
			border: 0;
			border-radius: 0;
			padding: 0.75rem;
		}

		.home-cover-switcher-sidebar {
			padding: 1rem;
		}

		.home-cover-switcher-heading h2 {
			font-size: 1.65rem;
			white-space: normal;
		}

		.home-cover-switcher-close {
			right: 1.2rem;
			top: 1.2rem;
		}

		.home-cover-page-options {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.home-cover-orbit {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 0.7rem;
			height: auto;
			padding: 1rem;
		}

		.home-cover-orbit-lines,
		.home-cover-orbit-center,
		.home-cover-particle-arrow {
			display: none;
		}

		.home-cover-orbit-actions {
			position: relative;
			inset: auto;
			grid-column: 1 / -1;
			gap: 0.65rem;
		}

		.home-cover-orbit-actions button {
			flex: 1 1 0;
		}

		.home-cover-option,
		.home-cover-option:nth-of-type(1),
		.home-cover-option:nth-of-type(2),
		.home-cover-option:nth-of-type(3),
		.home-cover-option:nth-of-type(4),
		.home-cover-option:nth-of-type(1):hover,
		.home-cover-option:nth-of-type(2):hover,
		.home-cover-option:nth-of-type(3):hover,
		.home-cover-option:nth-of-type(4):hover {
			position: relative;
			left: auto;
			right: auto;
			top: auto;
			bottom: auto;
			width: auto;
			transform: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.home-cover-switcher-dialog,
		.home-cover-option,
		.home-cover-orbit-lines,
		.home-cover-particle-arrow,
		.home-cover-particle-arrow::before,
		.home-cover-particle-arrow i,
		.home-cover-particle-arrow :global(svg) {
			animation: none;
			transition: none;
		}
	}

	@keyframes original-cover-dialog-enter {
		from { opacity: 0; transform: translateY(1.25rem) scale(0.97); }
		to { opacity: 1; transform: none; }
	}

	@keyframes home-cover-orbit-spin {
		to { transform: translate(-50%, -50%) rotate(360deg); }
	}

	@keyframes home-cover-particle-beam {
		50% { opacity: 0.62; transform: scaleX(0.94); }
	}

	@keyframes home-cover-energy-breathe {
		50% { opacity: 0.72; filter: brightness(1.16); }
	}

	@keyframes home-cover-energy-sparks {
		0%, 100% { opacity: 0.35; transform: translateX(-0.45rem); }
		50% { opacity: 0.9; transform: translateX(0.45rem); }
	}

	@keyframes home-cover-particle-flow {
		0% { opacity: 0; transform: translate(0, -50%) scale(0.5); }
		35% { opacity: 0.9; }
		100% { opacity: 0; transform: translate(1.1rem, -50%) scale(1.3); }
	}

	@keyframes home-cover-arrowhead-pulse {
		50% { opacity: 0.72; transform: scale(0.9); }
	}
	}
</style>
