<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { SearchResult } from "@/global";
import { url as formatUrl } from "@/utils/url-utils";

export let title = i18n(I18nKey.search);
export let description = "";

let keyword = "";
let results: SearchResult[] = [];
let isSearching = false;
let initialized = false;
let debounceTimer: ReturnType<typeof setTimeout>;
let searchSequence = 0;

const fakeResult: SearchResult[] = [
	{
		url: formatUrl("/posts/firefly/"),
		meta: { title: "Firefly 博客示例文章" },
		excerpt: "开发环境使用的 <mark>搜索结果</mark> 预览。",
	},
	{
		url: formatUrl("/posts/guide/"),
		meta: { title: "博客使用指南" },
		excerpt: "生产构建后将自动切换为 Pagefind <mark>全文搜索</mark>。",
	},
];

const updateUrl = () => {
	if (typeof window === "undefined") return;
	const current = new URL(window.location.href);
	const query = keyword.trim();
	if (query) current.searchParams.set("q", query);
	else current.searchParams.delete("q");
	window.history.replaceState(window.history.state, "", current);
};

const search = async () => {
	const query = keyword.trim();
	const sequence = ++searchSequence;
	updateUrl();

	if (!initialized || !query) {
		results = [];
		isSearching = false;
		return;
	}

	isSearching = true;
	try {
		if (import.meta.env.PROD && window.pagefind) {
			const response = await window.pagefind.search(query);
			const rawResults = await Promise.all(
				response.results.slice(0, 40).map((item) => item.data()),
			);
			if (sequence === searchSequence) results = rawResults;
		} else if (import.meta.env.DEV) {
			const normalizedQuery = query.toLocaleLowerCase();
			results = fakeResult.filter(
				(item) =>
					item.excerpt.toLocaleLowerCase().includes(normalizedQuery) ||
					item.meta.title.toLocaleLowerCase().includes(normalizedQuery),
			);
		}
	} catch (error) {
		console.error("Search error:", error);
		if (sequence === searchSequence) results = [];
	} finally {
		if (sequence === searchSequence) isSearching = false;
	}
};

const handleInput = () => {
	window.clearTimeout(debounceTimer);
	debounceTimer = window.setTimeout(search, 180);
};

const clearSearch = () => {
	keyword = "";
	window.clearTimeout(debounceTimer);
	void search();
};

onMount(() => {
	const initialKeyword =
		new URLSearchParams(window.location.search).get("q") || "";

	const initialize = () => {
		if (initialized) return;
		initialized = true;
		keyword = initialKeyword;
		if (keyword.trim()) void search();
	};

	if (import.meta.env.DEV || window.pagefind) {
		initialize();
	} else {
		document.addEventListener("pagefindready", initialize, { once: true });
		document.addEventListener("pagefindloaderror", initialize, {
			once: true,
		});
	}

	return () => {
		window.clearTimeout(debounceTimer);
		document.removeEventListener("pagefindready", initialize);
		document.removeEventListener("pagefindloaderror", initialize);
	};
});
</script>

