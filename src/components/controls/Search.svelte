<script lang="ts">
import { navigateToPage } from "@utils/navigation-utils";
import { onMount, tick } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import type { SearchResult } from "@/global";
import { url as formatUrl, getSearchUrl } from "@/utils/url-utils";

let keyword = "";
let result: SearchResult[] = [];
let isOpen = false;
let isSearching = false;
let hasSearched = false;
let initialized = false;
let inputElement: HTMLInputElement;
let modalElement: HTMLDivElement;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let searchSequence = 0;
let previouslyFocused: HTMLElement | null = null;
let previousHtmlOverflow = "";
let previousBodyOverflow = "";

const fakeResult: SearchResult[] = [
	{
		url: formatUrl("/"),
		meta: { title: "This Is a Fake Search Result" },
		excerpt:
			"Because Pagefind cannot work in the <mark>dev</mark> environment.",
	},
	{
		url: formatUrl("/"),
		meta: { title: "If You Want to Test the Search" },
		excerpt:
			"Build and preview the site to test the real <mark>Pagefind</mark> index.",
	},
];

const portal = (node: HTMLElement) => {
	document.body.appendChild(node);
	return {
		destroy: () => {
			if (node.parentNode === document.body) node.remove();
		},
	};
};

const lockPageScroll = () => {
	previousHtmlOverflow = document.documentElement.style.overflow;
	previousBodyOverflow = document.body.style.overflow;
	document.documentElement.style.overflow = "hidden";
	document.body.style.overflow = "hidden";
	document.body.classList.add("search-modal-open");
};

const unlockPageScroll = () => {
	document.documentElement.style.overflow = previousHtmlOverflow;
	document.body.style.overflow = previousBodyOverflow;
	document.body.classList.remove("search-modal-open");
};

const openSearch = async () => {
	if (isOpen) return;
	window.dispatchEvent(
		new CustomEvent("jingyue:floating-panel-open", {
			detail: { panel: "search" },
		}),
	);
	previouslyFocused =
		document.activeElement instanceof HTMLElement
			? document.activeElement
			: null;
	isOpen = true;
	keyword = "";
	result = [];
	hasSearched = false;
	lockPageScroll();
	await tick();
	inputElement?.focus({ preventScroll: true });
};

const closeSearch = (restoreFocus = true) => {
	if (!isOpen) return;
	isOpen = false;
	keyword = "";
	result = [];
	isSearching = false;
	hasSearched = false;
	searchSequence += 1;
	if (debounceTimer) clearTimeout(debounceTimer);
	unlockPageScroll();
	if (restoreFocus) {
		const focusTarget = previouslyFocused;
		requestAnimationFrame(() => focusTarget?.focus({ preventScroll: true }));
	}
};

const toggleSearch = () => {
	if (isOpen) closeSearch();
	else void openSearch();
};

const runSearch = async (query: string, sequence: number) => {
	try {
		let searchResults: SearchResult[] = [];
		if (import.meta.env.PROD && window.pagefind) {
			const response = await window.pagefind.search(query);
			searchResults = await Promise.all(
				response.results.map((item) => item.data()),
			);
		} else if (import.meta.env.DEV) {
			searchResults = fakeResult;
		}

		if (sequence !== searchSequence) return;
		result = searchResults;
	} catch (error) {
		if (sequence !== searchSequence) return;
		console.error("Search error:", error);
		result = [];
	} finally {
		if (sequence === searchSequence) {
			isSearching = false;
			hasSearched = true;
		}
	}
};

const queueSearch = (value: string) => {
	if (debounceTimer) clearTimeout(debounceTimer);
	searchSequence += 1;
	const sequence = searchSequence;
	const query = value.trim();

	if (!query) {
		result = [];
		isSearching = false;
		hasSearched = false;
		return;
	}
	if (!initialized) return;

	isSearching = true;
	hasSearched = false;
	debounceTimer = setTimeout(() => void runSearch(query, sequence), 260);
};

