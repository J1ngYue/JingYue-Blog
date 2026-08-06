<script lang="ts">
import { onMount } from "svelte";
import {
	CalendarDays,
	Focus,
	Layers3,
	MapPin,
	Maximize2,
	Plus,
	Route,
	Search,
	Trash2,
	ZoomIn,
	ZoomOut,
} from "lucide-svelte";

type Footprint = {
	id: string;
	place: string;
	region: string;
	date: string;
	note: string;
};

const storageKey = "jingyue-record-footprints";
let footprints = $state<Footprint[]>([]);
let place = $state("");
let region = $state("");
let date = $state(new Date().toISOString().slice(0, 10));
let note = $state("");
let query = $state("");
let clustered = $state(true);
let mapZoom = $state(1);
let mapElement: HTMLElement | undefined;

const filtered = $derived(
	footprints
		.filter((item) => {
			const needle = query.trim().toLowerCase();
			return (
				!needle ||
				`${item.place} ${item.region} ${item.note}`
					.toLowerCase()
					.includes(needle)
			);
		})
		.sort((a, b) => b.date.localeCompare(a.date)),
);
const currentYearCount = $derived(
	footprints.filter((item) =>
		item.date.startsWith(String(new Date().getFullYear())),
	).length,
);
const regionCount = $derived(
	new Set(footprints.map((item) => item.region).filter(Boolean)).size,
);

function persist() {
	localStorage.setItem(storageKey, JSON.stringify(footprints));
}

function addFootprint(event: SubmitEvent) {
	event.preventDefault();
	if (!place.trim() || !region.trim() || !date) return;

	footprints = [
		{
			id: crypto.randomUUID(),
			place: place.trim(),
			region: region.trim(),
			date,
			note: note.trim(),
		},
		...footprints,
	];
	persist();
	place = "";
	region = "";
	note = "";
}

function removeFootprint(id: string) {
	footprints = footprints.filter((item) => item.id !== id);
	persist();
}

function pointStyle(item: Footprint, index: number) {
	const source = `${item.place}${item.region}`;
	let hash = 0;
	for (let i = 0; i < source.length; i += 1) {
		hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
	}
	const x = 12 + ((hash + index * 17) % 76);
	const y = 16 + (((hash >>> 8) + index * 23) % 66);
	return `left:${x}%;top:${y}%`;
}

function toggleFullscreen() {
	if (!document.fullscreenElement) void mapElement?.requestFullscreen();
	else void document.exitFullscreen();
}

onMount(() => {
	try {
		const saved = localStorage.getItem(storageKey);
		const parsed = saved ? JSON.parse(saved) : [];
		if (Array.isArray(parsed)) footprints = parsed;
	} catch {
		footprints = [];
	}
});
</script>

<div class="footprint-stats" aria-label="足迹统计">
	<div>
		<MapPin size={15} />
		<strong>{footprints.length}</strong>
		<span>地点</span>
	</div>
	<div>
		<Route size={15} />
		<strong>{regionCount}</strong>
		<span>到访地区</span>
	</div>
	<div>
		<CalendarDays size={15} />
		<strong>{currentYearCount}</strong>
		<span>今年出行</span>
	</div>
</div>

<h2 class="footprint-map-heading">足迹地图</h2>

<section
	bind:this={mapElement}
	class="footprint-map"
	class:is-clustered={clustered}
	style={`--map-zoom:${mapZoom}`}
	aria-label="足迹地图"
