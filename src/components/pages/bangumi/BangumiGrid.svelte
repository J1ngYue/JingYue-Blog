<script lang="ts">
import { onMount } from "svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import type {
	UserSubjectCollection,
	UserSubjectCollectionResponse,
} from "@/types/bangumi";
import BangumiSection from "./BangumiSection.svelte";
import TabNav from "./TabNav.svelte";

interface Props {
	// 静态模式：直接传入数据
	tabs?: Array<{ id: string; name: string; count: number }>;
	initialActiveTab?: string;
	bangumiData?: Record<string, UserSubjectCollection[]>;
	subjectBaseUrl?: string;
	// 动态模式：传入获取配置
	fetchConfig?: {
		username: string;
		apiUrl: string;
		categories: Record<string, boolean>;
		categoryOrder: string[];
		pagination: { limit: number; delay: number; maxTotal: number };
	};
}

const {
	tabs: staticTabs,
	initialActiveTab,
	bangumiData: staticData,
	subjectBaseUrl,
	fetchConfig,
}: Props = $props();

const isDynamic = $derived(!!fetchConfig);

// 状态
let activeTab = $state("");
let fetchLoading = $state(false);
const loading = $derived(isDynamic && fetchLoading);
let error = $state(false);

// 初始化 activeTab / 当 fetchConfig 变化时重置状态
$effect(() => {
	if (initialActiveTab) {
		activeTab = initialActiveTab;
	}
	if (fetchConfig) {
		fetchLoading = true;
		error = false;
	}
});
let errorTitle = $state("");
let errorDesc = $state("");
let updateTimestamp = $state("");
let loadNotice = $state("");

// 动态模式的数据
let dynamicTabs = $state<Array<{ id: string; name: string; count: number }>>(
	[],
);
let dynamicData = $state<Record<string, UserSubjectCollection[]>>({});

// 合并后的数据
const tabs = $derived(staticTabs || dynamicTabs);
const bangumiData = $derived(staticData || dynamicData);
const activeItems = $derived(bangumiData[activeTab] || []);
const activeStatusCounts = $derived(() => {
	const counts = { collect: 0, doing: 0, wish: 0 };
	for (const item of activeItems) {
		if (item.type === 2) counts.collect += 1;
		if (item.type === 3) counts.doing += 1;
		if (item.type === 1) counts.wish += 1;
	}
	return counts;
});
const activeStatusLabels = $derived(
	activeTab === "book"
		? ["读过", "在读", "想读"]
		: activeTab === "game"
			? ["玩过", "在玩", "想玩"]
			: ["看过", "在看", "想看"],
);

const categoryMap: Record<string, { name: string; subjectType: number }> = {
	book: { name: i18n(I18nKey.bangumiCategoryBook), subjectType: 1 },
	anime: { name: i18n(I18nKey.bangumiCategoryAnime), subjectType: 2 },
	music: { name: i18n(I18nKey.bangumiCategoryMusic), subjectType: 3 },
	game: { name: i18n(I18nKey.bangumiCategoryGame), subjectType: 4 },
	real: { name: i18n(I18nKey.bangumiCategoryReal), subjectType: 6 },
};

const CACHE_VERSION = 1;
const CACHE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const MAX_PARALLEL_PAGES = 4;
const REQUEST_TIMEOUT = 8_000;
const OFFICIAL_API_URL = "https://api.bgm.tv";

type CategoryLoadResult = {
	items: UserSubjectCollection[];
	total: number;
};

type CategoryCache = CategoryLoadResult & {
	version: number;
	savedAt: number;
};

function getCacheKey(apiUrl: string, username: string, subjectType: number) {
	return `jingyue-bangumi:${CACHE_VERSION}:${apiUrl}:${username}:${subjectType}`;
}

function readCategoryCache(
	apiUrl: string,
	username: string,
	subjectType: number,
): CategoryCache | null {
	const key = getCacheKey(apiUrl, username, subjectType);
	for (const storageName of ["localStorage", "sessionStorage"] as const) {
		try {
			const storage = window[storageName];
			const raw = storage.getItem(key);
			if (!raw) continue;
			const cached = JSON.parse(raw) as CategoryCache;
			if (
				cached.version !== CACHE_VERSION ||
				!Array.isArray(cached.items) ||
				!Number.isFinite(cached.savedAt) ||
				Date.now() - cached.savedAt > CACHE_MAX_AGE
			) {
				storage.removeItem(key);
				continue;
			}
			if (storageName === "sessionStorage") {
				localStorage.setItem(key, raw);
			}
			return cached;
		} catch {
			// Continue without cache when storage is blocked or data is malformed.
		}
	}
	return null;
}

