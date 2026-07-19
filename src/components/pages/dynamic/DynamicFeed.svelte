<script lang="ts">
import { onMount, tick } from "svelte";
import ClientPagination from "@/components/common/ClientPagination.svelte";
import { formatTimezoneOffset } from "@/utils/date-utils";
import { registerDynamicGallery } from "./dynamic-gallery";
import { registerDynamicInlineComments } from "./dynamic-inline-comments";

type DynamicImage = {
	alt: string;
	src: string;
	title?: string;
};

type DynamicData = {
	id: string;
	published: number;
	html: string;
	images: DynamicImage[];
	searchText: string;
};

interface Props {
	source: string;
	itemsPerPage: number;
	showComments: boolean;
	emptyText: string;
	noResultsText: string;
	loadingText: string;
	allYearsText: string;
	timezone: string;
}

const {
	source,
	itemsPerPage,
	showComments,
	emptyText,
	noResultsText,
	loadingText,
	allYearsText,
	timezone,
}: Props = $props();

let entries = $state<DynamicData[]>([]);
let filtered = $state<DynamicData[]>([]);
let currentPage = $state(1);
let loading = $state(true);
let failed = $state(false);
let templateReady = $state(false);
let list: HTMLElement;
let template: HTMLTemplateElement | null = null;
let searchInput: HTMLInputElement | null = null;
let yearSelect: HTMLSelectElement | null = null;
let sortSelect: HTMLSelectElement | null = null;
let restoreAnchorAfterRender = false;
let activeQuery = $state("");
let activeYear = $state("all");
let activeSort = $state<"newest" | "oldest">("newest");
let notice = $state("");
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

const pageEntries = $derived(
	filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
);

function pageFromUrl() {
	return Math.max(
		1,
		Number(new URL(window.location.href).searchParams.get("page")) || 1,
	);
}

function updateUrl(clearHash = false) {
	const current = new URL(window.location.href);
	if (currentPage > 1) current.searchParams.set("page", String(currentPage));
	else current.searchParams.delete("page");
	if (activeQuery) current.searchParams.set("q", activeQuery);
	else current.searchParams.delete("q");
	if (activeYear !== "all") current.searchParams.set("year", activeYear);
	else current.searchParams.delete("year");
	if (activeSort === "oldest") current.searchParams.set("sort", activeSort);
	else current.searchParams.delete("sort");
	if (clearHash) current.hash = "";
	history.replaceState(history.state, "", current);
}

function applyFilters(resetPage = true) {
	const query = normalizeSearchValue(searchInput?.value || "");
	const year = yearSelect?.value || "all";
	const sort = sortSelect?.value === "oldest" ? "oldest" : "newest";
	activeQuery = query;
	activeYear = year;
	activeSort = sort;
	filtered = entries
		.filter(
			(entry) =>
				(year === "all" ||
					String(new Date(entry.published).getUTCFullYear()) === year) &&
				(!query || matchesQuery(entry.searchText, query)),
		)
		.sort((left, right) =>
			sort === "oldest"
				? left.published - right.published
				: right.published - left.published,
		);
	if (resetPage) currentPage = 1;
	const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
	currentPage = Math.min(currentPage, totalPages);
	updateUrl(resetPage);
}

function resetFilters() {
	if (searchInput) searchInput.value = "";
	if (yearSelect) yearSelect.value = "all";
	if (sortSelect) sortSelect.value = "newest";
	applyFilters();
	searchInput?.focus();
}

