<script lang="ts">
import {
	Activity,
	BookOpen,
	CircleAlert,
	ExternalLink,
	Fish,
	Newspaper,
	RefreshCw,
	RotateCcw,
	Users,
	X,
} from "lucide-svelte";
import { onMount, tick } from "svelte";
import CircleFishingScene from "./CircleFishingScene.svelte";

type CircleArticle = {
	author?: string;
	avatar?: string;
	created?: string;
	link?: string;
	title?: string;
	updated?: string;
};

type CircleData = {
	article_data?: CircleArticle[];
	statistical_data?: {
		active_num?: number;
		article_num?: number;
		friends_num?: number;
		last_updated_time?: string;
	};
};

interface Props {
	assetBaseUrl: string;
	cacheTime: number;
	dataUrl: string;
	friendsUrl: string;
	pageSize: number;
}

const { assetBaseUrl, cacheTime, dataUrl, friendsUrl, pageSize }: Props =
	$props();

let articles = $state<CircleArticle[]>([]);
let stats = $state<CircleData["statistical_data"]>();
let loading = $state(true);
let failed = $state(false);
let catchOpen = $state(false);
let caughtArticle = $state<CircleArticle>();
let sort = $state<"created" | "updated">("created");
let displayedCount = $state(pageSize);
let featured = $state<CircleArticle>();
let sentinel: HTMLDivElement;
let fishingButton: HTMLButtonElement;
let catchCloseButton: HTMLButtonElement;

const sortedArticles = $derived(
	articles.toSorted((left, right) =>
		dateValue(right, sort).localeCompare(dateValue(left, sort)),
	),
);
const visibleArticles = $derived(sortedArticles.slice(0, displayedCount));
const hasMore = $derived(displayedCount < sortedArticles.length);

function dateValue(article: CircleArticle, field: "created" | "updated") {
	return field === "updated"
		? article.updated || article.created || ""
		: article.created || "";
}

function formatDate(value?: string) {
	return value?.split(" ")[0] || "";
}

function articleUrl(value?: string) {
	if (!value) return "#";
	try {
		const parsed = new URL(value, assetBaseUrl);
		return parsed.protocol === "http:" || parsed.protocol === "https:"
			? parsed.href
			: "#";
	} catch {
		return "#";
	}
}

function avatarUrl(value?: string) {
	return value ? articleUrl(value) : "";
}

function pickArticle() {
	if (articles.length === 0) return;
	const candidates = sortedArticles.slice(0, 6);
	featured = candidates[Math.floor(Math.random() * candidates.length)];
}

function goFishing() {
	if (articles.length === 0) return;
	const candidates = sortedArticles.length > 0 ? sortedArticles : articles;
	caughtArticle = candidates[Math.floor(Math.random() * candidates.length)];
	featured = caughtArticle;
	catchOpen = true;
	void tick().then(() => catchCloseButton?.focus());
}

function closeCatch() {
	catchOpen = false;
	void tick().then(() => fishingButton?.focus());
}

function fishAgain() {
	catchOpen = false;
	void tick().then(goFishing);
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Escape" && catchOpen) closeCatch();
}

function setSort(nextSort: "created" | "updated") {
	sort = nextSort;
	displayedCount = pageSize;
}

function loadMore() {
	if (hasMore) displayedCount += pageSize;
}

async function loadData(force = false) {
	loading = true;
	failed = false;
	try {
		const cacheKey = `firefly-circle:${dataUrl}`;
		const cached = sessionStorage.getItem(cacheKey);
		let data: CircleData | undefined;
		if (!force && cached) {
			const parsed = JSON.parse(cached) as { data: CircleData; time: number };
			if (parsed.time > Date.now() - cacheTime) data = parsed.data;
		}
		if (!data) {
			const response = await fetch(dataUrl);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			data = (await response.json()) as CircleData;
			sessionStorage.setItem(
				cacheKey,
				JSON.stringify({ data, time: Date.now() }),
			);
		}
		if (!Array.isArray(data.article_data) || data.article_data.length === 0) {
			throw new Error("Circle data is empty");
		}
		articles = data.article_data;
		stats = data.statistical_data;
		displayedCount = pageSize;
		pickArticle();
	} catch (error) {
		console.error("Failed to load circle data", error);
		failed = true;
	} finally {
		loading = false;
	}
}

