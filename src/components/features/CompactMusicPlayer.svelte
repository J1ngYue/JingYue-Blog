<script lang="ts">
import {
	Expand,
	Heart,
	Library,
	ListMusic,
	Music2,
	Pause,
	Play,
	Repeat1,
	Repeat2,
	Shuffle,
	SkipBack,
	SkipForward,
	Volume2,
	VolumeX,
	X,
} from "lucide-svelte";
import { onDestroy, onMount } from "svelte";

type MusicState = ReturnType<NonNullable<Window["__fireflyMusic"]>["getState"]>;
type Track = NonNullable<MusicState["track"]>;

let active = $state(false);
let initialized = $state(false);
let track = $state<Track | null>(null);
let isPlaying = $state(false);
let playMode = $state(0);
let volume = $state(0.7);
let isMuted = $state(false);
let progress = $state(0);
let currentTime = $state("0:00");
let duration = $state("0:00");
let retryTimer = 0;

const modeLabel = $derived(
	playMode === 1 ? "单曲循环" : playMode === 2 ? "随机播放" : "列表循环",
);

function manager() {
	return window.__fireflyMusic;
}

function syncState() {
	const state = manager()?.getState();
	if (!state) return;
	initialized = state.initialized;
	track = state.track;
	isPlaying = state.isPlaying;
	playMode = state.playMode;
	volume = state.volume;
	isMuted = state.isMuted;
	progress = state.progress;
	currentTime = state.currentTimeStr;
	duration = state.durationStr;
}

function initializeManager() {
	const musicManager = manager();
	if (!musicManager) {
		retryTimer = window.setTimeout(initializeManager, 100);
		return;
	}
	syncState();
	if (!musicManager.getState().initialized) void musicManager.init();
}

function handleMiniState(event: Event) {
	active = Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open);
	if (!active) return;
	syncState();
	requestAnimationFrame(() => {
		document
			.querySelector<HTMLElement>("#music-mini-panel [data-mini-close]")
			?.focus({ preventScroll: true });
	});
}

function handleTrack(event: Event) {
	const detail = (event as CustomEvent<{ track: Track }>).detail;
	track = detail.track;
	progress = 0;
	currentTime = "0:00";
}

function handlePlayState(event: Event) {
	isPlaying = Boolean(
		(event as CustomEvent<{ isPlaying: boolean }>).detail.isPlaying,
	);
}

function handleTime(event: Event) {
	const detail = (
		event as CustomEvent<{
			progress: number;
			currentTimeStr: string;
			durationStr: string;
		}>
	).detail;
	progress = detail.progress;
	currentTime = detail.currentTimeStr;
	duration = detail.durationStr;
}

function handleVolume(event: Event) {
	const detail = (event as CustomEvent<{ volume: number; isMuted: boolean }>)
		.detail;
	volume = detail.volume;
	isMuted = detail.isMuted;
}

function handleMode(event: Event) {
	playMode = (event as CustomEvent<{ playMode: number }>).detail.playMode;
}

function closeMini() {
	window.dispatchEvent(new CustomEvent("jingyue:close-music-mini"));
}

function openImmersive() {
	window.dispatchEvent(new CustomEvent("jingyue:open-immersive-music"));
}

function openLibrary(tab: "queue" | "favorites" = "queue") {
	closeMini();
	window.dispatchEvent(
		new CustomEvent("jingyue:open-music-library", { detail: { tab } }),
	);
}

function seek(event: Event) {
	manager()?.seek(
		Number((event.currentTarget as HTMLInputElement).value) / 100,
	);
}

function setVolume(event: Event) {
	manager()?.setVolume(Number((event.currentTarget as HTMLInputElement).value));
}

onMount(() => {
	initializeManager();
	window.addEventListener("jingyue:music-mini-state", handleMiniState);
	window.addEventListener("fm:init", syncState);
	window.addEventListener("fm:track", handleTrack);
	window.addEventListener("fm:play-state", handlePlayState);
	window.addEventListener("fm:time", handleTime);
	window.addEventListener("fm:volume", handleVolume);
	window.addEventListener("fm:mode", handleMode);

	return () => {
		window.removeEventListener("jingyue:music-mini-state", handleMiniState);
		window.removeEventListener("fm:init", syncState);
		window.removeEventListener("fm:track", handleTrack);
		window.removeEventListener("fm:play-state", handlePlayState);
		window.removeEventListener("fm:time", handleTime);
		window.removeEventListener("fm:volume", handleVolume);
		window.removeEventListener("fm:mode", handleMode);
	};
});