function normalizeSearchValue(value: string) {
	return value
		.normalize("NFKD")
		.replace(/\p{Diacritic}/gu, "")
		.toLocaleLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

function matchesQuery(searchText: string, query: string) {
	const haystack = normalizeSearchValue(searchText);
	return query
		.split(" ")
		.filter(Boolean)
		.every((token) => haystack.includes(token));
}

function showNotice(message: string) {
	notice = message;
	if (noticeTimer) clearTimeout(noticeTimer);
	noticeTimer = setTimeout(() => {
		notice = "";
	}, 2200);
}

function populateYears() {
	if (!yearSelect) return;
	yearSelect.replaceChildren();
	const all = document.createElement("option");
	all.value = "all";
	all.textContent = allYearsText;
	yearSelect.append(all);
	const years = [
		...new Set(
			entries.map((entry) => new Date(entry.published).getUTCFullYear()),
		),
	];
	for (const year of years) {
		const option = document.createElement("option");
		option.value = String(year);
		option.textContent = String(year);
		yearSelect.append(option);
	}
}

function createItem(entry: DynamicData) {
	if (!template) return null;
	const fragment = template.content.cloneNode(true) as DocumentFragment;
	const root = fragment.querySelector<HTMLElement>("[data-dynamic-entry]");
	if (!root) return null;
	const anchorId = `dynamic-${entry.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
	const permalinkUrl = new URL(window.location.href);
	permalinkUrl.hash = anchorId;
	const permalink = `${permalinkUrl.pathname}${permalinkUrl.search}${permalinkUrl.hash}`;
	root.id = anchorId;
	root.dataset.year = String(new Date(entry.published).getUTCFullYear());

	const author = root.querySelector<HTMLElement>("[data-dynamic-author]");
	if (author) {
		author.id = `${anchorId}-author`;
		root.querySelector("article")?.setAttribute("aria-labelledby", author.id);
	}
	root
		.querySelectorAll<HTMLAnchorElement>("[data-dynamic-permalink]")
		.forEach((link) => {
			link.href = permalink;
			link.dataset.noSwup = "";
			link.addEventListener("click", async (event) => {
				if (
					event.button !== 0 ||
					event.metaKey ||
					event.ctrlKey ||
					event.shiftKey ||
					event.altKey
				)
					return;
				event.preventDefault();
				event.stopPropagation();
				if (link.hasAttribute("data-dynamic-copy-link")) {
					try {
						await navigator.clipboard.writeText(
							new URL(permalink, window.location.href).href,
						);
						showNotice("动态链接已复制");
					} catch {
						history.replaceState(history.state, "", permalink);
						showNotice("已定位到这条动态");
					}
					return;
				}
				history.replaceState(history.state, "", permalink);
			});
		});
	const time = root.querySelector<HTMLTimeElement>("[data-dynamic-time]");
	if (time) {
		const date = new Date(entry.published);
		time.dateTime = date.toISOString();
		time.textContent = new Intl.DateTimeFormat(
			document.documentElement.lang || undefined,
			{
				timeZone: "UTC",
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			},
		).format(date);
		time.textContent += ` ${formatTimezoneOffset(timezone, date)}`;
	}

	const content = root.querySelector<HTMLElement>("[data-dynamic-content]");
	if (content) {
		content.id = `${anchorId}-content`;
		content.innerHTML = entry.html;
		for (const image of entry.images) {
			const element = document.createElement("img");
			element.src = image.src;
			element.alt = image.alt;
			element.loading = "lazy";
			if (image.title) element.title = image.title;
			content.append(element);
		}
		const gallery = root.querySelector<HTMLElement>("dynamic-gallery");
		if (gallery) gallery.dataset.sourceId = content.id;
	}

	const comments = root.querySelector<HTMLElement>("dynamic-inline-comments");
	if (comments) {
		if (showComments) {
			comments.dataset.src = `/dynamic/comments/?path=${encodeURIComponent(
				`/dynamic/${entry.id}/`,
			)}`;
		} else {
			comments.remove();
		}
	}
	return fragment;
}

async function renderItems(items: DynamicData[]) {
	await tick();
	if (!list || !template) return;
	list.replaceChildren();
	for (const entry of items) {
		const item = createItem(entry);
		if (item) list.append(item);
	}
	if (!activeQuery && activeYear === "all" && activeSort === "newest") {
		requestAnimationFrame(() => {
			const height = Math.ceil(list.getBoundingClientRect().height);
			if (height > 0)
				list.style.setProperty("--dynamic-feed-stable-height", `${height}px`);
		});
	}
	if (restoreAnchorAfterRender) {
		restoreAnchorAfterRender = false;
		const target = document.getElementById(
			decodeURIComponent(window.location.hash.slice(1)),
		);
		target?.scrollIntoView({ behavior: "auto", block: "start" });
	}
}

function goToPage(page: number) {
	currentPage = page;
	updateUrl(true);
	document
		.querySelector(".dynamic-page")
		?.scrollIntoView({ behavior: "smooth", block: "start" });
}

$effect(() => {
	if (!templateReady) return;
	renderItems(pageEntries);
});

onMount(() => {
	registerDynamicGallery();
	registerDynamicInlineComments();
	const page = list.closest(".dynamic-page");
	template =
		page?.querySelector<HTMLTemplateElement>("[data-dynamic-item-template]") ??
		null;
	templateReady = template !== null;
	searchInput =
		page?.querySelector<HTMLInputElement>("[data-dynamic-search]") ?? null;
	yearSelect =
		page?.querySelector<HTMLSelectElement>("[data-year-select]") ?? null;
	sortSelect =
		page?.querySelector<HTMLSelectElement>("[data-dynamic-sort]") ?? null;
	const filter = () => applyFilters();
	searchInput?.addEventListener("input", filter);
	yearSelect?.addEventListener("change", filter);
	sortSelect?.addEventListener("change", filter);

	const load = async () => {
		try {
			const response = await fetch(source);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			entries = (await response.json()) as DynamicData[];
			populateYears();
			const currentUrl = new URL(window.location.href);
			if (searchInput)
				searchInput.value = currentUrl.searchParams.get("q") || "";
			if (yearSelect) {
				const requestedYear = currentUrl.searchParams.get("year") || "all";
				const exists = Array.from(yearSelect.options).some(
					(option) => option.value === requestedYear,
				);
				yearSelect.value = exists ? requestedYear : "all";
			}
			if (sortSelect) {
				sortSelect.value =
					currentUrl.searchParams.get("sort") === "oldest"
						? "oldest"
						: "newest";
			}
			currentPage = pageFromUrl();
			applyFilters(false);
			const anchorId = decodeURIComponent(window.location.hash.slice(1));
			if (anchorId) {
				const anchorIndex = filtered.findIndex(
					(entry) =>
						`dynamic-${entry.id.replace(/[^a-zA-Z0-9_-]/g, "-")}` === anchorId,
				);
				if (anchorIndex >= 0) {
					currentPage = Math.floor(anchorIndex / itemsPerPage) + 1;
					updateUrl();
					restoreAnchorAfterRender = true;
				}
			}
		} catch (error) {
			console.error("Failed to load dynamics", error);
			failed = true;
		} finally {
			loading = false;
		}
	};
	void load();

	return () => {
		if (noticeTimer) clearTimeout(noticeTimer);
		searchInput?.removeEventListener("input", filter);
		yearSelect?.removeEventListener("change", filter);
		sortSelect?.removeEventListener("change", filter);
	};
});
</script>

{#if loading}
	<div class="dynamic-loading card-base" role="status">
		<span class="dynamic-loading-spinner" aria-hidden="true"></span>
		<p>{loadingText}</p>
	</div>
{:else if failed || entries.length === 0}
	<div class="dynamic-empty card-base">
		<p>{emptyText}</p>
	</div>
{:else if filtered.length === 0}
	<div class="dynamic-no-results card-base">
		<p>{noResultsText}</p>
	</div>
{/if}

{#if !loading && !failed && entries.length > 0}
	<div class="dynamic-filter-status" aria-live="polite">
		<span>显示 {filtered.length} / {entries.length} 条动态</span>
		{#if notice}
			<strong>{notice}</strong>
		{:else if activeQuery || activeYear !== "all" || activeSort !== "newest"}
			<button type="button" onclick={resetFilters}>清除筛选</button>
		{/if}
	</div>
{/if}

<div class="dynamic-feed" bind:this={list}></div>

{#if !loading && !failed}
	<ClientPagination
		totalItems={filtered.length}
		{itemsPerPage}
		{currentPage}
		onPageChange={goToPage}
	/>
{/if}
