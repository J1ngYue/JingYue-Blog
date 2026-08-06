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
const CACHE_TTL = 15 * 60 * 1000;
const MAX_PARALLEL_PAGES = 4;

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
	try {
		const raw = sessionStorage.getItem(
			getCacheKey(apiUrl, username, subjectType),
		);
		if (!raw) return null;
		const cached = JSON.parse(raw) as CategoryCache;
		if (
			cached.version !== CACHE_VERSION ||
			!Array.isArray(cached.items) ||
			Date.now() - cached.savedAt > CACHE_TTL
		) {
			return null;
		}
		return cached;
	} catch {
		return null;
	}
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
		sessionStorage.setItem(
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
	const url = `${apiUrl}/v0/users/${username}/collections?subject_type=${subjectType}&limit=${limit}&offset=${offset}`;
	const resp = await fetch(url, { headers: { Accept: "application/json" } });
	if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
	return (await resp.json()) as UserSubjectCollectionResponse;
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
	for (const catKey of enabled) {
		const info = categoryMap[catKey];
		if (!info) continue;
		const cached = readCategoryCache(apiUrl, username, info.subjectType);
		if (!cached) continue;
		publishCategory(catKey, cached.items, cached.total);
		if (catKey === preferredTab) hasPreferredCache = true;
	}
	if (hasPreferredCache) fetchLoading = false;

	let successfulRequests = 0;
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
				console.error(`[Bangumi] 获取 ${catKey} 数据失败:`, e);
			}
		}),
	);

	if (dynamicTabs.length === 0 || dynamicTabs.every((tab) => tab.count === 0)) {
		fetchLoading = false;
		error = true;
		errorTitle = successfulRequests
			? i18n(I18nKey.bangumiNoData)
			: i18n(I18nKey.bangumiFetchError);
		errorDesc = successfulRequests
			? i18n(I18nKey.bangumiNoDataDescription)
			: i18n(I18nKey.bangumiFetchErrorDesc);
		return;
	}

	if (!dynamicTabs.some((tab) => tab.id === activeTab)) {
		activeTab = dynamicTabs[0].id;
	}
	fetchLoading = false;

	const now = new Date();
	const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
	updateTimestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
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
  </div>
{:else if tabs.length > 0}
	<div class="bangumi-update-row">
		{#if updateTimestamp}<span>上次更新：{updateTimestamp}</span>{/if}
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

	.bangumi-update-row > div span {
		position: relative;
		padding-left: 0.75rem;
	}

	.bangumi-update-row > div span::before {
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