onDestroy(() => window.clearTimeout(retryTimer));
</script>

<section class="music-mini" class:is-active={active} aria-label="迷你音乐播放器">
	{#if track?.pic}
		<img class="music-mini__ambient" src={track.pic} alt="" aria-hidden="true" />
	{/if}
	<header class="music-mini__header">
		<div class="music-mini__brand">
			<span class="music-mini__brand-mark" aria-hidden="true">
				<Music2 size={16} strokeWidth={2.2} />
			</span>
			<span class="music-mini__brand-copy">
				<span>JINGYUE RADIO</span>
				<strong>音乐放映室</strong>
			</span>
		</div>
		<div class="music-mini__header-actions">
			<button type="button" onclick={() => openLibrary("favorites")} aria-label="打开我的收藏" title="我的收藏">
				<Heart size={17} />
			</button>
			<button type="button" data-mini-close onclick={closeMini} aria-label="关闭迷你播放器" title="关闭">
				<X size={18} />
			</button>
		</div>
	</header>

	<div class="music-mini__track">
		<div class="music-mini__cover" class:playing={isPlaying}>
			{#if track?.pic}
				<img src={track.pic} alt={`${track.name}的封面`} />
			{:else}
				<Music2 size={27} />
			{/if}
			<span class="music-mini__cover-status" class:playing={isPlaying} aria-hidden="true"></span>
		</div>
		<div class="music-mini__copy" aria-live="polite" aria-atomic="true">
			<small>
				<span class="music-mini__status-dot" class:playing={isPlaying} aria-hidden="true"></span>
				{initialized ? "NOW PLAYING" : "LOADING PLAYLIST"}
			</small>
			<h2>{track?.name || "JingYue Music"}</h2>
			<p>{track?.artist || "等待音乐载入"}</p>
		</div>
	</div>

	<div class="music-mini__timeline">
		<div>
			<time>{currentTime}</time>
			<time>{duration}</time>
		</div>
		<input
			type="range"
			min="0"
			max="100"
			step="0.1"
			value={progress}
			oninput={seek}
			style={`--mini-progress: ${progress}%`}
			aria-label="播放进度"
		/>
	</div>

	<div class="music-mini__controls">
		<button class="music-mini__utility" class:active={playMode !== 0} type="button" onclick={() => manager()?.cyclePlayMode()} aria-label={modeLabel} title={modeLabel}>
			{#if playMode === 1}
				<Repeat1 size={19} />
			{:else if playMode === 2}
				<Shuffle size={19} />
			{:else}
				<Repeat2 size={19} />
			{/if}
		</button>
		<button type="button" onclick={() => manager()?.playPrev()} aria-label="上一首" title="上一首">
			<SkipBack size={22} fill="currentColor" />
		</button>
		<button class="music-mini__play" type="button" onclick={() => manager()?.togglePlay()} aria-label={isPlaying ? "暂停" : "播放"}>
			{#if isPlaying}<Pause size={24} fill="currentColor" />{:else}<Play size={24} fill="currentColor" />{/if}
		</button>
		<button type="button" onclick={() => manager()?.playNext()} aria-label="下一首" title="下一首">
			<SkipForward size={22} fill="currentColor" />
		</button>
		<button class="music-mini__utility" type="button" onclick={() => openLibrary("queue")} aria-label="播放队列" title="播放队列">
			<ListMusic size={20} />
		</button>
	</div>

	<footer class="music-mini__footer">
		<div class="music-mini__volume">
			<button type="button" onclick={() => manager()?.toggleMute()} aria-label={isMuted ? "取消静音" : "静音"}>
				{#if isMuted || volume === 0}<VolumeX size={18} />{:else}<Volume2 size={18} />{/if}
			</button>
			<input
				type="range"
				min="0"
				max="1"
				step="0.01"
				value={isMuted ? 0 : volume}
				oninput={setVolume}
				style={`--mini-volume: ${(isMuted ? 0 : volume) * 100}%`}
				aria-label="音量"
			/>
		</div>
		<button
			class="music-mini__library"
			type="button"
			onclick={() => openLibrary("queue")}
			aria-label="打开音乐库"
			title="音乐库"
		>
			<Library size={18} strokeWidth={1.9} />
			<span>曲库</span>
		</button>
		<button
			class="music-mini__immersive"
			type="button"
			onclick={openImmersive}
			aria-label="进入沉浸模式"
			title="进入沉浸模式"
		>
			<Expand size={18} strokeWidth={1.9} />
		</button>
	</footer>
</section>