const submitSearch = () => {
	const query = keyword.trim();
	if (!query) return;
	const destination = getSearchUrl(query);
	closeSearch(false);
	navigateToPage(destination);
};

const handleResultClick = (event: MouseEvent, destination: string) => {
	event.preventDefault();
	closeSearch(false);
	navigateToPage(destination);
};

const trapFocus = (event: KeyboardEvent) => {
	if (!modalElement) return;
	const focusable = Array.from(
		modalElement.querySelectorAll<HTMLElement>(
			'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
		),
	);
	if (focusable.length === 0) return;

	const first = focusable[0];
	const last = focusable[focusable.length - 1];
	if (event.shiftKey && document.activeElement === first) {
		event.preventDefault();
		last.focus();
	} else if (!event.shiftKey && document.activeElement === last) {
		event.preventDefault();
		first.focus();
	}
};

const handleGlobalKeydown = (event: KeyboardEvent) => {
	if ((event.ctrlKey || event.metaKey) && event.code === "KeyK") {
		event.preventDefault();
		toggleSearch();
		return;
	}
	if (!isOpen) return;
	if (event.key === "Escape") {
		event.preventDefault();
		closeSearch();
	} else if (event.key === "Tab") {
		trapFocus(event);
	}
};

onMount(() => {
	const initializePagefind = () => {
		initialized = true;
		if (keyword.trim()) queueSearch(keyword);
	};

	if (import.meta.env.DEV || window.pagefind) initializePagefind();
	else {
		document.addEventListener("pagefindready", initializePagefind, {
			once: true,
		});
		document.addEventListener("pagefindloaderror", initializePagefind, {
			once: true,
		});
	}

	const handleOpenRequest = () => void openSearch();
	const handleCloseRequest = () => closeSearch(false);
	document.addEventListener("keydown", handleGlobalKeydown);
	window.addEventListener("firefly:open-search", handleOpenRequest);
	window.addEventListener("firefly:close-search", handleCloseRequest);

	return () => {
		if (debounceTimer) clearTimeout(debounceTimer);
		document.removeEventListener("keydown", handleGlobalKeydown);
		document.removeEventListener("pagefindready", initializePagefind);
		document.removeEventListener("pagefindloaderror", initializePagefind);
		window.removeEventListener("firefly:open-search", handleOpenRequest);
		window.removeEventListener("firefly:close-search", handleCloseRequest);
		if (isOpen) unlockPageScroll();
	};
});

$: if (initialized) queueSearch(keyword);
</script>

<div id="search-bar" class="search-trigger-shell">
	<button
		id="search-switch"
		type="button"
		class="search-trigger"
		aria-label="打开站内搜索"
		aria-haspopup="dialog"
		aria-controls="global-search-dialog"
		aria-expanded={isOpen}
		on:click={toggleSearch}
	>
		<span class="search-shortcut" aria-hidden="true">Ctrl K</span>
		<Icon icon="material-symbols:search-rounded" class="search-trigger-icon" />
	</button>
