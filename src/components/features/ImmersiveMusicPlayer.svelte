<script lang="ts">
import {
	Captions,
	CloudDownload,
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
import { onDestroy, onMount, tick } from "svelte";
import { musicPlayerConfig } from "@/config/musicConfig";
import MusicTerrainCanvas from "./MusicTerrainCanvas.svelte";

type Track = NonNullable<
	ReturnType<NonNullable<Window["__fireflyMusic"]>["getState"]>["track"]
>;
type Lyric = { time: number; text: string };

let active = $state(false);
let track = $state<Track | null>(null);
let playlist = $state<Track[]>([]);
let currentIndex = $state(0);
let isPlaying = $state(false);
let playMode = $state(0);
let volume = $state(musicPlayerConfig.volume ?? 0.7);
let isMuted = $state(false);
let progress = $state(0);
let currentTime = $state("0:00");
let duration = $state("0:00");
let lyrics = $state<Lyric[]>([]);
let currentLyricIndex = $state(-1);
let lyricsVisible = $state(true);
let playlistOpen = $state(false);
let syncOpen = $state(false);
let syncing = $state(false);
let syncStatus = $state("输入公开歌单 ID，即可同步到当前播放队列。");
let syncTone = $state<"" | "success" | "error">("");
let playlistId = $state(
	musicPlayerConfig.neteaseSync?.defaultPlaylistId ??
		musicPlayerConfig.meting?.id ??
		"",
);
let playlistElement: HTMLDivElement;
let managerRetry = 0;

const modeLabel = $derived(
	playMode === 1 ? "单曲循环" : playMode === 2 ? "随机播放" : "列表循环",
);

function getActiveLyrics() {
	const anchor = Math.max(0, currentLyricIndex);
	const start = Math.max(0, anchor - 4);
	const end = Math.min(lyrics.length, anchor + 7);
	return lyrics.slice(start, end).map((lyric, index) => {
		const offset = start + index - anchor;
		const distance = Math.abs(offset);
		return {
			lyric,
			offset,
			opacity: Math.max(0.13, 0.86 - distance * 0.13),
			scale: Math.max(0.82, 1 - distance * 0.035),
			shift: distance * 0.28,
		};
	});
}

const activeLyrics = $derived(getActiveLyrics());

function manager() {
	return window.__fireflyMusic;
}

async function focusCurrentTrack() {
	await tick();
	playlistElement
		?.querySelector<HTMLElement>("[aria-current='true']")
		?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function syncState() {
	const state = manager()?.getState();
	if (!state) return;
	track = state.track;
	playlist = state.playlist;
	currentIndex = state.currentIndex;
	isPlaying = state.isPlaying;
	playMode = state.playMode;
	volume = state.volume;
	isMuted = state.isMuted;
	progress = state.progress;
	currentTime = state.currentTimeStr;
	duration = state.durationStr;
	lyrics = state.lyrics;
	currentLyricIndex = state.currentLrcIndex;
	void focusCurrentTrack();
}

function initializeManager() {
	const musicManager = manager();
	if (!musicManager) {
		managerRetry = window.setTimeout(initializeManager, 100);
		return;
	}
	syncState();
	if (!musicManager.getState().initialized) void musicManager.init();
}

function onOverlayState(event: Event) {
	active = Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open);
	if (active) {
		syncState();
		requestAnimationFrame(() => {
			document
				.querySelector<HTMLElement>("#music-nav-panel [data-music-close]")
				?.focus({ preventScroll: true });
		});
	} else {
		syncOpen = false;
		playlistOpen = false;
	}
}

function onInit() {
	syncState();
}

function onTrack(event: Event) {
	const detail = (event as CustomEvent<{ track: Track; index: number }>).detail;
	track = detail.track;
	currentIndex = detail.index;
	progress = 0;
	currentTime = "0:00";
	void focusCurrentTrack();
}

function onPlayState(event: Event) {
	isPlaying = Boolean(
		(event as CustomEvent<{ isPlaying: boolean }>).detail.isPlaying,
	);
}

function onTime(event: Event) {
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

function onVolume(event: Event) {
	const detail = (event as CustomEvent<{ volume: number; isMuted: boolean }>)
		.detail;
	volume = detail.volume;
	isMuted = detail.isMuted;
}

function onMode(event: Event) {
	playMode = (event as CustomEvent<{ playMode: number }>).detail.playMode;
}

function onLyrics(event: Event) {
	lyrics = (event as CustomEvent<{ lyrics: Lyric[] }>).detail.lyrics ?? [];
	currentLyricIndex = -1;
}

function onLyricIndex(event: Event) {
	currentLyricIndex = (event as CustomEvent<{ index: number }>).detail.index;
}

function onSyncState(event: Event) {
	const detail = (
		event as CustomEvent<{
			status: "loading" | "success" | "error";
			count?: number;
			message?: string;
		}>
	).detail;
	syncing = detail.status === "loading";
	if (detail.status === "success") {
		syncTone = "success";
		syncStatus = `已同步 ${detail.count ?? playlist.length} 首歌曲。`;
		syncState();
	} else if (detail.status === "error") {
		syncTone = "error";
		syncStatus = detail.message || "歌单同步失败，请稍后重试。";
	}
}

function closePlayer() {
	window.dispatchEvent(new CustomEvent("jingyue:close-music-player"));
}

function openMusicLibrary(tab: "queue" | "playlists" = "queue") {
	syncOpen = false;
	window.dispatchEvent(
		new CustomEvent("jingyue:open-music-library", { detail: { tab } }),
	);
}

async function syncNeteasePlaylist(event: SubmitEvent) {
	event.preventDefault();
	const id = playlistId.trim();
	if (!/^\d+$/.test(id)) {
		syncTone = "error";
		syncStatus = "请输入正确的数字歌单 ID。";
		return;
	}

	const musicManager = manager();
	if (!musicManager) return;
	syncing = true;
	syncTone = "";
	syncStatus = "正在读取网易云歌单...";
	try {
		const result = await musicManager.syncMetingPlaylist(id);
		localStorage.setItem("jingyue-netease-playlist-id", id);
		syncTone = "success";
		syncStatus = `已同步 ${result.count} 首歌曲。`;
		syncState();
	} catch (error) {
		syncTone = "error";
		syncStatus =
			error instanceof Error ? error.message : "歌单同步失败，请稍后重试。";
	} finally {
		syncing = false;
	}
}

function seek(event: Event) {
	const value = Number((event.currentTarget as HTMLInputElement).value);
	progress = value;
	manager()?.seek(value / 100);
}

function setVolume(event: Event) {
	const value = Number((event.currentTarget as HTMLInputElement).value);
	volume = value;
	isMuted = false;
	manager()?.setVolume(value);
}

function playTrack(index: number) {
	manager()?.playTrackByIndex(index);
	playlistOpen = false;
}

function blockBackgroundWheel(event: WheelEvent) {
	event.stopPropagation();
	const target = event.target instanceof Element ? event.target : null;
	const scroller = target?.closest<HTMLElement>(
		".immersive-music__playlist-list",
	);
	if (!scroller) {
		event.preventDefault();
		return;
	}

	const atStart = scroller.scrollTop <= 1;
	const atEnd =
		scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
	if ((event.deltaY < 0 && atStart) || (event.deltaY > 0 && atEnd)) {
		event.preventDefault();
	}
}

onMount(() => {
	active = document.body.classList.contains("music-immersive-open");
	const savedId = localStorage.getItem("jingyue-netease-playlist-id");
	if (savedId) playlistId = savedId;

	window.addEventListener("jingyue:music-overlay-state", onOverlayState);
	window.addEventListener("fm:init", onInit);
	window.addEventListener("fm:track", onTrack);
	window.addEventListener("fm:play-state", onPlayState);
	window.addEventListener("fm:time", onTime);
	window.addEventListener("fm:volume", onVolume);
	window.addEventListener("fm:mode", onMode);
	window.addEventListener("fm:lyrics", onLyrics);
	window.addEventListener("fm:lrc-index", onLyricIndex);
	window.addEventListener("fm:sync-state", onSyncState);
	initializeManager();
});

onDestroy(() => {
	window.clearTimeout(managerRetry);
	window.removeEventListener("jingyue:music-overlay-state", onOverlayState);
	window.removeEventListener("fm:init", onInit);
	window.removeEventListener("fm:track", onTrack);
	window.removeEventListener("fm:play-state", onPlayState);
	window.removeEventListener("fm:time", onTime);
	window.removeEventListener("fm:volume", onVolume);
	window.removeEventListener("fm:mode", onMode);
	window.removeEventListener("fm:lyrics", onLyrics);
	window.removeEventListener("fm:lrc-index", onLyricIndex);
	window.removeEventListener("fm:sync-state", onSyncState);
});
</script>

<div
	class="immersive-music"
	class:is-active={active}
	onwheel={blockBackgroundWheel}
	aria-label="沉浸式音乐播放器"
>
	<div class="immersive-music__visual" aria-hidden="true">
		<MusicTerrainCanvas {active} {isPlaying} />
	</div>
	<div class="immersive-music__vignette" aria-hidden="true"></div>

	<div class="immersive-music__actions">
		<button
			type="button"
			class:active={syncOpen}
			onclick={() => (syncOpen = !syncOpen)}
			title="导入网易云歌单"
			aria-label="导入网易云歌单"
			aria-expanded={syncOpen}
		>
			<CloudDownload size={20} strokeWidth={1.8} />
		</button>
		<button
			type="button"
			onclick={() => openMusicLibrary("playlists")}
			title="音乐库与网易云同步"
			aria-label="打开音乐库与网易云同步"
		>
			<Library size={20} strokeWidth={1.8} />
		</button>
		<button
			type="button"
			class:active={lyricsVisible}
			onclick={() => (lyricsVisible = !lyricsVisible)}
			title="显示或隐藏歌词"
			aria-label="显示或隐藏歌词"
			aria-pressed={lyricsVisible}
		>
			<Captions size={21} strokeWidth={1.8} />
		</button>
		<button
			data-music-close
			type="button"
			onclick={closePlayer}
			title="关闭播放器"
			aria-label="关闭沉浸式播放器"
		>
			<X size={22} strokeWidth={1.8} />
		</button>
	</div>

	{#if syncOpen}
		<section class="immersive-music__sync" aria-label="网易云歌单同步">
			<div class="immersive-music__sync-heading">
				<div>
					<span>NETEASE CLOUD MUSIC</span>
					<h2>导入歌单</h2>
				</div>
				<button type="button" onclick={() => (syncOpen = false)} aria-label="关闭导入面板">
					<X size={18} />
				</button>
			</div>
			<form onsubmit={syncNeteasePlaylist}>
				<label for="immersive-netease-playlist">网易云歌单 ID</label>
				<div>
					<input
						id="immersive-netease-playlist"
						bind:value={playlistId}
						inputmode="numeric"
						pattern="[0-9]+"
						autocomplete="off"
						placeholder="输入公开歌单 ID"
					/>
					<button type="submit" disabled={syncing}>{syncing ? "同步中" : "同步"}</button>
				</div>
			</form>
			<p class:success={syncTone === "success"} class:error={syncTone === "error"} aria-live="polite">
				{syncStatus}
			</p>
			<button class="immersive-music__account-sync" type="button" onclick={() => openMusicLibrary("playlists")}>
				<Library size={17} />
				扫码登录、账号歌单与本地音乐库
			</button>
		</section>
	{/if}

	<aside class="immersive-music__credits" aria-label="滚动歌词">
		<header class="immersive-music__track-heading">
			<span>NOW PLAYING</span>
			<h1>{track?.name || "JingYue Music"}</h1>
			<p>{track?.artist || "等待播放"}</p>
		</header>
		{#if lyricsVisible}
			<div class="immersive-music__lyrics" aria-live="polite">
				{#if activeLyrics.length > 0}
					{#each activeLyrics as entry}
						<p
							class:current={entry.offset === 0}
							class:past={entry.offset < 0}
							style={`--lyric-y: ${entry.offset * 4.2}rem; --lyric-opacity: ${entry.opacity}; --lyric-scale: ${entry.scale}; --lyric-shift: ${entry.shift}rem;`}
						>
							{entry.lyric.text}
						</p>
					{/each}
				{:else}
					<p class="current">暂无歌词</p>
				{/if}
			</div>
		{/if}
	</aside>

	<aside class="immersive-music__playlist" class:is-open={playlistOpen} aria-label="播放列表">
		<div class="immersive-music__playlist-header">
			<div>
				<span>PLAYLIST</span>
				<h2>歌单切换</h2>
			</div>
			<strong>{playlist.length}</strong>
			<button type="button" onclick={() => (playlistOpen = false)} aria-label="关闭歌单">
				<X size={19} />
			</button>
		</div>
		<div class="immersive-music__playlist-line" aria-hidden="true"></div>
		<div bind:this={playlistElement} class="immersive-music__playlist-list" role="listbox">
			{#if playlist.length === 0}
				<p class="immersive-music__playlist-empty">歌单加载中</p>
			{:else}
				{#each playlist as item, index}
					<button
						type="button"
						class:current={index === currentIndex}
						onclick={() => playTrack(index)}
						aria-current={index === currentIndex ? "true" : undefined}
						role="option"
						aria-selected={index === currentIndex}
						style={`--playlist-opacity: ${Math.max(0.24, 0.82 - Math.abs(index - currentIndex) * 0.08)}; --playlist-scale: ${Math.max(0.9, 1 - Math.abs(index - currentIndex) * 0.014)};`}
					>
						<span class="immersive-music__playlist-meta">
							<strong>{item.name}</strong>
							<small>{item.artist}</small>
						</span>
						{#if index === currentIndex}
							<span class="immersive-music__eq" class:playing={isPlaying} aria-hidden="true">
								<i></i><i></i><i></i>
							</span>
						{:else}
							<span></span>
						{/if}
						<span class="immersive-music__playlist-cover">
							{#if item.pic}
								<img src={item.pic} alt="" loading="lazy" />
							{:else}
								<Music2 size={18} />
							{/if}
						</span>
					</button>
				{/each}
			{/if}
		</div>
	</aside>

	<section class="immersive-music__dock" aria-label="播放控制">
		<div class="immersive-music__now">
			<div class="immersive-music__cover" class:playing={isPlaying}>
				{#if track?.pic}
					<img src={track.pic} alt="" />
				{:else}
					<Music2 size={23} />
				{/if}
			</div>
			<div>
				<strong>{track?.name || "JingYue Music"}</strong>
				<small>{track?.artist || "等待播放"}</small>
			</div>
		</div>

		<div class="immersive-music__timeline">
			<time>{currentTime}</time>
			<input
				type="range"
				min="0"
				max="100"
				step="0.1"
				value={progress}
				oninput={seek}
				style={`--music-progress: ${progress}%`}
				aria-label="播放进度"
			/>
			<time>{duration}</time>
		</div>

		<div class="immersive-music__transport">
			<button type="button" onclick={() => (playlistOpen = !playlistOpen)} title="播放列表" aria-label="播放列表">
				<ListMusic size={20} />
			</button>
			<button type="button" onclick={() => manager()?.cyclePlayMode()} title={modeLabel} aria-label={modeLabel}>
				{#if playMode === 1}
					<Repeat1 size={19} />
				{:else if playMode === 2}
					<Shuffle size={19} />
				{:else}
					<Repeat2 size={19} />
				{/if}
			</button>
			<button type="button" onclick={() => manager()?.playPrev()} title="上一首" aria-label="上一首">
				<SkipBack size={21} fill="currentColor" />
			</button>
			<button
				type="button"
				class="immersive-music__play"
				onclick={() => manager()?.togglePlay()}
				title={isPlaying ? "暂停" : "播放"}
				aria-label={isPlaying ? "暂停" : "播放"}
			>
				{#if isPlaying}<Pause size={27} fill="currentColor" />{:else}<Play size={27} fill="currentColor" />{/if}
			</button>
			<button type="button" onclick={() => manager()?.playNext()} title="下一首" aria-label="下一首">
				<SkipForward size={21} fill="currentColor" />
			</button>
			<button type="button" onclick={closePlayer} title="返回博客" aria-label="返回博客">
				<X size={20} />
			</button>
		</div>

		<div class="immersive-music__volume">
			<button type="button" onclick={() => manager()?.toggleMute()} title="静音" aria-label="切换静音">
				{#if isMuted || volume === 0}<VolumeX size={20} />{:else}<Volume2 size={20} />{/if}
			</button>
			<input
				type="range"
				min="0"
				max="1"
				step="0.01"
				value={isMuted ? 0 : volume}
				oninput={setVolume}
				style={`--music-volume: ${(isMuted ? 0 : volume) * 100}%`}
				aria-label="音量"
			/>
		</div>
	</section>
</div>

<style>
	:global(#music-nav-panel) {
		--immersive-accent: #35d9e5;
		--immersive-accent-pink: #ff72ae;
		--immersive-accent-purple: #9974ff;
		--immersive-text: #f6fbff;
		--immersive-muted: rgb(224 236 244 / 48%);
	}

	.immersive-music {
		position: absolute;
		inset: 0;
		isolation: isolate;
		min-width: 0;
		overflow: hidden;
		background:
			radial-gradient(ellipse at 50% 24%, rgb(101 118 128 / 20%), transparent 35%),
			linear-gradient(180deg, #070b0e 0%, #020507 72%, #010203 100%);
		color: var(--immersive-text);
		font-family: inherit;
		opacity: 0;
		transform: scale(1.012);
		transition:
			opacity 380ms ease,
			transform 680ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.immersive-music.is-active {
		opacity: 1;
		transform: scale(1);
	}

	.immersive-music__visual {
		position: absolute;
		inset: 0;
		z-index: -3;
	}

	.immersive-music__visual::after {
		position: absolute;
		inset: 11% 12% 17%;
		border-radius: 50%;
		background: radial-gradient(ellipse at 50% 45%, rgb(29 217 231 / 8%), transparent 58%);
		content: "";
		filter: blur(2.8rem);
		mix-blend-mode: screen;
		pointer-events: none;
	}

	.immersive-music__vignette {
		position: absolute;
		inset: 0;
		z-index: -2;
		pointer-events: none;
		background:
			radial-gradient(ellipse at 50% 48%, transparent 0 37%, rgb(0 0 0 / 24%) 65%, rgb(0 0 0 / 72%) 100%),
			linear-gradient(90deg, rgb(2 6 9 / 58%) 0%, transparent 29%, transparent 69%, rgb(2 6 9 / 56%) 100%),
			linear-gradient(180deg, rgb(2 5 8 / 46%) 0%, transparent 23%, transparent 73%, rgb(0 0 0 / 44%) 100%);
	}

	.immersive-music__actions {
		position: absolute;
		top: clamp(5.25rem, 10vh, 7rem);
		right: clamp(1rem, 2.5vw, 2.75rem);
		z-index: 8;
		display: flex;
		gap: 0.45rem;
	}

	.immersive-music__actions button,
	.immersive-music__playlist-header button,
	.immersive-music__sync-heading button {
		display: grid;
		width: 2.55rem;
		height: 2.55rem;
		padding: 0;
		cursor: pointer;
		border: 1px solid rgb(255 255 255 / 12%);
		border-radius: 50%;
		background: rgb(8 15 21 / 64%);
		color: rgb(238 247 251 / 66%) !important;
		backdrop-filter: blur(1rem);
		place-items: center;
		transition:
			background-color 180ms ease,
			border-color 180ms ease,
			color 180ms ease,
			transform 180ms ease;
	}

	.immersive-music__actions button:hover,
	.immersive-music__actions button:focus-visible,
	.immersive-music__actions button.active,
	.immersive-music__playlist-header button:hover,
	.immersive-music__playlist-header button:focus-visible,
	.immersive-music__sync-heading button:hover,
	.immersive-music__sync-heading button:focus-visible {
		border-color: rgb(53 217 229 / 52%);
		background: rgb(14 31 38 / 88%);
		color: #fff !important;
		outline: none;
		transform: translateY(-1px);
	}

	.immersive-music__sync {
		position: absolute;
		top: clamp(8.25rem, 15vh, 10rem);
		right: clamp(1rem, 2.5vw, 2.75rem);
		z-index: 10;
		width: min(24rem, calc(100vw - 2rem));
		padding: 1.1rem;
		border: 1px solid rgb(255 255 255 / 12%);
		border-radius: 0.8rem;
		background: rgb(4 10 15 / 92%);
		box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 45%);
		backdrop-filter: blur(1.4rem) saturate(1.2);
		animation: sync-enter 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes sync-enter {
		from { opacity: 0; transform: translateY(-0.5rem) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.immersive-music__sync-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.immersive-music__sync-heading span,
	.immersive-music__eyebrow,
	.immersive-music__playlist-header span {
		color: rgb(53 217 229 / 72%);
		font-size: 0.64rem;
		font-weight: 750;
		letter-spacing: 0.16em;
	}

	.immersive-music__sync-heading h2,
	.immersive-music__playlist-header h2 {
		margin: 0.18rem 0 0;
		font-size: 1.12rem;
		letter-spacing: 0;
	}

	.immersive-music__sync form {
		margin-top: 1rem;
	}

	.immersive-music__sync label {
		display: block;
		margin-bottom: 0.42rem;
		color: rgb(255 255 255 / 56%);
		font-size: 0.72rem;
	}

	.immersive-music__sync form > div {
		display: flex;
		gap: 0.45rem;
	}

	.immersive-music__sync input {
		min-width: 0;
		flex: 1;
		padding: 0.68rem 0.78rem;
		border: 1px solid rgb(255 255 255 / 12%);
		border-radius: 0.5rem;
		background: rgb(255 255 255 / 6%);
		color: #fff;
		font-size: 0.78rem;
		outline: none;
	}

	.immersive-music__sync input:focus {
		border-color: rgb(53 217 229 / 66%);
		box-shadow: 0 0 0 3px rgb(53 217 229 / 10%);
	}

	.immersive-music__sync form button,
	.immersive-music__account-sync {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		padding: 0.68rem 0.9rem;
		cursor: pointer;
		border: 1px solid rgb(53 217 229 / 35%);
		border-radius: 0.5rem;
		background: rgb(53 217 229 / 12%);
		color: #d9fcff;
		font-size: 0.75rem;
		font-weight: 700;
	}

	.immersive-music__sync form button:disabled {
		cursor: wait;
		opacity: 0.55;
	}

	.immersive-music__sync p {
		min-height: 1.1rem;
		margin: 0.7rem 0;
		color: rgb(255 255 255 / 44%);
		font-size: 0.68rem;
		line-height: 1.55;
	}

	.immersive-music__sync p.success { color: #75e8d2; }
	.immersive-music__sync p.error { color: #ff8d99; }
	.immersive-music__account-sync { width: 100%; }

	.immersive-music__credits {
		position: absolute;
		top: clamp(7rem, 15vh, 10rem);
		left: clamp(2.8rem, 4.8vw, 6rem);
		bottom: clamp(8rem, 15vh, 10rem);
		z-index: 4;
		width: min(32rem, 36vw);
		text-shadow: 0 2px 12px rgb(0 0 0 / 80%);
		transform: perspective(72rem) rotateY(-10deg) rotateZ(-0.9deg);
		transform-origin: left center;
	}

	.immersive-music__track-heading {
		position: absolute;
		top: 0;
		left: 2rem;
		z-index: 1;
		max-width: calc(100% - 3rem);
		font-family: inherit;
		font-style: normal;
		opacity: 0.28;
	}

	.immersive-music__track-heading span {
		display: block;
		margin-bottom: 0.35rem;
		color: var(--immersive-accent);
		font-family: inherit;
		font-size: 0.58rem;
		font-weight: 800;
		letter-spacing: 0.24em;
	}

	.immersive-music__track-heading h1 {
		max-width: 100%;
		margin: 0;
		color: rgb(226 248 251 / 68%);
		font-size: clamp(0.8rem, 0.95vw, 1rem);
		font-weight: 650;
		letter-spacing: 0.02em;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	.immersive-music__track-heading p {
		margin: 0.28rem 0 0;
		color: rgb(230 241 247 / 42%);
		font-size: clamp(0.65rem, 0.72vw, 0.76rem);
		font-weight: 500;
		letter-spacing: 0.02em;
	}

	.immersive-music__lyrics {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 20rem;
		padding-left: 2.25rem;
		overflow: hidden;
		mask-image: linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent);
	}

	.immersive-music__lyrics::before {
		position: absolute;
		top: 7%;
		bottom: 7%;
		left: 0.2rem;
		width: 0.7rem;
		background:
			radial-gradient(circle, rgb(53 217 229 / 52%) 0 1.5px, transparent 2px) center top / 100% 4.2rem repeat-y,
			linear-gradient(to right, transparent 0.31rem, rgb(53 217 229 / 32%) 0.31rem 0.37rem, transparent 0.37rem);
		filter: drop-shadow(0 0 0.55rem rgb(53 217 229 / 32%));
		content: "";
	}

	.immersive-music__lyrics p {
		position: absolute;
		top: 50%;
		left: 2.25rem;
		max-width: calc(100% - 1.5rem);
		margin: 0;
		overflow: visible;
		color: rgb(255 255 255 / 44%);
		font-size: clamp(0.84rem, 0.95vw, 1.02rem);
		font-weight: 560;
		font-family: inherit;
		font-style: normal;
		line-height: 1.42;
		opacity: var(--lyric-opacity, 0.86);
		text-overflow: ellipsis;
		transform: translate3d(
				var(--lyric-shift, 0),
				calc(-50% + var(--lyric-y, 0rem)),
				0
			)
			scale(var(--lyric-scale, 1));
		transform-origin: left center;
		transition:
			color 420ms ease,
			font-size 420ms ease,
			opacity 420ms ease,
			transform 420ms ease;
		white-space: nowrap;
	}

	.immersive-music__lyrics p.past {
		color: rgb(104 225 235 / 32%);
	}

	.immersive-music__lyrics p.current {
		color: #fff;
		font-size: clamp(1rem, 1.25vw, 1.35rem);
		font-weight: 760;
		letter-spacing: 0.025em;
		opacity: 1;
		filter:
			drop-shadow(0 0 0.55rem rgb(53 217 229 / 34%))
			drop-shadow(0 0.15rem 0.5rem rgb(0 0 0 / 70%));
		transform: translate3d(0.85rem, -50%, 0) scale(1.04);
	}

	.immersive-music__lyrics p.current::before {
		position: absolute;
		top: 50%;
		left: -3rem;
		width: 0.62rem;
		height: 0.62rem;
		border: 2px solid var(--immersive-accent);
		border-radius: 50%;
		background: #071014;
		box-shadow:
			0 0 0 0.28rem rgb(53 217 229 / 12%),
			0 0 1rem rgb(53 217 229 / 62%);
		content: "";
		transform: translateY(-50%);
	}

	.immersive-music__playlist {
		position: absolute;
		top: clamp(9rem, 18vh, 12.5rem);
		right: clamp(1.8rem, 3.8vw, 4.5rem);
		bottom: clamp(8.5rem, 16vh, 10.5rem);
		z-index: 5;
		width: min(27.5rem, 31vw);
		min-width: 18rem;
		color: #fff;
		text-shadow: 0 2px 10px rgb(0 0 0 / 74%);
		transform: perspective(72rem) rotateY(8deg) rotateZ(0.32deg);
		transform-origin: right center;
	}

	.immersive-music__playlist-header {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 1rem;
		padding-right: 0.05rem;
		text-align: right;
	}

	.immersive-music__playlist-header strong {
		min-width: 2rem;
		padding: 0.35rem 0.55rem;
		border-radius: 999px;
		background: rgb(53 217 229 / 10%);
		color: rgb(229 252 255 / 72%);
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.immersive-music__playlist-header button { display: none; }

	.immersive-music__playlist-line {
		position: absolute;
		top: 4.3rem;
		right: 0.55rem;
		bottom: 0;
		width: 1px;
		background: linear-gradient(to bottom, transparent, rgb(53 217 229 / 38%) 15%, rgb(255 255 255 / 10%) 60%, transparent);
		box-shadow: 0 0 14px rgb(53 217 229 / 23%);
	}

	.immersive-music__playlist-list {
		display: flex;
		flex-direction: column;
		height: calc(100% - 4.5rem);
		margin-top: 1rem;
		padding: 0.8rem 0.1rem 2rem 7%;
		overflow-y: auto;
		mask-image: linear-gradient(to bottom, transparent, #000 9%, #000 90%, transparent);
		scrollbar-width: none;
	}

	.immersive-music__playlist-list::-webkit-scrollbar { display: none; }

	.immersive-music__playlist-list > button {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 1.6rem 3.55rem;
		gap: 0.9rem;
		align-items: center;
		width: 100%;
		min-height: 4.75rem;
		padding: 0.4rem 0.15rem;
		cursor: pointer;
		border: 0;
		background: transparent;
		color: rgb(255 255 255 / 42%) !important;
		text-align: right;
		opacity: var(--playlist-opacity, 0.68);
		transform: scale(var(--playlist-scale, 1));
		transform-origin: right center;
		transition:
			color 300ms ease,
			opacity 300ms ease,
			transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.immersive-music__playlist-list > button:hover,
	.immersive-music__playlist-list > button:focus-visible {
		color: rgb(255 255 255 / 82%) !important;
		opacity: 1;
		outline: none;
		transform: translateX(-0.35rem) scale(var(--playlist-scale, 1));
	}

	.immersive-music__playlist-list > button.current {
		color: #fff !important;
		opacity: 1;
		transform: translateX(-0.7rem) scale(1.055);
	}

	.immersive-music__playlist-meta {
		display: grid;
		min-width: 0;
	}

	.immersive-music__playlist-meta strong,
	.immersive-music__playlist-meta small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.immersive-music__playlist-meta strong {
		font-size: 0.96rem;
		letter-spacing: 0;
	}

	.immersive-music__playlist-list > button.current .immersive-music__playlist-meta strong {
		font-size: 1.05rem;
	}

	.immersive-music__playlist-meta small {
		margin-top: 0.2rem;
		color: rgb(255 255 255 / 38%) !important;
		font-size: 0.68rem;
	}

	.immersive-music__playlist-cover {
		display: grid;
		width: 3.55rem;
		height: 3.55rem;
		overflow: hidden;
		border-radius: 0.42rem;
		background: rgb(255 255 255 / 7%);
		color: rgb(255 255 255 / 48%);
		box-shadow: 0 0.7rem 1.4rem rgb(0 0 0 / 28%);
		place-items: center;
		transition:
			box-shadow 360ms ease,
			transform 360ms ease;
	}

	.immersive-music__playlist-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	button.current .immersive-music__playlist-cover {
		box-shadow:
			0 0 0 3px rgb(53 217 229 / 20%),
			0 0 1.5rem rgb(53 217 229 / 38%);
		transform: scale(1.08);
	}

	.immersive-music__eq {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 0.16rem;
		height: 1.1rem;
		color: var(--immersive-accent);
	}

	.immersive-music__eq i {
		width: 0.16rem;
		height: 42%;
		border-radius: 99px;
		background: currentColor;
	}

	.immersive-music__eq.playing i { animation: immersive-eq 850ms ease-in-out infinite; }
	.immersive-music__eq.playing i:nth-child(2) { animation-delay: 140ms; }
	.immersive-music__eq.playing i:nth-child(3) { animation-delay: 280ms; }

	@keyframes immersive-eq {
		0%, 100% { height: 35%; }
		50% { height: 100%; }
	}

	.immersive-music__playlist-empty {
		margin: 2rem 0;
		color: rgb(255 255 255 / 35%);
		text-align: right;
	}

	.immersive-music__dock {
		position: absolute;
		left: 50%;
		bottom: max(1.45rem, env(safe-area-inset-bottom));
		z-index: 7;
		display: grid;
		grid-template-columns: minmax(13rem, 1.05fr) minmax(15rem, 1.1fr) auto minmax(6.5rem, 0.55fr);
		gap: clamp(0.55rem, 1.15vw, 1.1rem);
		align-items: center;
		width: min(58.75rem, calc(100vw - 3rem));
		min-height: 4.65rem;
		padding: 0.55rem 0.8rem;
		border: 0;
		border-radius: 0.9rem;
		background: rgb(224 231 234 / 62%);
		box-shadow: 0 1.75rem 6rem rgb(0 15 32 / 28%);
		color: #0b1117;
		transform: translateX(-50%);
		backdrop-filter: blur(1.6rem) saturate(0.85);
	}

	.immersive-music__now {
		display: flex;
		gap: 0.7rem;
		align-items: center;
		min-width: 0;
	}

	.immersive-music__cover {
		display: grid;
		flex: 0 0 auto;
		width: 3.15rem;
		height: 3.15rem;
		overflow: hidden;
		border-radius: 0.52rem;
		background: rgb(4 10 14 / 14%);
		color: rgb(4 10 14 / 54%);
		place-items: center;
	}

	.immersive-music__cover.playing { animation: cover-breathe 3.2s ease-in-out infinite; }

	@keyframes cover-breathe {
		50% { box-shadow: 0 0 0 4px rgb(53 217 229 / 16%), 0 0 1.2rem rgb(53 217 229 / 22%); }
	}

	.immersive-music__cover img { width: 100%; height: 100%; object-fit: cover; }
	.immersive-music__now > div:last-child { display: grid; min-width: 0; }

	.immersive-music__now strong,
	.immersive-music__now small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.immersive-music__now strong { font-size: 0.84rem; letter-spacing: 0; }
	.immersive-music__now small { margin-top: 0.2rem; color: rgb(11 17 23 / 54%); font-size: 0.67rem; }

	.immersive-music__timeline {
		display: grid;
		grid-template-columns: 2.4rem minmax(5rem, 1fr) 2.4rem;
		gap: 0.55rem;
		align-items: center;
	}

	.immersive-music__timeline time {
		color: rgb(11 17 23 / 56%);
		font-size: 0.63rem;
		font-variant-numeric: tabular-nums;
		text-align: center;
	}

	.immersive-music__timeline input,
	.immersive-music__volume input {
		height: 1rem;
		margin: 0;
		cursor: pointer;
		appearance: none;
		background: transparent;
		outline: none;
	}

	.immersive-music__timeline input::-webkit-slider-runnable-track {
		height: 0.2rem;
		border-radius: 99px;
		background: linear-gradient(to right, #182029 var(--music-progress), rgb(11 17 23 / 16%) var(--music-progress));
	}

	.immersive-music__timeline input::-moz-range-track {
		height: 0.2rem;
		border-radius: 99px;
		background: linear-gradient(to right, #182029 var(--music-progress), rgb(11 17 23 / 16%) var(--music-progress));
	}

	.immersive-music__timeline input::-webkit-slider-thumb,
	.immersive-music__volume input::-webkit-slider-thumb {
		width: 0.68rem;
		height: 0.68rem;
		margin-top: -0.24rem;
		appearance: none;
		border: 0;
		border-radius: 50%;
		background: #172029;
		box-shadow: 0 0 0 3px rgb(255 255 255 / 28%);
	}

	.immersive-music__timeline input::-moz-range-thumb,
	.immersive-music__volume input::-moz-range-thumb {
		width: 0.68rem;
		height: 0.68rem;
		border: 0;
		border-radius: 50%;
		background: #172029;
	}

	.immersive-music__transport,
	.immersive-music__volume {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.immersive-music__transport { gap: 0.05rem; }

	.immersive-music__transport button,
	.immersive-music__volume button {
		display: grid;
		width: 2.05rem;
		height: 2.05rem;
		padding: 0;
		cursor: pointer;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: rgb(8 14 20 / 75%);
		place-items: center;
		transition:
			background-color 160ms ease,
			color 160ms ease,
			transform 160ms ease;
	}

	.immersive-music__transport button:hover,
	.immersive-music__transport button:focus-visible,
	.immersive-music__volume button:hover,
	.immersive-music__volume button:focus-visible {
		background: rgb(255 255 255 / 42%);
		color: #05090d;
		outline: none;
		transform: translateY(-1px);
	}

	.immersive-music__transport .immersive-music__play {
		width: 3rem;
		height: 3rem;
		margin-inline: 0.16rem;
		background: #f8fbfc;
		box-shadow: 0 0.65rem 1.6rem rgb(2 8 12 / 17%);
		color: #05090d;
	}

	.immersive-music__volume { gap: 0.35rem; }
	.immersive-music__volume button { width: 1.9rem; height: 1.9rem; }
	.immersive-music__volume input { width: min(6rem, 7vw); }

	.immersive-music__volume input::-webkit-slider-runnable-track {
		height: 0.26rem;
		border-radius: 99px;
		background: linear-gradient(90deg, #38cddd 0%, #53d8b7 42%, #f2b452 73%, #f06b70 100%);
		clip-path: inset(0 calc(100% - var(--music-volume)) 0 0 round 99px);
	}

	.immersive-music__volume input::-moz-range-track {
		height: 0.26rem;
		border-radius: 99px;
		background: linear-gradient(90deg, #38cddd, #53d8b7 42%, #f2b452 73%, #f06b70);
	}

	:global(html:not(.dark) #music-nav-panel) {
		--immersive-text: #172732;
		--immersive-muted: rgb(35 64 78 / 58%);
	}

	:global(html:not(.dark)) .immersive-music {
		background:
			radial-gradient(ellipse at 50% 26%, rgb(139 154 163 / 14%), transparent 37%),
			linear-gradient(180deg, #fff 0%, #f8fbfc 64%, #f4f7f8 100%);
	}

	:global(html:not(.dark)) .immersive-music__visual::after {
		opacity: 0.64;
		mix-blend-mode: multiply;
	}

	:global(html:not(.dark)) .immersive-music__vignette {
		background:
			radial-gradient(ellipse at 50% 48%, transparent 0 38%, rgb(104 125 136 / 3%) 66%, rgb(71 90 101 / 9%) 100%),
			linear-gradient(90deg, rgb(255 255 255 / 72%) 0%, transparent 29%, transparent 70%, rgb(255 255 255 / 68%) 100%),
			linear-gradient(180deg, rgb(255 255 255 / 58%) 0%, transparent 22%, transparent 75%, rgb(255 255 255 / 42%) 100%);
	}

	:global(html:not(.dark)) .immersive-music__actions button,
	:global(html:not(.dark)) .immersive-music__playlist-header button,
	:global(html:not(.dark)) .immersive-music__sync-heading button {
		border-color: rgb(41 88 107 / 14%);
		background: rgb(255 255 255 / 72%);
		box-shadow: 0 0.55rem 1.4rem rgb(45 86 103 / 10%);
		color: rgb(28 58 72 / 68%) !important;
	}

	:global(html:not(.dark)) .immersive-music__actions button:hover,
	:global(html:not(.dark)) .immersive-music__actions button:focus-visible,
	:global(html:not(.dark)) .immersive-music__actions button.active,
	:global(html:not(.dark)) .immersive-music__playlist-header button:hover,
	:global(html:not(.dark)) .immersive-music__playlist-header button:focus-visible,
	:global(html:not(.dark)) .immersive-music__sync-heading button:hover,
	:global(html:not(.dark)) .immersive-music__sync-heading button:focus-visible {
		border-color: rgb(25 181 196 / 36%);
		background: rgb(236 252 255 / 92%);
		color: #087f91 !important;
	}

	:global(html:not(.dark)) .immersive-music__sync {
		border-color: rgb(38 84 103 / 14%);
		background: rgb(255 255 255 / 92%);
		box-shadow: 0 1.5rem 4rem rgb(55 90 107 / 18%);
		color: #1d3440;
	}

	:global(html:not(.dark)) .immersive-music__sync label,
	:global(html:not(.dark)) .immersive-music__sync p {
		color: rgb(35 65 78 / 58%);
	}

	:global(html:not(.dark)) .immersive-music__sync input {
		border-color: rgb(35 75 92 / 16%);
		background: rgb(234 246 250 / 78%);
		color: #16303c;
	}

	:global(html:not(.dark)) .immersive-music__sync form button,
	:global(html:not(.dark)) .immersive-music__account-sync {
		color: #087a88;
	}

	:global(html:not(.dark)) .immersive-music__credits {
		text-shadow: 0 2px 14px rgb(255 255 255 / 90%);
	}

	:global(html:not(.dark)) .immersive-music__track-heading h1 {
		background: none;
		color: rgb(24 78 91 / 68%);
		filter: none;
	}

	:global(html:not(.dark)) .immersive-music__track-heading p {
		color: rgb(29 57 70 / 62%);
	}

	:global(html:not(.dark)) .immersive-music__lyrics p {
		color: rgb(29 57 70 / 42%);
	}

	:global(html:not(.dark)) .immersive-music__lyrics p.current {
		color: #122733;
		filter: drop-shadow(0 2px 8px rgb(255 255 255 / 92%));
	}

	:global(html:not(.dark)) .immersive-music__lyrics p.current::before {
		background: #f9fdff;
	}

	:global(html:not(.dark)) .immersive-music__playlist {
		color: #1b3440;
		text-shadow: 0 2px 10px rgb(255 255 255 / 90%);
	}

	:global(html:not(.dark)) .immersive-music__playlist-header strong {
		background: rgb(25 181 196 / 10%);
		color: #087f91;
	}

	:global(html:not(.dark)) .immersive-music__playlist-list > button {
		color: rgb(29 56 69 / 54%) !important;
	}

	:global(html:not(.dark)) .immersive-music__playlist-list > button:hover,
	:global(html:not(.dark)) .immersive-music__playlist-list > button:focus-visible,
	:global(html:not(.dark)) .immersive-music__playlist-list > button.current {
		color: #18313d !important;
	}

	:global(html:not(.dark)) .immersive-music__playlist-meta small {
		color: rgb(36 67 81 / 52%) !important;
	}

	:global(html:not(.dark)) .immersive-music__playlist-cover {
		background: rgb(255 255 255 / 76%);
		color: rgb(27 67 82 / 52%);
		box-shadow: 0 0.7rem 1.4rem rgb(45 83 99 / 16%);
	}

	:global(html:not(.dark)) .immersive-music__playlist-empty {
		color: rgb(29 56 69 / 45%);
	}

	:global(html:not(.dark)) .immersive-music__dock {
		border-color: rgb(40 79 95 / 14%);
		background: rgb(255 255 255 / 72%);
		box-shadow: 0 1.25rem 4rem rgb(48 83 99 / 18%);
		backdrop-filter: blur(1.8rem) saturate(1.12);
	}

	:global(html.dark) .immersive-music__dock {
		background: rgb(213 222 226 / 62%);
		box-shadow: 0 1.75rem 6rem rgb(0 0 0 / 52%);
		color: #0b1117;
		backdrop-filter: blur(1.8rem) saturate(0.88);
	}

	:global(html.dark) .immersive-music__now small,
	:global(html.dark) .immersive-music__timeline time {
		color: rgb(11 17 23 / 55%);
	}

	:global(html.dark) .immersive-music__timeline input::-webkit-slider-runnable-track {
		background: linear-gradient(to right, #182029 var(--music-progress), rgb(11 17 23 / 16%) var(--music-progress));
	}

	:global(html.dark) .immersive-music__timeline input::-moz-range-track {
		background: linear-gradient(to right, #182029 var(--music-progress), rgb(11 17 23 / 16%) var(--music-progress));
	}

	:global(html.dark) .immersive-music__timeline input::-webkit-slider-thumb,
	:global(html.dark) .immersive-music__volume input::-webkit-slider-thumb,
	:global(html.dark) .immersive-music__timeline input::-moz-range-thumb,
	:global(html.dark) .immersive-music__volume input::-moz-range-thumb {
		background: #172029;
		box-shadow: 0 0 0 3px rgb(255 255 255 / 28%);
	}

	:global(html.dark) .immersive-music__transport button,
	:global(html.dark) .immersive-music__volume button {
		color: rgb(8 14 20 / 75%);
	}

	:global(html.dark) .immersive-music__transport button:hover,
	:global(html.dark) .immersive-music__transport button:focus-visible,
	:global(html.dark) .immersive-music__volume button:hover,
	:global(html.dark) .immersive-music__volume button:focus-visible {
		background: rgb(255 255 255 / 42%);
		color: #05090d;
	}

	:global(html.dark) .immersive-music__transport .immersive-music__play {
		background: #f8fbfc;
		color: #05090d;
		box-shadow: 0 0.65rem 1.6rem rgb(2 8 12 / 17%);
	}

	@media (max-width: 1180px) {
		.immersive-music__credits { width: 38vw; }
		.immersive-music__playlist { width: 38vw; min-width: 18rem; }
		.immersive-music__dock {
			grid-template-columns: minmax(10rem, 0.8fr) minmax(12rem, 1fr) auto;
		}
		.immersive-music__volume { display: none; }
	}

	@media (max-width: 900px) {
		.immersive-music__actions { top: 4.75rem; right: 0.8rem; }
		.immersive-music__credits {
			top: 7rem;
			left: 1.2rem;
			right: 1.2rem;
			bottom: 9.4rem;
			width: auto;
			min-width: 0;
			transform: none;
		}
		.immersive-music__lyrics {
			width: min(32rem, calc(100vw - 2.4rem));
			min-height: 12rem;
			padding-block: 2rem;
		}

		.immersive-music__playlist {
			top: auto;
			right: 0.7rem;
			bottom: 7.8rem;
			left: 0.7rem;
			z-index: 12;
			width: auto;
			min-width: 0;
			max-height: min(58vh, 34rem);
			padding: 0.9rem;
			border: 1px solid rgb(255 255 255 / 12%);
			border-radius: 0.8rem;
			background: rgb(3 9 14 / 95%);
			box-shadow: 0 1.4rem 4rem rgb(0 0 0 / 55%);
			opacity: 0;
			pointer-events: none;
			transform: translateY(0.7rem) scale(0.98);
			transition:
				opacity 220ms ease,
				transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
				visibility 220ms;
			visibility: hidden;
		}
		.immersive-music__playlist.is-open {
			opacity: 1;
			pointer-events: auto;
			transform: translateY(0) scale(1);
			visibility: visible;
		}
		.immersive-music__playlist-header { justify-content: space-between; text-align: left; }
		.immersive-music__playlist-header button { display: grid; }
		.immersive-music__playlist-line { display: none; }
		.immersive-music__playlist-list { height: min(45vh, 25rem); mask-image: none; }
		.immersive-music__playlist-list > button {
			grid-template-columns: 2.8rem minmax(0, 1fr) 1.3rem;
			min-height: 3.7rem;
			text-align: left;
		}
		.immersive-music__playlist-cover { grid-column: 1; grid-row: 1; width: 2.8rem; height: 2.8rem; }
		.immersive-music__playlist-meta { grid-column: 2; grid-row: 1; }
		.immersive-music__eq { grid-column: 3; grid-row: 1; }

		.immersive-music__dock {
			bottom: max(0.6rem, env(safe-area-inset-bottom));
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-rows: auto auto;
			gap: 0.55rem 0.6rem;
			width: calc(100vw - 1rem);
			min-height: 0;
			padding: 0.65rem;
			border-radius: 0.85rem;
		}
		.immersive-music__now { grid-column: 1; grid-row: 1; }
		.immersive-music__cover { width: 2.65rem; height: 2.65rem; border-radius: 0.4rem; }
		.immersive-music__transport { grid-column: 2; grid-row: 1; }
		.immersive-music__transport button:nth-child(2),
		.immersive-music__transport button:nth-child(6) { display: none; }
		.immersive-music__transport .immersive-music__play { width: 2.65rem; height: 2.65rem; }
		.immersive-music__timeline { grid-column: 1 / -1; grid-row: 2; }
	}

	@media (max-width: 520px) {
		.immersive-music__actions { top: 4.35rem; }
		.immersive-music__actions button { width: 2.25rem; height: 2.25rem; }
		.immersive-music__sync { top: 7.1rem; right: 0.6rem; width: calc(100vw - 1.2rem); }
		.immersive-music__sync form > div { align-items: stretch; flex-direction: column; }
		.immersive-music__credits { top: 6.6rem; bottom: 8.8rem; }
		.immersive-music__lyrics {
			height: auto;
			min-height: 8rem;
			max-height: 12rem;
		}
		.immersive-music__track-heading { display: none; }
		.immersive-music__lyrics p { font-size: 0.78rem; }
		.immersive-music__lyrics p.current { font-size: 0.9rem; }
		.immersive-music__transport { gap: 0; }
		.immersive-music__transport button:first-child { width: 2rem; }
		.immersive-music__transport button:nth-child(3),
		.immersive-music__transport button:nth-child(5) { display: none; }
		.immersive-music__now strong { max-width: 42vw; }
	}

	@media (prefers-reduced-motion: reduce) {
		.immersive-music,
		.immersive-music__lyrics p,
		.immersive-music__playlist,
		.immersive-music__playlist-list > button,
		.immersive-music__playlist-cover,
		.immersive-music__actions button {
			transition-duration: 1ms;
		}
		.immersive-music__cover.playing,
		.immersive-music__eq.playing i,
		.immersive-music__sync { animation: none; }
	}
</style>