function writeCategoryCache(
	apiUrl: string,
	username: string,
	subjectType: number,
	result: CategoryLoadResult,
) {
	try {
		const cached: CategoryCache = {
			...result,
			version: CACHE_VERSION,
			savedAt: Date.now(),
		};
		localStorage.setItem(
			getCacheKey(apiUrl, username, subjectType),
			JSON.stringify(cached),
		);
	} catch {
		// The live request still works when session storage is unavailable.
	}
}

async function fetchCategoryPage(
	apiUrl: string,
	username: string,
	subjectType: number,
	limit: number,
	offset: number,
): Promise<UserSubjectCollectionResponse> {
	const endpoints =
		apiUrl === OFFICIAL_API_URL
			? [apiUrl, apiUrl]
			: [apiUrl, OFFICIAL_API_URL, apiUrl];
	let lastError: unknown;
	for (const [attempt, endpoint] of endpoints.entries()) {
		if (attempt > 0)
			await new Promise((resolve) => setTimeout(resolve, attempt * 300));
		const url = `${endpoint}/v0/users/${username}/collections?subject_type=${subjectType}&limit=${limit}&offset=${offset}`;
		const controller = new AbortController();
		const timeout = window.setTimeout(
			() => controller.abort(),
			REQUEST_TIMEOUT,
		);
		try {
			const resp = await fetch(url, {
				headers: { Accept: "application/json" },
				signal: controller.signal,
			});
			if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
			const payload = (await resp.json()) as UserSubjectCollectionResponse;
			if (!Array.isArray(payload.data))
				throw new Error("Invalid Bangumi response");
			return payload;
		} catch (error) {
			lastError = error;
		} finally {
			window.clearTimeout(timeout);
		}
	}
	throw lastError instanceof Error
		? lastError
		: new Error("Bangumi request failed");
}

function handleTabChange(tabId: string) {
	activeTab = tabId;
}

async function fetchCategory(
	apiUrl: string,
	username: string,
	subjectType: number,
	pagination: { limit: number; delay: number; maxTotal: number },
	onFirstPage?: (result: CategoryLoadResult) => void,
): Promise<CategoryLoadResult> {
	const { limit, maxTotal } = pagination;
	const firstPage = await fetchCategoryPage(
		apiUrl,
		username,
		subjectType,
		limit,
		0,
	);
	const reportedTotal = Number.isFinite(firstPage.total)
		? firstPage.total
		: firstPage.data.length;
	const total =
		maxTotal > 0 ? Math.min(reportedTotal, maxTotal) : reportedTotal;
	const firstItems = (firstPage.data || []).slice(0, total);

	onFirstPage?.({ items: firstItems, total });
	if (firstItems.length >= total || firstItems.length < limit) {
		return { items: firstItems, total };
	}

	const offsets: number[] = [];
	for (let offset = limit; offset < total; offset += limit) {
		offsets.push(offset);
	}

	const pages = new Map<number, UserSubjectCollection[]>();
	let nextOffsetIndex = 0;
	const workerCount = Math.min(MAX_PARALLEL_PAGES, offsets.length);
	await Promise.all(
		Array.from({ length: workerCount }, async () => {
			while (nextOffsetIndex < offsets.length) {
				const offset = offsets[nextOffsetIndex++];
				const page = await fetchCategoryPage(
					apiUrl,
					username,
					subjectType,
					limit,
					offset,
				);
				pages.set(offset, page.data || []);
			}
		}),
	);

	const items = [
		...firstItems,
		...offsets.flatMap((offset) => pages.get(offset) || []),
	].slice(0, total);
	return { items, total };
}