<section class="search-page-shell" aria-labelledby="search-page-title">
	<div class="search-page-heading">
		<p class="search-page-eyebrow">JINGYUE · SEARCH</p>
		<h1 id="search-page-title">{title}</h1>
		<p>{description || "想要找点什么呢？输入文章标题或正文关键词即可。"}</p>
	</div>

	<div class="search-page-input-wrap">
		<Icon
			icon="material-symbols:search-rounded"
			class="search-page-input-icon text-[1.45rem]"
		/>
		<input
			type="search"
			bind:value={keyword}
			oninput={handleInput}
			placeholder="输入关键词搜索..."
			autocomplete="off"
			aria-label={i18n(I18nKey.search)}
		/>
		{#if keyword}
			<button type="button" aria-label="清空搜索" onclick={clearSearch}>
				<Icon
					icon="material-symbols:cancel-rounded"
					class="text-[1.25rem]"
				/>
			</button>
		{/if}
	</div>

	<div class="search-result-status" aria-live="polite">
		{#if isSearching}
			<span>正在搜索…</span>
		{:else if keyword && results.length > 0}
			<span>找到 {results.length} 条相关结果</span>
		{:else if keyword}
			<span>没有找到相关内容</span>
		{:else}
			<span>支持搜索文章标题和正文内容</span>
		{/if}
	</div>

	<div class="search-results">
		{#if isSearching}
			<div class="search-loading">
				<Icon
					icon="svg-spinners:ring-resize"
					class="text-4xl text-(--primary)"
				/>
			</div>
		{:else if results.length > 0}
			{#each results as result}
				<article class="search-result-entry">
					<a
						class="search-result-entry__cover"
						href={result.url}
						aria-label={result.meta.title}
					>
						<Icon
							icon="fa7-solid:file-lines"
							class="text-[1.35rem]"
						/>
					</a>
					<div class="search-result-entry__body">
						<h2 class="search-result-entry__title">
							<a href={result.url}>{@html result.meta.title}</a>
						</h2>
						{#if result.excerpt}
							<p class="search-result-entry__excerpt">
								{@html result.excerpt}
							</p>
						{/if}
						<hr class="search-result-entry__divider" />
					</div>
				</article>
			{/each}
		{:else if keyword}
			<div class="search-empty">
				<Icon
					icon="material-symbols:search-off-rounded"
					class="text-4xl"
				/>
				<p>{i18n(I18nKey.searchNoResults)}</p>
				<button type="button" onclick={clearSearch}>清空关键词</button>
			</div>
		{/if}
	</div>
</section>

<style>
	.search-page-shell {
		width: min(100%, 48rem);
		margin: 0 auto;
		padding: 1.5rem 0 3rem;
	}

	.search-page-heading {
		margin-bottom: 1.25rem;
		text-align: center;
	}

	.search-page-eyebrow {
		margin: 0 0 0.35rem;
		color: var(--primary);
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.2em;
	}

	.search-page-heading h1 {
		margin: 0;
		color: var(--deep-text);
		font-size: clamp(1.8rem, 5vw, 2.6rem);
		font-weight: 800;
	}

	.search-page-heading > p:last-child {
		margin: 0.45rem 0 0;
		color: var(--content-meta);
		font-size: 0.86rem;
	}

	.search-page-input-wrap {
		position: relative;
		display: flex;
		align-items: center;
		border: 1px solid color-mix(in oklch, var(--line-divider) 88%, transparent);
		border-radius: 999px;
		background: color-mix(in oklch, var(--card-bg) 92%, transparent);
		box-shadow: 0 0.75rem 2.2rem color-mix(in oklch, var(--deep-text) 7%, transparent);
		transition:
			border-color 0.18s ease,
			box-shadow 0.18s ease,
			background-color 0.18s ease;
	}

	.search-page-input-wrap:focus-within {
		border-color: var(--primary);
		background: var(--card-bg);
		box-shadow:
			0 0.75rem 2.2rem color-mix(in oklch, var(--deep-text) 7%, transparent),
			0 0 0 4px color-mix(in oklch, var(--primary) 12%, transparent);
	}

	.search-page-input-icon {
		position: absolute;
		left: 1.15rem;
		color: var(--content-meta);
		pointer-events: none;
	}

	.search-page-input-wrap input {
		width: 100%;
		height: 3.5rem;
		padding: 0 3.25rem;
		border: 0;
		outline: none;
		background: transparent;
		color: var(--deep-text);
		font-size: 1rem;
	}

	.search-page-input-wrap input::placeholder {
		color: color-mix(in oklch, var(--content-meta) 68%, transparent);
	}

	.search-page-input-wrap button {
		position: absolute;
		right: 0.8rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		color: var(--content-meta);
		transition:
			color 0.15s ease,
			background-color 0.15s ease;
	}

	.search-page-input-wrap button:hover {
		background: var(--btn-plain-bg-hover);
		color: var(--primary);
	}

	.search-result-status {
		min-height: 2.5rem;
		padding: 0.75rem 1rem 0;
		color: var(--content-meta);
		font-size: 0.74rem;
		text-align: center;
	}

	.search-results {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.search-result-entry {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.7rem 0.35rem;
	}

	.search-result-entry__cover {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 4.5rem;
		height: 4.5rem;
		border: 1px solid color-mix(in oklch, var(--line-divider) 82%, transparent);
		border-radius: 50%;
		background:
			linear-gradient(
				145deg,
				color-mix(in oklch, var(--primary) 16%, var(--card-bg)),
				color-mix(in oklch, var(--primary) 4%, var(--card-bg))
			);
		color: var(--primary);
		transition:
			transform 0.2s ease,
			background-color 0.2s ease,
			color 0.2s ease;
	}

	.search-result-entry__cover:hover {
		transform: translateY(-2px) rotate(-3deg);
		background: var(--primary);
		color: white;
	}

	.search-result-entry__body {
		min-width: 0;
		flex: 1;
	}

	.search-result-entry__title {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 650;
		line-height: 1.4;
	}

	.search-result-entry__title a {
		color: var(--deep-text);
		text-decoration: none;
		transition: color 0.18s ease;
	}

	.search-result-entry__title a:hover {
		color: var(--primary);
	}

	.search-result-entry__excerpt {
		display: -webkit-box;
		margin: 0.32rem 0 0;
		overflow: hidden;
		color: var(--content-meta);
		font-size: 0.82rem;
		line-height: 1.55;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}

	.search-result-entry__divider {
		width: 55%;
		margin: 0.9rem auto 0;
		border: 0;
		border-top: 1px dashed color-mix(in oklch, var(--line-divider) 86%, transparent);
	}

	.search-result-entry:last-child .search-result-entry__divider {
		display: none;
	}

	.search-loading {
		display: flex;
		justify-content: center;
		padding: 3rem 0;
	}

	.search-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.65rem;
		padding: 3rem 1rem;
		color: var(--content-meta);
		text-align: center;
	}

	.search-empty p {
		margin: 0;
	}

	.search-empty button {
		padding: 0.5rem 0.9rem;
		border-radius: 999px;
		background: var(--btn-regular-bg);
		color: var(--primary);
		font-size: 0.78rem;
	}

	:global(mark) {
		padding: 0 0.08em;
		background: transparent;
		color: var(--primary);
		font-weight: 650;
	}

	@media (max-width: 640px) {
		.search-page-shell {
			padding-top: 0.75rem;
		}

		.search-result-entry {
			align-items: flex-start;
			gap: 0.75rem;
		}

		.search-result-entry__cover {
			width: 3.4rem;
			height: 3.4rem;
		}
	}
</style>