</div>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		id="global-search-dialog"
		class="search-modal is-open"
		role="dialog"
		aria-modal="true"
		aria-labelledby="global-search-title"
		bind:this={modalElement}
		use:portal
		on:click|self={() => closeSearch()}
	>
		<div class="search-modal-content">
			<p id="global-search-title" class="search-modal-title">搜索文章</p>

			<form class="search-input-shell" role="search" on:submit|preventDefault={submitSearch}>
				<input
					bind:this={inputElement}
					bind:value={keyword}
					type="search"
					class="search-input"
					placeholder="搜索文章、标签、分类..."
					aria-label="搜索文章、标签、分类"
					aria-controls="global-search-results"
					autocomplete="off"
					enterkeyhint="search"
				/>
				<button
					type="submit"
					class="search-submit"
					disabled={!keyword.trim()}
					aria-label="查看全部搜索结果"
				>
					<Icon icon="fa7-solid:arrow-right" />
				</button>
			</form>

			{#if isSearching || result.length > 0 || (hasSearched && keyword.trim())}
				<div
					id="global-search-results"
					class="search-results"
					aria-live="polite"
					aria-busy={isSearching}
				>
					{#if isSearching}
						<div class="search-status">正在搜索...</div>
					{:else if result.length > 0}
						{#each result.slice(0, 5) as item}
							<a
								href={item.url}
								class="search-result-item"
								on:click={(event) => handleResultClick(event, item.url)}
							>
								<span class="search-result-title">
									{@html item.meta.title}
									<Icon icon="fa7-solid:chevron-right" />
								</span>
								{#if item.excerpt?.includes("<mark>")}
									<span class="search-result-excerpt">{@html item.excerpt}</span>
								{/if}
							</a>
						{/each}
						{#if result.length > 5}
							<a
								href={getSearchUrl(keyword)}
								class="search-result-more"
								on:click={(event) =>
									handleResultClick(event, getSearchUrl(keyword))}
							>
								查看全部 {result.length} 条结果
								<Icon icon="fa7-solid:arrow-right" />
							</a>
						{/if}
					{:else}
						<div class="search-status">没有找到相关文章</div>
					{/if}
				</div>
			{/if}

			<div class="search-hints" aria-hidden="true">
				<span><kbd>ESC</kbd> 关闭</span>
				<span><kbd>ENTER</kbd> 搜索</span>
				<span><kbd>Ctrl+K</kbd> 切换</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.search-trigger-shell {
		display: flex;
		align-items: center;
		margin-right: 0.35rem;
	}

	.search-trigger {
		display: inline-flex;
		height: 2.75rem;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0 0.55rem;
		border: 0;
		border-radius: 0.65rem;
		background: transparent;
		color: inherit;
		cursor: pointer;
		transition:
			background-color 180ms ease,
			box-shadow 180ms ease,
			color 180ms ease,
			transform 180ms ease;
	}

	.search-trigger:hover,
	.search-trigger:focus-visible {
		background: var(--btn-regular-bg-hover);
		box-shadow: 0 0.35rem 0.9rem color-mix(in oklch, var(--primary) 18%, transparent);
		color: var(--deep-text);
		outline: none;
	}

	.search-trigger:focus-visible {
		box-shadow:
			0 0 0 2px color-mix(in oklch, var(--primary) 48%, transparent),
			0 0.35rem 0.9rem color-mix(in oklch, var(--primary) 18%, transparent);
	}

	.search-trigger:active {
		transform: scale(0.94);
	}

	.search-shortcut {
		font-size: 0.82rem;
		font-weight: 760;
		line-height: 1;
		white-space: nowrap;
	}

	.search-trigger :global(.search-trigger-icon) {
		width: 1.55rem;
		height: 1.55rem;
		font-size: 1.55rem;
	}

	:global(:root.dark) .search-trigger:hover,
	:global(:root.dark) .search-trigger:focus-visible {
		background: var(--btn-regular-bg-hover);
		color: var(--btn-content);
	}

	.search-modal {
		position: fixed;
		inset: 0;
		z-index: 1200;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: clamp(5.5rem, 12vh, 8.5rem) 1rem 2rem;
		overflow-y: auto;
		background: rgb(30 30 30 / 52%);
		backdrop-filter: blur(7px) saturate(0.82);
		-webkit-backdrop-filter: blur(7px) saturate(0.82);
		animation: search-backdrop-in 220ms ease-out both;
	}

	.search-modal-content {
		width: min(45rem, 100%);
		animation: search-content-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	.search-modal-title {
		margin: 0 0 0.85rem;
		color: rgb(255 255 255 / 74%);
		font-size: 0.8rem;
		font-weight: 500;
		letter-spacing: 0.28em;
		text-align: center;
		text-shadow: 0 1px 0 rgb(0 0 0 / 16%);
	}

	.search-input-shell {
		position: relative;
		display: flex;
		height: 4.4rem;
		align-items: center;
		border: 1px solid rgb(255 255 255 / 82%);
		border-radius: 999px;
		background: rgb(255 255 255 / 97%);
		box-shadow:
			0 1.2rem 3.2rem rgb(0 0 0 / 18%),
			inset 0 1px 0 rgb(255 255 255 / 92%);
		transition:
			border-color 180ms ease,
			box-shadow 180ms ease;
	}

	.search-input-shell:focus-within {
		border-color: color-mix(in oklch, var(--primary) 62%, white);
		box-shadow:
			0 1.2rem 3.2rem rgb(0 0 0 / 18%),
			0 0 0 3px color-mix(in oklch, var(--primary) 24%, transparent);
	}

	.search-input {
		width: 100%;
		height: 100%;
		min-width: 0;
		padding: 0 5rem 0 1.8rem;
		border: 0;
		background: transparent;
		color: #202124;
		font: inherit;
		font-size: clamp(1rem, 1.7vw, 1.2rem);
		outline: 0;
	}

	.search-input::placeholder {
		color: rgb(32 33 36 / 42%);
	}

	.search-input::-webkit-search-cancel-button {
		display: none;
	}

	.search-submit {
		position: absolute;
		right: 0.95rem;
		display: grid;
		width: 2.55rem;
		height: 2.55rem;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: #18181b;
		color: #fff;
		cursor: pointer;
		place-items: center;
		transition:
			background-color 180ms ease,
			color 180ms ease,
			transform 180ms ease;
	}

	.search-submit:disabled {
		background: #e9e9e9;
		color: #aaa;
		cursor: default;
	}

	.search-submit:not(:disabled):hover,
	.search-submit:not(:disabled):focus-visible {
		background: color-mix(in oklch, var(--primary) 68%, #18181b);
		outline: none;
		transform: translateX(2px);
	}

	.search-submit :global(svg) {
		width: 1.25rem;
		height: 1.25rem;
	}

	.search-results {
		max-height: min(44vh, 25rem);
		margin-top: 0.75rem;
		padding: 0.5rem;
		overflow-y: auto;
		overscroll-behavior: contain;
		border: 1px solid rgb(255 255 255 / 64%);
		border-radius: 1rem;
		background: rgb(255 255 255 / 96%);
		box-shadow: 0 1rem 2.8rem rgb(0 0 0 / 18%);
		animation: search-results-in 180ms ease-out both;
	}

	.search-result-item {
		display: block;
		padding: 0.72rem 0.85rem;
		border-radius: 0.72rem;
		color: #202124;
		text-decoration: none;
		transition:
			background-color 160ms ease,
			color 160ms ease;
	}

	.search-result-item:hover,
	.search-result-item:focus-visible {
		background: rgb(0 0 0 / 5%);
		outline: none;
	}

	.search-result-title {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.98rem;
		font-weight: 720;
	}

	.search-result-title :global(svg) {
		width: 1rem;
		height: 1rem;
		flex: 0 0 auto;
		color: var(--ui-icon-color);
		opacity: 0;
		transform: translateX(-0.25rem);
		transition:
			opacity 160ms ease,
			transform 160ms ease;
	}

	.search-result-item:hover .search-result-title :global(svg),
	.search-result-item:focus-visible .search-result-title :global(svg) {
		opacity: 1;
		transform: translateX(0);
	}

	.search-result-excerpt {
		display: -webkit-box;
		margin-top: 0.24rem;
		overflow: hidden;
		color: rgb(32 33 36 / 58%);
		font-size: 0.84rem;
		line-height: 1.55;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}

	.search-result-excerpt :global(mark) {
		background: transparent;
		color: var(--primary);
		font-weight: 700;
	}

	.search-result-more {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.65rem;
		border-radius: 0.7rem;
		color: var(--primary);
		font-size: 0.88rem;
		font-weight: 720;
		text-decoration: none;
	}

	.search-result-more:hover,
	.search-result-more:focus-visible {
		background: color-mix(in oklch, var(--primary) 9%, transparent);
		outline: none;
	}

	.search-result-more :global(svg) {
		width: 1rem;
		height: 1rem;
	}

	.search-status {
		padding: 1rem;
		color: rgb(32 33 36 / 58%);
		font-size: 0.92rem;
		text-align: center;
	}

	.search-hints {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.3rem;
		margin-top: 0.85rem;
		color: rgb(255 255 255 / 58%);
		font-size: 0.78rem;
	}

	.search-hints span {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		white-space: nowrap;
	}

	.search-hints kbd {
		padding: 0.24rem 0.42rem;
		border: 1px solid rgb(255 255 255 / 28%);
		border-radius: 0.3rem;
		background: rgb(255 255 255 / 4%);
		color: rgb(255 255 255 / 72%);
		font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
		font-size: 0.7rem;
		line-height: 1;
	}

	:global(:root.dark) .search-modal {
		background: rgb(0 0 0 / 68%);
	}

	:global(:root.dark) .search-input-shell,
	:global(:root.dark) .search-results {
		border-color: rgb(255 255 255 / 14%);
		background: rgb(24 24 27 / 97%);
		box-shadow: 0 1.2rem 3.2rem rgb(0 0 0 / 42%);
	}

	:global(:root.dark) .search-input {
		color: #f4f4f5;
	}

	:global(:root.dark) .search-input::placeholder,
	:global(:root.dark) .search-status,
	:global(:root.dark) .search-result-excerpt {
		color: rgb(244 244 245 / 48%);
	}

	:global(:root.dark) .search-result-item {
		color: #f4f4f5;
	}

	:global(:root.dark) .search-result-item:hover,
	:global(:root.dark) .search-result-item:focus-visible {
		background: rgb(255 255 255 / 7%);
	}

	:global(:root.dark) .search-submit {
		background: #f4f4f5;
		color: #18181b;
	}

	:global(:root.dark) .search-submit:disabled {
		background: #303034;
		color: #666;
	}

	@keyframes search-backdrop-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes search-content-in {
		from {
			opacity: 0;
			transform: translateY(0.8rem) scale(0.985);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes search-results-in {
		from {
			opacity: 0;
			transform: translateY(-0.25rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 1023px) {
		.search-shortcut {
			display: none;
		}

		.search-trigger {
			width: 2.75rem;
			padding: 0;
		}
	}

	@media (max-width: 640px) {
		.search-trigger-shell {
			margin-right: 0;
		}

		.search-trigger,
		.search-trigger-shell {
			height: 2.25rem;
		}

		.search-trigger {
			width: 2.25rem;
			border-radius: 0.55rem;
		}

		.search-trigger :global(.search-trigger-icon) {
			width: 1.35rem;
			height: 1.35rem;
			font-size: 1.35rem;
		}

		.search-modal {
			padding: max(5.25rem, 11svh) 0.85rem 1rem;
		}

		.search-modal-title {
			margin-bottom: 0.7rem;
			font-size: 0.72rem;
		}

		.search-input-shell {
			height: 3.65rem;
		}

		.search-input {
			padding-right: 4.2rem;
			padding-left: 1.25rem;
			font-size: 1rem;
		}

		.search-submit {
			right: 0.65rem;
			width: 2.35rem;
			height: 2.35rem;
		}

		.search-results {
			max-height: 48svh;
		}

		.search-hints {
			gap: 0.65rem;
			font-size: 0.68rem;
		}

		.search-hints span {
			gap: 0.28rem;
		}

		.search-hints kbd {
			font-size: 0.62rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.search-modal,
		.search-modal-content,
		.search-results {
			animation: none;
		}

		.search-trigger,
		.search-input-shell,
		.search-submit,
		.search-result-item,
		.search-result-title :global(svg) {
			transition: none;
		}
	}
</style>