async function loadDynamicData() {
	if (!fetchConfig) return;
	fetchLoading = true;
	error = false;
	loadNotice = "";
	const { username, apiUrl, categories, categoryOrder, pagination } =
		fetchConfig;

	const enabled: string[] = [];
	for (const [k, v] of Object.entries(categories)) {
		if (v) enabled.push(k);
	}
	if (categoryOrder.length > 0) {
		enabled.sort((a, b) => {
			const ai = categoryOrder.indexOf(a);
			const bi = categoryOrder.indexOf(b);
			if (ai === -1 && bi === -1) return 0;
			if (ai === -1) return 1;
			if (bi === -1) return -1;
			return ai - bi;
		});
	}

	const preferredTab =
		initialActiveTab && enabled.includes(initialActiveTab)
			? initialActiveTab
			: enabled[0] || "";
	activeTab = preferredTab;

	const order = new Map(enabled.map((key, index) => [key, index]));
	const publishCategory = (
		catKey: string,
		items: UserSubjectCollection[],
		count = items.length,
	) => {
		const info = categoryMap[catKey];
		if (!info) return;
		dynamicData = { ...dynamicData, [catKey]: items };
		dynamicTabs = [
			...dynamicTabs.filter((tab) => tab.id !== catKey),
			{ id: catKey, name: info.name, count },
		].sort(
			(a, b) =>
				(order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
				(order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
		);
	};

	let hasPreferredCache = false;
	let latestCacheTimestamp = 0;
	for (const catKey of enabled) {
		const info = categoryMap[catKey];
		if (!info) continue;
		const cached = readCategoryCache(apiUrl, username, info.subjectType);
		if (!cached) continue;
		publishCategory(catKey, cached.items, cached.total);
		latestCacheTimestamp = Math.max(latestCacheTimestamp, cached.savedAt);
		if (catKey === preferredTab) hasPreferredCache = true;
	}
	if (hasPreferredCache) fetchLoading = false;

	let successfulRequests = 0;
	let failedRequests = 0;
	await Promise.all(
		enabled.map(async (catKey) => {
			const info = categoryMap[catKey];
			if (!info) return;
			try {
				const result = await fetchCategory(
					apiUrl,
					username,
					info.subjectType,
					pagination,
					(firstPage) => {
						publishCategory(catKey, firstPage.items, firstPage.total);
						if (catKey === preferredTab) fetchLoading = false;
					},
				);
				publishCategory(catKey, result.items, result.total);
				writeCategoryCache(apiUrl, username, info.subjectType, result);
				successfulRequests += 1;
			} catch (e) {
				failedRequests += 1;
				console.error(`[Bangumi] 获取 ${catKey} 数据失败:`, e);
			}
		}),
	);

	if (dynamicTabs.length === 0 || dynamicTabs.every((tab) => tab.count === 0)) {
		fetchLoading = false;
		error = true;
		errorTitle = successfulRequests
			? i18n(I18nKey.bangumiNoData)
			: "Bangumi 暂时无法连接";
		errorDesc = successfulRequests
			? i18n(I18nKey.bangumiNoDataDescription)
			: "网络可能正在波动，请稍后重新加载。";
		return;
	}

	if (!dynamicTabs.some((tab) => tab.id === activeTab)) {
		activeTab = dynamicTabs[0].id;
	}
	fetchLoading = false;
	if (failedRequests > 0) {
		loadNotice = "Bangumi 暂时无法刷新，当前显示上次成功加载的数据。";
	}

	const now =
		successfulRequests > 0
			? new Date()
			: new Date(latestCacheTimestamp || Date.now());
	const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
	updateTimestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function retryLoad() {
	if (!fetchLoading) void loadDynamicData();
}

// 从 URL hash 恢复 tab
function restoreTabFromHash() {
	if (!isDynamic) {
		const hash = window.location.hash.replace(/^#/, "");
		if (hash) {
			try {
				const decoded = decodeURIComponent(hash);
				if (tabs.some((t) => t.id === decoded)) {
					activeTab = decoded;
				}
			} catch {}
		}
	}
}

onMount(async () => {
	restoreTabFromHash();
	if (isDynamic) {
		await loadDynamicData();
	}
});
</script>

{#if isDynamic && loading}
  <!-- Tab 骨架 -->
  <div class="border-b border-(--line-divider) mb-3 overflow-hidden">
    <div class="flex w-full gap-3">
      {#each [1, 2, 3, 4] as _}
        <div class="h-10 w-20 bg-(--btn-regular-bg) rounded animate-pulse"></div>
      {/each}
    </div>
  </div>
  <!-- 筛选骨架 -->
  <div class="flex flex-wrap gap-1.5 mb-4">
    {#each [1, 2, 3, 4] as _}
      <div class="h-7 w-16 bg-(--btn-regular-bg) rounded-full animate-pulse"></div>
    {/each}
  </div>
  <!-- 卡片网格骨架 -->
  <div class="bangumi-masonry grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
    {#each [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as _}
      <div class="rounded-xl overflow-hidden">
        <div class="aspect-2/3 bg-(--btn-regular-bg) animate-pulse"></div>
      </div>
    {/each}
  </div>
  <!-- 分页骨架 -->
  <div class="mt-6 flex items-center justify-center gap-3">
    <div class="w-11 h-11 bg-(--btn-regular-bg) rounded-lg animate-pulse"></div>
    <div class="w-16 h-8 bg-(--btn-regular-bg) rounded animate-pulse"></div>
    <div class="w-11 h-11 bg-(--btn-regular-bg) rounded-lg animate-pulse"></div>
  </div>
{:else if isDynamic && error}
  <div class="text-center py-16">
    <div class="inline-flex items-center justify-center w-16 h-16 bg-(--btn-regular-bg) rounded-full mb-6 border border-(--line-divider)">
      <span class="text-[2rem] text-red-500">⚠</span>
    </div>
    <h2 class="text-xl font-semibold text-black/80 dark:text-white/80 mb-3">{errorTitle}</h2>
    <p class="text-black/60 dark:text-white/60 mb-4 max-w-md mx-auto">{errorDesc}</p>
	<button type="button" class="bangumi-retry" onclick={retryLoad}>重新加载</button>
  </div>
{:else if tabs.length > 0}
	<div class="bangumi-update-row">
		<div class="bangumi-update-meta">
			{#if updateTimestamp}<span>上次更新：{updateTimestamp}</span>{/if}
			{#if loadNotice}<span class="bangumi-load-notice">{loadNotice}</span>{/if}
		</div>
		<div aria-label="收藏状态统计">
			<span class="is-collected">{activeStatusLabels[0]} {activeStatusCounts().collect}</span>
			<span class="is-doing">{activeStatusLabels[1]} {activeStatusCounts().doing}</span>
			<span class="is-wish">{activeStatusLabels[2]} {activeStatusCounts().wish}</span>
		</div>
	</div>

	{#if tabs.length > 1}
		<TabNav {tabs} {activeTab} onTabChange={handleTabChange} />
	{/if}

  {#each tabs as tab (tab.id)}
    <BangumiSection
      sectionId={tab.id}
      items={bangumiData[tab.id] || []}
      isActive={tab.id === activeTab}
      itemsPerPage={24}
      {subjectBaseUrl}
    />
  {/each}
{/if}

<style>
	.bangumi-update-row {
		display: flex;
		min-height: 1.6rem;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin: -0.8rem 0 1rem;
		color: var(--content-meta);
		font-size: 0.7rem;
	}

	.bangumi-update-row > div {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.bangumi-update-meta {
		align-items: center;
	}

	.bangumi-load-notice {
		color: #c97808;
	}

	.bangumi-retry {
		border: 1px solid var(--line-divider);
		border-radius: 0.6rem;
		background: var(--btn-regular-bg);
		padding: 0.55rem 1rem;
		color: var(--btn-content);
		font-size: 0.82rem;
		font-weight: 650;
		cursor: pointer;
		transition: background-color 160ms ease, transform 160ms ease;
	}

	.bangumi-retry:hover,
	.bangumi-retry:focus-visible {
		background: color-mix(in srgb, var(--primary) 12%, var(--btn-regular-bg));
		outline: none;
		transform: translateY(-1px);
	}

	.bangumi-update-row > div[aria-label] span {
		position: relative;
		padding-left: 0.75rem;
	}

	.bangumi-update-row > div[aria-label] span::before {
		position: absolute;
		top: 50%;
		left: 0;
		width: 0.48rem;
		height: 0.48rem;
		border-radius: 50%;
		background: #24ba87;
		content: "";
		transform: translateY(-50%);
	}

	.bangumi-update-row .is-doing::before {
		background: #f3a90f;
	}

	.bangumi-update-row .is-wish::before {
		background: #27a8d8;
	}

	@media (max-width: 620px) {
		.bangumi-update-row {
			align-items: flex-start;
			flex-direction: column;
			gap: 0.35rem;
		}
	}
</style>