>
	<div class="footprint-map__grid" aria-hidden="true"></div>
	<div class="footprint-map__toolbar" aria-label="地图控制">
		<button type="button" onclick={toggleFullscreen} aria-label="全屏查看地图" title="全屏查看地图"><Maximize2 size={18} /></button>
		<button type="button" onclick={() => (mapZoom = 1)} aria-label="重置地图" title="重置地图"><Focus size={18} /></button>
		<button type="button" onclick={() => (mapZoom = Math.min(1.4, mapZoom + 0.1))} aria-label="放大地图" title="放大地图"><ZoomIn size={18} /></button>
		<button type="button" onclick={() => (mapZoom = Math.max(0.8, mapZoom - 0.1))} aria-label="缩小地图" title="缩小地图"><ZoomOut size={18} /></button>
	</div>
	{#each footprints as item, index (item.id)}
		<span
			class="footprint-map__pin"
			style={pointStyle(item, index)}
			title={`${item.region} · ${item.place}`}
			aria-label={`${item.region} ${item.place}`}
		>
			<MapPin size={20} fill="currentColor" />
		</span>
	{/each}
	{#if footprints.length === 0}
		<div class="footprint-map__empty">
			<MapPin size={28} />
			<p>还没有足迹，先记录第一个想珍藏的地方吧。</p>
		</div>
	{/if}
	<button
		class="footprint-map__cluster"
		class:is-active={clustered}
		type="button"
		onclick={() => (clustered = !clustered)}
		aria-pressed={clustered}
	>
		<Layers3 size={17} />
		<span>集群显示</span>
		<i aria-hidden="true"></i>
	</button>
</section>

<div class="footprint-layout">
	<form class="footprint-form" onsubmit={addFootprint}>
		<div class="footprint-section-title">
			<Plus size={19} />
			<h2>添加足迹</h2>
		</div>
		<label>
			<span>地点</span>
			<input bind:value={place} required maxlength="40" placeholder="例如：西湖" />
		</label>
		<label>
			<span>城市 / 地区</span>
			<input bind:value={region} required maxlength="40" placeholder="例如：杭州" />
		</label>
		<label>
			<span>日期</span>
			<input bind:value={date} required type="date" />
		</label>
		<label>
			<span>一句记录</span>
			<textarea bind:value={note} maxlength="140" rows="3" placeholder="天气、故事或当时的心情"></textarea>
		</label>
		<button type="submit">
			<Plus size={18} />
			保存足迹
		</button>
		<p>记录仅保存在当前浏览器，不会上传你的私人位置。</p>
	</form>

	<section class="footprint-list">
		<div class="footprint-list__toolbar">
			<div class="footprint-section-title">
				<CalendarDays size={19} />
				<h2>旅行记录</h2>
			</div>
			<label class="footprint-search">
				<Search size={17} />
				<input bind:value={query} aria-label="搜索足迹" placeholder="搜索地点" />
			</label>
		</div>

		{#if filtered.length > 0}
			<div class="footprint-list__items">
				{#each filtered as item (item.id)}
					<article>
						<div class="footprint-list__marker">
							<MapPin size={18} fill="currentColor" />
						</div>
						<div>
							<p class="footprint-list__meta">
								<span>{item.region}</span>
								<time datetime={item.date}>{item.date}</time>
							</p>
							<h3>{item.place}</h3>
							{#if item.note}<p class="footprint-list__note">{item.note}</p>{/if}
						</div>
						<button
							type="button"
							onclick={() => removeFootprint(item.id)}
							aria-label={`删除 ${item.place}`}
							title="删除这条足迹"
						>
							<Trash2 size={17} />
						</button>
					</article>
				{/each}
			</div>
		{:else}
			<div class="footprint-list__empty">
				<p>{query ? "没有找到匹配的地点。" : "足迹时间线还是空的。"}</p>
			</div>
		{/if}
	</section>
</div>

<style>
	.footprint-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-bottom: 1.5rem;
	}

	.footprint-stats > div {
		display: inline-flex;
		min-height: 2.45rem;
		align-items: center;
		gap: 0.35rem;
		border: 1.5px solid var(--record-ink, #111);
		border-radius: 999px;
		background: var(--card-bg);
		padding: 0.35rem 0.85rem;
		color: var(--record-ink, var(--deep-text));
	}

	.footprint-stats strong {
		font-size: 0.86rem;
		font-weight: 760;
	}

	.footprint-stats span {
		color: var(--record-ink, var(--deep-text));
		font-size: 0.78rem;
	}

	.footprint-map-heading {
		margin: 0 0 1rem;
		color: var(--record-ink, var(--deep-text));
		font-size: 1.05rem;
		font-weight: 720;
	}

	.footprint-map {
		position: relative;
		min-height: 31rem;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--record-ink, #111) 14%, transparent);
		border-radius: 0.75rem;
		background:
			radial-gradient(circle at 30% 35%, color-mix(in srgb, var(--primary) 9%, transparent), transparent 24%),
			radial-gradient(circle at 70% 64%, color-mix(in srgb, var(--primary) 7%, transparent), transparent 28%),
			color-mix(in srgb, var(--card-bg) 97%, var(--primary) 3%);
	}

	.footprint-map:fullscreen {
		border-radius: 0;
		background: var(--card-bg);
	}

	.footprint-map__grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(color-mix(in srgb, var(--line-divider) 70%, transparent) 1px, transparent 1px),
			linear-gradient(90deg, color-mix(in srgb, var(--line-divider) 70%, transparent) 1px, transparent 1px);
		background-size: calc(2.25rem * var(--map-zoom, 1)) calc(2.25rem * var(--map-zoom, 1));
		mask-image: linear-gradient(to bottom, transparent, #000 15%, #000 85%, transparent);
		transition: background-size 180ms ease;
	}

	.footprint-map__toolbar {
		position: absolute;
		z-index: 4;
		top: 1rem;
		right: 1rem;
		display: grid;
		gap: 0.35rem;
	}

	.footprint-map__toolbar button {
		display: grid;
		width: 2.35rem;
		height: 2.35rem;
		place-items: center;
		border: 0;
		border-radius: 0.35rem;
		background: color-mix(in srgb, var(--card-bg) 95%, transparent);
		box-shadow: 0 0.25rem 0.75rem rgb(0 0 0 / 10%);
		color: var(--record-ink, var(--deep-text));
		cursor: pointer;
	}

	.footprint-map__toolbar button:hover,
	.footprint-map__toolbar button:focus-visible {
		color: var(--primary);
		outline: 2px solid color-mix(in srgb, var(--primary) 35%, transparent);
	}

	.footprint-map__pin {
		position: absolute;
		z-index: 2;
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border: 2px solid color-mix(in srgb, var(--card-bg) 82%, transparent);
		border-radius: 50%;
		background: var(--primary);
		box-shadow: 0 0.45rem 1rem color-mix(in srgb, var(--primary) 35%, transparent);
		color: white;
		transform: translate(-50%, -50%);
	}

	.footprint-map.is-clustered .footprint-map__pin {
		width: 2.35rem;
		height: 2.35rem;
		box-shadow: 0 0 0 0.4rem color-mix(in srgb, var(--primary) 15%, transparent), 0 0.45rem 1rem color-mix(in srgb, var(--primary) 28%, transparent);
	}

	.footprint-map__empty {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		justify-items: center;
		color: var(--content-meta);
		text-align: center;
	}

	.footprint-map__empty p {
		margin: 0.65rem 1rem 0;
	}

	.footprint-map__cluster {
		position: absolute;
		z-index: 4;
		bottom: 1.1rem;
		left: 50%;
		display: flex;
		min-height: 2.65rem;
		align-items: center;
		gap: 0.5rem;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--card-bg) 95%, transparent);
		box-shadow: 0 0.35rem 1rem rgb(0 0 0 / 12%);
		padding: 0.35rem 0.55rem 0.35rem 0.85rem;
		color: var(--record-ink, var(--deep-text));
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
		transform: translateX(-50%);
	}

	.footprint-map__cluster i {
		position: relative;
		display: block;
		width: 2.25rem;
		height: 1.25rem;
		border-radius: 999px;
		background: var(--btn-regular-bg);
	}

	.footprint-map__cluster i::after {
		position: absolute;
		top: 0.15rem;
		left: 0.15rem;
		width: 0.95rem;
		height: 0.95rem;
		border-radius: 50%;
		background: var(--content-meta);
		content: "";
		transition: transform 160ms ease, background-color 160ms ease;
	}

	.footprint-map__cluster.is-active i {
		background: color-mix(in srgb, var(--primary) 25%, var(--btn-regular-bg));
	}

	.footprint-map__cluster.is-active i::after {
		background: var(--primary);
		transform: translateX(1rem);
	}

	.footprint-layout {
		display: grid;
		grid-template-columns: minmax(15rem, 0.8fr) minmax(0, 1.2fr);
		gap: 1rem;
		margin-top: 1rem;
	}

	.footprint-form,
	.footprint-list {
		border: 1px solid var(--line-divider);
		border-radius: 1.1rem;
		background: color-mix(in srgb, var(--card-bg) 94%, transparent);
		padding: 1rem;
	}

	.footprint-section-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--deep-text);
	}

	.footprint-section-title h2 {
		margin: 0;
		font-size: 1.1rem;
	}

	.footprint-form label {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.85rem;
	}

	.footprint-form label > span {
		color: var(--content-meta);
		font-size: 0.84rem;
		font-weight: 600;
	}

	input,
	textarea {
		width: 100%;
		border: 1px solid var(--line-divider);
		border-radius: 0.75rem;
		background: var(--card-bg);
		padding: 0.7rem 0.8rem;
		color: var(--deep-text);
		font: inherit;
	}

	input:focus,
	textarea:focus {
		border-color: var(--primary);
		outline: 2px solid color-mix(in srgb, var(--primary) 22%, transparent);
		outline-offset: 1px;
	}

	.footprint-form > button {
		display: flex;
		width: 100%;
		min-height: 2.75rem;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		margin-top: 1rem;
		border: 0;
		border-radius: 0.8rem;
		background: var(--primary);
		color: white;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	.footprint-form > p {
		margin: 0.65rem 0 0;
		color: var(--content-meta);
		font-size: 0.75rem;
		line-height: 1.45;
	}

	.footprint-list__toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.footprint-search {
		display: flex;
		max-width: 12rem;
		align-items: center;
		gap: 0.35rem;
		color: var(--content-meta);
	}

	.footprint-search input {
		min-width: 0;
		padding-block: 0.55rem;
	}

	.footprint-list__items {
		display: grid;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.footprint-list__items article {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.75rem;
		align-items: start;
		border: 1px solid var(--line-divider);
		border-radius: 0.9rem;
		padding: 0.8rem;
	}

	.footprint-list__marker {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border-radius: 0.65rem;
		background: color-mix(in srgb, var(--primary) 12%, var(--card-bg));
		color: var(--primary);
	}

	.footprint-list__meta {
		display: flex;
		gap: 0.55rem;
		margin: 0;
		color: var(--content-meta);
		font-size: 0.78rem;
	}

	.footprint-list h3 {
		margin: 0.15rem 0 0;
		color: var(--deep-text);
		font-size: 1rem;
	}

	.footprint-list__note {
		margin: 0.35rem 0 0;
		color: var(--content-meta);
		font-size: 0.88rem;
	}

	.footprint-list__items article > button {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border: 0;
		border-radius: 0.6rem;
		background: transparent;
		color: var(--content-meta);
		cursor: pointer;
	}

	.footprint-list__items article > button:hover {
		background: color-mix(in srgb, #ef4444 10%, transparent);
		color: #ef4444;
	}

	.footprint-list__empty {
		display: grid;
		min-height: 12rem;
		place-items: center;
		color: var(--content-meta);
		text-align: center;
	}

	:global(html.dark) .footprint-stats strong,
	:global(html.dark) .footprint-section-title,
	:global(html.dark) .footprint-list h3,
	:global(html.dark) input,
	:global(html.dark) textarea {
		color: rgb(255 255 255 / 88%);
	}

	@media (max-width: 760px) {
		.footprint-layout {
			grid-template-columns: 1fr;
		}

		.footprint-map {
			min-height: 24rem;
		}
	}

	@media (max-width: 480px) {
		.footprint-stats { gap: 0.4rem; }
		.footprint-stats > div { padding-inline: 0.65rem; }

		.footprint-list__toolbar {
			align-items: stretch;
			flex-direction: column;
		}

		.footprint-search {
			max-width: none;
		}
	}
</style>
