<script lang="ts">
import type {
	Map as LeafletMap,
	Marker as LeafletMarker,
	LeafletMouseEvent,
} from "leaflet";
import {
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	Crosshair,
	Focus,
	Layers3,
	Lock,
	MapPin,
	Maximize2,
	Plus,
	Route,
	Search,
	Trash2,
	Unlock,
	ZoomIn,
	ZoomOut,
} from "lucide-svelte";
import "leaflet/dist/leaflet.css";
import { onMount } from "svelte";

type Footprint = {
	id: string;
	place: string;
	region: string;
	date: string;
	note: string;
	visits?: number;
	lng?: number;
	lat?: number;
};

type MarkerGroup = {
	items: Footprint[];
	lng: number;
	lat: number;
	x: number;
	y: number;
};

const storageKey = "jingyue-record-footprints";
const defaultCenter: [number, number] = [104.1954, 35.8617];
const tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

let footprints = $state<Footprint[]>([]);
let place = $state("");
let region = $state("");
let date = $state(new Date().toISOString().slice(0, 10));
let note = $state("");
let visits = $state(1);
let query = $state("");
let clustered = $state(true);
let filtersExpanded = $state(false);
let selectedYear = $state("all");
let mapUnlocked = $state(false);
let mapLoading = $state(true);
let mapError = $state("");
let selectedLng = $state<number | null>(null);
let selectedLat = $state<number | null>(null);
let relocatingId = $state<string | null>(null);
let formError = $state("");
let mapShell: HTMLElement | undefined;
let mapCanvas: HTMLDivElement | undefined;
let leaflet: typeof import("leaflet") | null = null;
let map: LeafletMap | null = null;
let renderedMarkers: LeafletMarker[] = [];
let draftMarker: LeafletMarker | null = null;

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
const totalVisits = $derived(
	footprints.reduce((sum, item) => sum + Math.max(1, item.visits ?? 1), 0),
);
const availableYears = $derived(
	Array.from(
		new Set(footprints.map((item) => item.date.slice(0, 4)).filter(Boolean)),
	).sort((a, b) => b.localeCompare(a)),
);

function hasCoordinates(item: Footprint): item is Footprint & {
	lng: number;
	lat: number;
} {
	return Number.isFinite(item.lng) && Number.isFinite(item.lat);
}

function persist() {
	localStorage.setItem(storageKey, JSON.stringify(footprints));
}

function getVisibleFootprints(): Footprint[] {
	return footprints.filter(
		(item) => selectedYear === "all" || item.date.startsWith(selectedYear),
	);
}

function clearRenderedMarkers() {
	for (const marker of renderedMarkers) marker.remove();
	renderedMarkers = [];
}

function buildMarkerGroups(items: Footprint[]): MarkerGroup[] {
	if (!map) return [];
	const groups: MarkerGroup[] = [];

	for (const item of items.filter(hasCoordinates)) {
		const point = map.latLngToContainerPoint([item.lat, item.lng]);
		const match = clustered
			? groups.find(
					(group) => Math.hypot(group.x - point.x, group.y - point.y) < 64,
				)
			: undefined;

		if (!match) {
			groups.push({
				items: [item],
				lng: item.lng,
				lat: item.lat,
				x: point.x,
				y: point.y,
			});
			continue;
		}

		const nextSize = match.items.length + 1;
		match.items.push(item);
		match.lng = (match.lng * (nextSize - 1) + item.lng) / nextSize;
		match.lat = (match.lat * (nextSize - 1) + item.lat) / nextSize;
		const nextPoint = map.latLngToContainerPoint([match.lat, match.lng]);
		match.x = nextPoint.x;
		match.y = nextPoint.y;
	}

	return groups;
}

function createPopupContent(group: MarkerGroup): HTMLElement {
	const wrapper = document.createElement("div");
	wrapper.className = "footprint-popup";

	const title = document.createElement("strong");
	title.textContent =
		group.items.length > 1
			? `${group.items.length} 个足迹`
			: group.items[0].place;
	wrapper.append(title);

	for (const item of group.items.slice(0, 4)) {
		const row = document.createElement("span");
		row.textContent = `${item.region} · ${item.place} · ${item.date}`;
		wrapper.append(row);
	}

	return wrapper;
}