onMount(() => {
	void loadData();
	const observer = new IntersectionObserver(
		(entries) => {
			if (entries.some((entry) => entry.isIntersecting)) loadMore();
		},
		{ rootMargin: "240px 0px" },
	);
	observer.observe(sentinel);
	return () => {
		observer.disconnect();
	};
});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="circle-panel card-base">
	<header class="circle-toolbar">
		<div class="circle-brand">
			<div class="circle-brand__icon" aria-hidden="true"><Fish size={22} /></div>
			<div>
				<strong>鱼塘</strong>
				<span>朋友们的新鲜文章</span>
			</div>
		</div>
		<div class="circle-toolbar__actions">
			<button
				bind:this={fishingButton}
				type="button"
				class="circle-fish-action"
				onclick={goFishing}
				disabled={loading || failed}
			>
				<Fish size={16} />
				开始钓鱼
			</button>
			<a class="circle-friends-link" href={friendsUrl}>
				全部友链
				<ExternalLink size={15} />
			</a>
		</div>
	</header>

	<div class="circle-fishing">
		<CircleFishingScene />
	</div>

	<div class="circle-summary">
		<div class="circle-stats" aria-label="朋友圈统计">
			<span><Users size={16} />好友 <strong>{stats?.friends_num || 0}</strong></span>
			<span><Activity size={16} />活跃 <strong>{stats?.active_num || 0}</strong></span>
			<span><Newspaper size={16} />动态 <strong>{stats?.article_num || articles.length}</strong></span>
		</div>
		<div class="circle-sort" aria-label="文章排序">
			<button
				type="button"
				class:is-active={sort === "created"}
				aria-pressed={sort === "created"}
				onclick={() => setSort("created")}
			>最新发布</button>
			<button
				type="button"
				class:is-active={sort === "updated"}
				aria-pressed={sort === "updated"}
				onclick={() => setSort("updated")}
			>最近更新</button>
		</div>
	</div>

	{#if loading}
		<div class="circle-state" role="status">
			<span class="circle-spinner" aria-hidden="true"></span>
			<p>正在加载朋友圈数据...</p>
		</div>
	{:else if failed}
		<div class="circle-state circle-state--error" role="alert">
			<CircleAlert size={34} />
			<p>加载失败，请稍后再试</p>
			<button type="button" onclick={() => loadData(true)}>
				<RefreshCw size={16} />重试
			</button>
		</div>
	{:else}
		<div class="circle-grid">
			{#each visibleArticles as article}
				<a
					class="circle-card"
					href={articleUrl(article.link)}
					target="_blank"
					rel="noopener noreferrer"
				>
					<div class="circle-card__watermark" data-initial={(article.author || "?").slice(0, 1)}>
						{#if avatarUrl(article.avatar)}
							<img
								src={avatarUrl(article.avatar)}
								alt=""
								loading="lazy"
								onerror={(event) => (event.currentTarget.hidden = true)}
							/>
						{/if}
					</div>
					<time datetime={article.created}>{formatDate(article.created)}</time>
					<h2>{article.title || "无标题"}</h2>
					<span class="circle-card__author">{article.author || "未知朋友"}</span>
					<ExternalLink class="circle-card__external" size={16} />
				</a>
			{/each}
		</div>
	{/if}

	<div class="circle-sentinel" bind:this={sentinel} aria-live="polite">
		{#if !loading && !failed && hasMore}
			<span class="circle-spinner circle-spinner--small" aria-hidden="true"></span>
			<span>加载更多</span>
		{:else if !loading && !failed && articles.length > 0}
			<span>没有更多了</span>
		{/if}
	</div>
</div>

{#if catchOpen && caughtArticle}
	<div
		class="circle-catch-backdrop"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) closeCatch();
		}}
	>
		<section
			class="circle-catch-dialog"
			role="dialog"
			aria-modal="true"
			aria-labelledby="circle-catch-title"
		>
			<header>
				<span><Fish size={18} />今日收获</span>
				<button bind:this={catchCloseButton} type="button" onclick={closeCatch} aria-label="关闭钓鱼结果">
					<X size={18} />
				</button>
			</header>
			<div class="circle-catch-dialog__cover" data-initial={(caughtArticle.author || "?").slice(0, 1)}>
				{#if avatarUrl(caughtArticle.avatar)}
					<img src={avatarUrl(caughtArticle.avatar)} alt="" />
				{/if}
				<span><Fish size={28} /></span>
			</div>
			<div class="circle-catch-dialog__body">
				<p>来自 {caughtArticle.author || "未知朋友"}</p>
				<h2 id="circle-catch-title">{caughtArticle.title || "无标题"}</h2>
				<time datetime={caughtArticle.created}>{formatDate(caughtArticle.created)}</time>
			</div>
			<footer>
				<button type="button" onclick={fishAgain}>
					<RotateCcw size={16} />再钓一次
				</button>
				<a href={articleUrl(caughtArticle.link)} target="_blank" rel="noopener noreferrer">
					<BookOpen size={16} />阅读文章
				</a>
			</footer>
		</section>
	</div>
{/if}