function renderMarkers() {
	if (!map || !leaflet) return;
	clearRenderedMarkers();

	for (const group of buildMarkerGroups(getVisibleFootprints())) {
		const markerElement = document.createElement("button");
		markerElement.type = "button";
		markerElement.className =
			group.items.length > 1
				? "jingyue-footprint-marker is-cluster"
				: "jingyue-footprint-marker";
		markerElement.textContent =
			group.items.length > 1 ? String(group.items.length) : "";
		markerElement.setAttribute(
			"aria-label",
			group.items.length > 1
				? `${group.items.length} 个足迹`
				: `${group.items[0].region} ${group.items[0].place}`,
		);

		const markerIcon = leaflet.divIcon({
			className: "jingyue-leaflet-marker",
			html: markerElement,
			iconAnchor: [18, 18],
			iconSize: [36, 36],
		});
		const marker = leaflet
			.marker([group.lat, group.lng], { icon: markerIcon })
			.bindPopup(createPopupContent(group), {
				closeButton: false,
				offset: [0, -12],
			})
			.addTo(map);
		renderedMarkers.push(marker);
	}
}

function renderDraftMarker() {
	draftMarker?.remove();
	draftMarker = null;
	if (!map || !leaflet || selectedLng === null || selectedLat === null) return;

	const markerElement = document.createElement("span");
	markerElement.className = "jingyue-footprint-marker is-draft";
	const markerIcon = leaflet.divIcon({
		className: "jingyue-leaflet-marker",
		html: markerElement,
		iconAnchor: [10, 10],
		iconSize: [20, 20],
	});
	draftMarker = leaflet
		.marker([selectedLat, selectedLng], { icon: markerIcon })
		.addTo(map);
}

function scheduleMarkerRender() {
	if (typeof window === "undefined") return;
	window.requestAnimationFrame(() => {
		renderMarkers();
		renderDraftMarker();
	});
}

function handleMapClick(event: LeafletMouseEvent) {
	if (!mapUnlocked) return;
	const { lng, lat } = event.latlng;

	if (relocatingId) {
		footprints = footprints.map((item) =>
			item.id === relocatingId ? { ...item, lng, lat } : item,
		);
		persist();
		relocatingId = null;
		formError = "";
		scheduleMarkerRender();
		return;
	}

	selectedLng = lng;
	selectedLat = lat;
	formError = "";
	renderDraftMarker();
}

function selectYear(year: string) {
	selectedYear = year;
	scheduleMarkerRender();
}

function toggleClustered() {
	clustered = !clustered;
	scheduleMarkerRender();
}

function fitFootprints() {
	if (!map || !leaflet) return;
	const points = getVisibleFootprints().filter(hasCoordinates);
	if (points.length === 0) {
		map.flyTo([defaultCenter[1], defaultCenter[0]], 3, { duration: 0.65 });
		return;
	}

	if (points.length === 1) {
		map.flyTo([points[0].lat, points[0].lng], 7, { duration: 0.65 });
		return;
	}

	const bounds = leaflet.latLngBounds(
		points.map((item) => [item.lat, item.lng]),
	);
	map.flyToBounds(bounds, {
		padding: [70, 70],
		maxZoom: 8,
		duration: 0.65,
	});
}

function toggleFullscreen() {
	if (!document.fullscreenElement) void mapShell?.requestFullscreen();
	else void document.exitFullscreen();
}

function addFootprint(event: SubmitEvent) {
	event.preventDefault();
	if (!place.trim() || !region.trim() || !date) return;
	if (selectedLng === null || selectedLat === null) {
		formError = "请先点击地图解锁，再在地图中选择足迹位置。";
		return;
	}

	footprints = [
		{
			id: crypto.randomUUID(),
			place: place.trim(),
			region: region.trim(),
			date,
			note: note.trim(),
			visits: Math.max(1, Math.round(visits || 1)),
			lng: selectedLng,
			lat: selectedLat,
		},
		...footprints,
	];
	persist();
	place = "";
	region = "";
	note = "";
	visits = 1;
	selectedLng = null;
	selectedLat = null;
	formError = "";
	draftMarker?.remove();
	draftMarker = null;
	scheduleMarkerRender();
}

function removeFootprint(id: string) {
	footprints = footprints.filter((item) => item.id !== id);
	if (relocatingId === id) relocatingId = null;
	persist();
	scheduleMarkerRender();
}

function startRelocating(item: Footprint) {
	relocatingId = item.id;
	mapUnlocked = true;
	formError = `请在地图中点击，为「${item.place}」更新位置。`;
	mapShell?.scrollIntoView({ behavior: "smooth", block: "center" });
}

onMount(() => {
	let destroyed = false;
	const handleFullscreenChange = () =>
		window.setTimeout(() => map?.invalidateSize(), 80);

	try {
		const saved = localStorage.getItem(storageKey);
		const parsed = saved ? JSON.parse(saved) : [];
		if (Array.isArray(parsed)) footprints = parsed;
	} catch {
		footprints = [];
	}

	if (!mapCanvas) return;

	async function initializeMap() {
		try {
			leaflet = await import("leaflet");
			if (destroyed || !mapCanvas || !leaflet) return;

			map = leaflet.map(mapCanvas, {
				zoomControl: false,
				minZoom: 2,
				maxZoom: 18,
				worldCopyJump: true,
			});
			map.setView([defaultCenter[1], defaultCenter[0]], 3);

			const tiles = leaflet.tileLayer(tileUrl, {
				maxZoom: 19,
				attribution:
					'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
			});
			tiles.on("load", () => {
				mapLoading = false;
				mapError = "";
				renderMarkers();
			});
			tiles.on("tileerror", () => {
				mapLoading = false;
				mapError = "地图底图暂时无法加载，仍可稍后刷新重试。";
			});
			tiles.addTo(map);
			leaflet.control.scale({ imperial: false }).addTo(map);
			map.whenReady(() => {
				mapLoading = false;
				renderMarkers();
			});
			map.on("click", handleMapClick);
			map.on("moveend", renderMarkers);
			map.on("zoomend", renderMarkers);
		} catch {
			mapLoading = false;
			mapError = "地图加载失败，请检查网络后刷新页面。";
		}
	}

	document.addEventListener("fullscreenchange", handleFullscreenChange);
	void initializeMap();

	return () => {
		destroyed = true;
		document.removeEventListener("fullscreenchange", handleFullscreenChange);
		clearRenderedMarkers();
		draftMarker?.remove();
		draftMarker = null;
		map?.remove();
		map = null;
		leaflet = null;
	};
});
</script>

<div class="footprint-stats" aria-label="足迹统计">
	<div>
		<MapPin size={15} aria-hidden="true" />
		<strong>{footprints.length}</strong>
		<span>地点</span>
	</div>
	<div>
		<Route size={15} aria-hidden="true" />
		<strong>{totalVisits}</strong>
		<span>到访次数</span>
	</div>
	<div>
		<CalendarDays size={15} aria-hidden="true" />
		<strong>{currentYearCount}</strong>
		<span>今年出行</span>
	</div>
</div>

<h2 class="footprint-map-heading">足迹地图</h2>

<section
	bind:this={mapShell}
	class:is-unlocked={mapUnlocked}
	class="footprint-map"
	aria-label="足迹地图"
>
	<div bind:this={mapCanvas} class="footprint-map__canvas"></div>

	<div class:is-expanded={filtersExpanded} class="footprint-map__filters">
		<button
			class="footprint-map__filter-toggle"
			type="button"
			onclick={() => (filtersExpanded = !filtersExpanded)}
			aria-label={filtersExpanded ? "收起地图筛选" : "展开地图筛选"}
			aria-expanded={filtersExpanded}
		>
			{#if filtersExpanded}<ChevronLeft size={18} />{:else}<ChevronRight size={18} />{/if}
		</button>
		{#if filtersExpanded}
			<button
				class:is-active={selectedYear === "all"}
				class="footprint-map__filter"
				type="button"
				onclick={() => selectYear("all")}
			>
				全部足迹
			</button>
			{#each availableYears as year (year)}
				<button
					class:is-active={selectedYear === year}
					class="footprint-map__filter"
					type="button"
					onclick={() => selectYear(year)}
				>
					{year}
				</button>
			{/each}
		{/if}
	</div>

	<div class="footprint-map__toolbar" aria-label="地图控制">
		<button
			type="button"
			onclick={() => (mapUnlocked = !mapUnlocked)}
			aria-label={mapUnlocked ? "锁定地图" : "解锁地图"}
			title={mapUnlocked ? "锁定地图" : "解锁地图"}
		>
			{#if mapUnlocked}<Unlock size={18} />{:else}<Lock size={18} />{/if}
		</button>
		<button type="button" onclick={toggleFullscreen} aria-label="全屏查看地图" title="全屏查看地图"><Maximize2 size={18} /></button>
		<button type="button" onclick={fitFootprints} aria-label="重置地图视野" title="重置地图视野"><Focus size={18} /></button>
		<button type="button" onclick={() => map?.zoomIn()} aria-label="放大地图" title="放大地图"><ZoomIn size={18} /></button>
		<button type="button" onclick={() => map?.zoomOut()} aria-label="缩小地图" title="缩小地图"><ZoomOut size={18} /></button>
	</div>

	<button
		class:is-active={clustered}
		class="footprint-map__cluster"
		type="button"
		onclick={toggleClustered}
		aria-pressed={clustered}
	>
		<Layers3 size={17} aria-hidden="true" />
		<span>集群显示</span>
		<i aria-hidden="true"></i>
	</button>

	{#if !mapUnlocked}
		<button class="footprint-map__lock-overlay" type="button" onclick={() => (mapUnlocked = true)}>
			<Lock size={26} aria-hidden="true" />
			<span>点击解锁地图交互</span>
			<small>解锁后可拖动地图并点击选择足迹位置</small>
		</button>
	{/if}

	{#if mapLoading}
		<div class="footprint-map__state" role="status">正在加载地图...</div>
	{:else if mapError}
		<div class="footprint-map__state is-error" role="alert">{mapError}</div>
	{/if}
</section>

<p class="footprint-map-provider">
	地图由
	<a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet</a>
	与
	<a href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
	提供
</p>

<div class="footprint-divider" aria-hidden="true"><span></span><Route size={19} /><span></span></div>

<div class="footprint-layout">
	<form class="footprint-form" onsubmit={addFootprint}>
		<div class="footprint-section-title">
			<Plus size={19} aria-hidden="true" />
			<h2>添加足迹</h2>
		</div>
		<p class="footprint-form__hint">先解锁地图并点击位置，再填写这段旅程。</p>
		<div class="footprint-form__grid">
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
				<span>到访次数</span>
				<input bind:value={visits} required type="number" min="1" max="999" />
			</label>
		</div>
		<label>
			<span>一句记录</span>
			<textarea bind:value={note} maxlength="140" rows="3" placeholder="天气、故事或当时的心情"></textarea>
		</label>
		<div class:is-selected={selectedLng !== null} class="footprint-coordinate">
			<Crosshair size={17} aria-hidden="true" />
			<span>
				{selectedLng === null || selectedLat === null
					? "尚未在地图中选择位置"
					: `已选位置 ${selectedLng.toFixed(4)}, ${selectedLat.toFixed(4)}`}
			</span>
		</div>
		{#if formError}<p class="footprint-form__error" role="alert">{formError}</p>{/if}
		<button type="submit">
			<Plus size={18} aria-hidden="true" />
			保存足迹
		</button>
		<p class="footprint-form__privacy">记录仅保存在当前浏览器，不会上传你的私人位置。</p>
	</form>

	<section class="footprint-list">
		<div class="footprint-list__toolbar">
			<div class="footprint-section-title">
				<CalendarDays size={19} aria-hidden="true" />
				<h2>旅行记录</h2>
			</div>
			<label class="footprint-search">
				<Search size={17} aria-hidden="true" />
				<input bind:value={query} aria-label="搜索足迹" placeholder="搜索地点" />
			</label>
		</div>

		{#if filtered.length > 0}
			<div class="footprint-list__items">
				{#each filtered as item (item.id)}
					<article>
						<div class="footprint-list__marker">
							<MapPin size={18} fill="currentColor" aria-hidden="true" />
						</div>
						<div>
							<p class="footprint-list__meta">
								<span>{item.region}</span>
								<time datetime={item.date}>{item.date}</time>
								<span>{Math.max(1, item.visits ?? 1)} 次到访</span>
							</p>
							<h3>{item.place}</h3>
							{#if item.note}<p class="footprint-list__note">{item.note}</p>{/if}
						</div>
						<div class="footprint-list__actions">
							<button
								class:is-active={relocatingId === item.id}
								type="button"
								onclick={() => startRelocating(item)}
								aria-label={`在地图中定位 ${item.place}`}
								title="重新选择地图位置"
							>
								<Crosshair size={17} aria-hidden="true" />
							</button>
							<button
								type="button"
								onclick={() => removeFootprint(item.id)}
								aria-label={`删除 ${item.place}`}
								title="删除这条足迹"
							>
								<Trash2 size={17} aria-hidden="true" />
							</button>
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<div class="footprint-list__empty">
				<MapPin size={28} aria-hidden="true" />
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
		min-height: 2.4rem;
		align-items: center;
		gap: 0.35rem;
		border: 1.5px solid var(--record-ink, #111);
		border-radius: 999px;
		background: transparent;
		padding: 0.35rem 0.85rem;
		color: var(--record-ink, var(--deep-text));
	}

	.footprint-stats strong {
		font-size: 0.86rem;
		font-weight: 760;
	}

	.footprint-stats span {
		font-size: 0.78rem;
	}

	.footprint-map-heading {
		margin: 0 0 0.9rem;
		color: var(--record-ink, var(--deep-text));
		font-size: 1.05rem;
		font-weight: 750;
	}

	.footprint-map {
		position: relative;
		height: 31.25rem;
		overflow: hidden;
		border: 1px solid color-mix(in srgb, var(--record-ink, #111) 10%, transparent);
		border-radius: 0.75rem;
		background: var(--card-bg);
	}

	.footprint-map:fullscreen {
		height: 100dvh;
		border: 0;
		border-radius: 0;
	}

	.footprint-map__canvas {
		position: absolute;
		z-index: 0;
		inset: 0;
	}

	.footprint-map__filters {
		position: absolute;
		z-index: 12;
		top: 0.65rem;
		left: 0.65rem;
		display: flex;
		max-width: 2.5rem;
		align-items: center;
		gap: 0.35rem;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in srgb, var(--card-bg) 92%, transparent);
		box-shadow: 0 0.3rem 1.1rem rgb(0 0 0 / 14%);
		padding: 0.35rem;
		backdrop-filter: blur(0.75rem);
		transition: max-width 280ms ease;
	}

	.footprint-map__filters.is-expanded {
		max-width: calc(100% - 5.5rem);
	}

	.footprint-map__filter-toggle,
	.footprint-map__filter {
		border: 0;
		background: transparent;
		color: var(--record-ink, var(--deep-text));
		font: inherit;
		cursor: pointer;
	}

	.footprint-map__filter-toggle {
		display: grid;
		width: 1.8rem;
		height: 1.8rem;
		flex: 0 0 auto;
		place-items: center;
		border-radius: 50%;
	}

	.footprint-map__filter-toggle:hover,
	.footprint-map__filter-toggle:focus-visible {
		background: color-mix(in srgb, var(--record-ink, #111) 8%, transparent);
		outline: none;
	}

	.footprint-map__filter {
		flex: 0 0 auto;
		border-radius: 999px;
		padding: 0.42rem 0.7rem;
		font-size: 0.76rem;
		transition: background-color 180ms ease, color 180ms ease;
	}

	.footprint-map__filter:hover,
	.footprint-map__filter:focus-visible,
	.footprint-map__filter.is-active {
		background: var(--record-ink, #111);
		color: var(--card-bg);
		outline: none;
	}

	.footprint-map__toolbar {
		position: absolute;
		z-index: 22;
		top: 0.75rem;
		right: 0.75rem;
		display: grid;
		gap: 0.45rem;
	}

	.footprint-map__toolbar button {
		display: grid;
		width: 2.2rem;
		height: 2.2rem;
		place-items: center;
		border: 0;
		border-radius: 0.35rem;
		background: color-mix(in srgb, var(--card-bg) 94%, transparent);
		box-shadow: 0 0.2rem 0.75rem rgb(0 0 0 / 18%);
		color: var(--record-ink, var(--deep-text));
		cursor: pointer;
		transition: background-color 180ms ease, color 180ms ease;
	}

	.footprint-map__toolbar button:hover,
	.footprint-map__toolbar button:focus-visible {
		background: var(--record-ink, #111);
		color: var(--card-bg);
		outline: 2px solid color-mix(in srgb, var(--primary) 40%, transparent);
		outline-offset: 1px;
	}

	.footprint-map__cluster {
		position: absolute;
		z-index: 22;
		bottom: 1.1rem;
		left: 50%;
		display: flex;
		min-height: 2.65rem;
		align-items: center;
		gap: 0.5rem;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--card-bg) 95%, transparent);
		box-shadow: 0 0.35rem 1rem rgb(0 0 0 / 16%);
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
		width: 2.5rem;
		height: 1.4rem;
		border-radius: 999px;
		background: #b7bec7;
		transition: background-color 180ms ease;
	}

	.footprint-map__cluster i::after {
		position: absolute;
		top: 0.15rem;
		left: 0.15rem;
		width: 1.1rem;
		height: 1.1rem;
		border-radius: 50%;
		background: white;
		box-shadow: 0 0.1rem 0.25rem rgb(0 0 0 / 25%);
		content: "";
		transition: transform 180ms ease;
	}

	.footprint-map__cluster.is-active i {
		background: #06beb6;
	}

	.footprint-map__cluster.is-active i::after {
		transform: translateX(1.1rem);
	}

	.footprint-map__lock-overlay {
		position: absolute;
		z-index: 20;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		gap: 0.45rem;
		border: 0;
		background: rgb(255 255 255 / 55%);
		color: #27313d;
		font: inherit;
		font-size: 0.82rem;
		font-weight: 650;
		cursor: pointer;
		backdrop-filter: grayscale(0.35);
		transition: background-color 200ms ease;
	}

	.footprint-map__lock-overlay:hover {
		background: rgb(255 255 255 / 46%);
	}

	.footprint-map__lock-overlay small {
		font-size: 0.72rem;
		font-weight: 500;
		opacity: 0.72;
	}

	.footprint-map__state {
		position: absolute;
		z-index: 30;
		inset: 0;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--card-bg) 92%, transparent);
		color: var(--content-meta);
		font-size: 0.86rem;
	}

	.footprint-map__state.is-error {
		color: #dc2626;
	}

	.footprint-map-provider {
		margin: 0.65rem 0 0;
		color: var(--record-muted, var(--content-meta));
		font-size: 0.7rem;
		text-align: center;
	}

	.footprint-map-provider a {
		color: inherit;
		text-decoration: none;
	}

	.footprint-map-provider a:hover {
		color: var(--primary);
	}

	.footprint-divider {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.6rem;
		margin: 2.6rem 1.5rem 1.8rem;
		color: var(--record-muted, var(--content-meta));
	}

	.footprint-divider span {
		border-top: 1px dashed color-mix(in srgb, var(--record-muted, #777) 38%, transparent);
	}

	.footprint-layout {
		display: grid;
		grid-template-columns: minmax(17rem, 0.85fr) minmax(0, 1.15fr);
		gap: 1rem;
	}

	.footprint-form,
	.footprint-list {
		border: 1px solid color-mix(in srgb, var(--record-ink, #111) 14%, transparent);
		border-radius: 0.75rem;
		background: color-mix(in srgb, var(--card-bg) 97%, transparent);
		padding: 1rem;
	}

	.footprint-section-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--record-ink, var(--deep-text));
	}

	.footprint-section-title h2 {
		margin: 0;
		font-size: 1.05rem;
	}

	.footprint-form__hint {
		margin: 0.45rem 0 0;
		color: var(--record-muted, var(--content-meta));
		font-size: 0.76rem;
	}

	.footprint-form__grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0 0.75rem;
	}

	.footprint-form label {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.8rem;
	}

	.footprint-form label > span {
		color: var(--record-muted, var(--content-meta));
		font-size: 0.8rem;
		font-weight: 650;
	}

	input,
	textarea {
		width: 100%;
		border: 1px solid color-mix(in srgb, var(--record-ink, #111) 16%, transparent);
		border-radius: 0.55rem;
		background: var(--card-bg);
		padding: 0.67rem 0.75rem;
		color: var(--record-ink, var(--deep-text));
		font: inherit;
	}

	input:focus,
	textarea:focus {
		border-color: var(--primary);
		outline: 2px solid color-mix(in srgb, var(--primary) 22%, transparent);
		outline-offset: 1px;
	}

	.footprint-coordinate {
		display: flex;
		align-items: center;
		gap: 0.45rem;
		margin-top: 0.8rem;
		border: 1px dashed color-mix(in srgb, var(--record-muted, #777) 36%, transparent);
		border-radius: 0.55rem;
		padding: 0.6rem 0.7rem;
		color: var(--record-muted, var(--content-meta));
		font-size: 0.75rem;
	}

	.footprint-coordinate.is-selected {
		border-color: color-mix(in srgb, #06beb6 55%, transparent);
		color: #07978f;
	}

	.footprint-form__error {
		margin: 0.65rem 0 0;
		color: #dc2626;
		font-size: 0.75rem;
		line-height: 1.45;
	}

	.footprint-form > button {
		display: flex;
		width: 100%;
		min-height: 2.65rem;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		margin-top: 0.85rem;
		border: 0;
		border-radius: 0.55rem;
		background: var(--record-ink, #111);
		color: var(--card-bg);
		font: inherit;
		font-weight: 700;
		cursor: pointer;
		transition: opacity 180ms ease;
	}

	.footprint-form > button:hover {
		opacity: 0.82;
	}

	.footprint-form__privacy {
		margin: 0.55rem 0 0;
		color: var(--record-muted, var(--content-meta));
		font-size: 0.68rem;
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
		max-width: 11rem;
		align-items: center;
		gap: 0.35rem;
		color: var(--record-muted, var(--content-meta));
	}

	.footprint-search input {
		min-width: 0;
		padding-block: 0.5rem;
	}

	.footprint-list__items {
		display: grid;
		gap: 0.5rem;
		margin-top: 0.9rem;
	}

	.footprint-list__items article {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.7rem;
		align-items: start;
		border-bottom: 1px solid color-mix(in srgb, var(--record-ink, #111) 10%, transparent);
		padding: 0.55rem 0 0.75rem;
	}

	.footprint-list__items article:last-child {
		border-bottom: 0;
	}

	.footprint-list__marker {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border-radius: 50%;
		background: color-mix(in srgb, #06beb6 13%, var(--card-bg));
		color: #07978f;
	}

	.footprint-list__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin: 0;
		color: var(--record-muted, var(--content-meta));
		font-size: 0.7rem;
	}

	.footprint-list h3 {
		margin: 0.12rem 0 0;
		color: var(--record-ink, var(--deep-text));
		font-size: 0.95rem;
	}

	.footprint-list__note {
		margin: 0.25rem 0 0;
		color: var(--record-muted, var(--content-meta));
		font-size: 0.8rem;
	}

	.footprint-list__actions {
		display: flex;
		gap: 0.2rem;
	}

	.footprint-list__actions button {
		display: grid;
		width: 1.85rem;
		height: 1.85rem;
		place-items: center;
		border: 0;
		border-radius: 0.45rem;
		background: transparent;
		color: var(--record-muted, var(--content-meta));
		cursor: pointer;
	}

	.footprint-list__actions button:first-child:hover,
	.footprint-list__actions button:first-child.is-active {
		background: color-mix(in srgb, #06beb6 12%, transparent);
		color: #07978f;
	}

	.footprint-list__actions button:last-child:hover {
		background: color-mix(in srgb, #ef4444 10%, transparent);
		color: #ef4444;
	}

	.footprint-list__empty {
		display: grid;
		min-height: 13rem;
		place-content: center;
		justify-items: center;
		color: var(--record-muted, var(--content-meta));
		text-align: center;
	}

	.footprint-list__empty p {
		margin: 0.55rem 0 0;
		font-size: 0.8rem;
	}

	:global(.jingyue-footprint-marker) {
		display: grid;
		width: 1.1rem;
		height: 1.1rem;
		place-items: center;
		border: 2px solid rgb(255 255 255 / 72%);
		border-radius: 50%;
		background: linear-gradient(135deg, #06beb6, #48b1bf);
		box-shadow: 0 0.3rem 0.8rem rgb(0 0 0 / 26%);
		color: white;
		cursor: pointer;
		font: inherit;
		font-size: 0.72rem;
		font-weight: 750;
	}

	:global(.jingyue-footprint-marker.is-cluster) {
		width: 2.5rem;
		height: 2.5rem;
		border-width: 1px;
		background: linear-gradient(135deg, rgb(94 231 223 / 88%), rgb(6 190 182 / 88%));
	}

	:global(.jingyue-footprint-marker.is-draft) {
		width: 1.15rem;
		height: 1.15rem;
		border: 3px solid white;
		background: #ff5c7c;
		box-shadow: 0 0 0 0.55rem rgb(255 92 124 / 22%), 0 0.3rem 0.8rem rgb(0 0 0 / 28%);
		pointer-events: none;
	}

	:global(.footprint-popup) {
		display: grid;
		gap: 0.25rem;
		min-width: 10rem;
		color: #111827;
		font-family: inherit;
	}

	:global(.footprint-popup strong) {
		font-size: 0.88rem;
	}

	:global(.footprint-popup span) {
		color: #667085;
		font-size: 0.7rem;
	}

	:global(.footprint-map .leaflet-control-attribution) {
		font-size: 0.6rem;
	}

	:global(.footprint-map .jingyue-leaflet-marker) {
		border: 0;
		background: transparent;
	}

	:global(html.dark .footprint-map .leaflet-tile) {
		filter: brightness(0.53) saturate(0.7) contrast(1.12) hue-rotate(8deg);
	}

	:global(html.dark .footprint-map .leaflet-container) {
		background: #09110e;
	}

	:global(html.dark .footprint-map__lock-overlay) {
		background: rgb(0 0 0 / 58%);
		color: rgb(255 255 255 / 86%);
	}

	:global(html.dark .footprint-coordinate.is-selected) {
		color: #5ee7df;
	}

	@media (max-width: 760px) {
		.footprint-layout {
			grid-template-columns: 1fr;
		}

		.footprint-map {
			height: 26rem;
		}
	}

	@media (max-width: 480px) {
		.footprint-stats {
			gap: 0.4rem;
		}

		.footprint-stats > div {
			padding-inline: 0.65rem;
		}

		.footprint-map {
			height: 23rem;
		}

		.footprint-map__toolbar {
			top: 0.55rem;
			right: 0.55rem;
		}

		.footprint-map__filters.is-expanded {
			max-width: calc(100% - 4rem);
			overflow-x: auto;
		}

		.footprint-form__grid {
			grid-template-columns: 1fr;
		}

		.footprint-list__toolbar {
			align-items: stretch;
			flex-direction: column;
		}

		.footprint-search {
			max-width: none;
		}

		.footprint-list__meta {
			flex-direction: column;
			gap: 0.1rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.footprint-map__filters,
		.footprint-map__filter,
		.footprint-map__cluster i,
		.footprint-map__cluster i::after,
		.footprint-map__toolbar button {
			transition: none;
		}
	}
</style>
