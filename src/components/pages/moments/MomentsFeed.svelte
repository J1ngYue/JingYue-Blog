<script lang="ts">
import { onMount, tick } from "svelte";
import { registerDynamicGallery } from "@/components/pages/dynamic/dynamic-gallery";
import { registerDynamicInlineComments } from "@/components/pages/dynamic/dynamic-inline-comments";
import { formatTimezoneOffset } from "@/utils/date-utils";

type MomentImage = {
	alt: string;
	src: string;
	title?: string;
};

type MomentData = {
	html: string;
	id: string;
	images: MomentImage[];
	pinned?: boolean;
	published: number;
	tags?: string[];
};

interface Props {
	allYearsText: string;
	author: string;
	emptyText: string;
	itemsPerPage: number;
	loadingText: string;
	showComments: boolean;
	source: string;
	timezone: string;
}

const {
	allYearsText,
	author,
	emptyText,
	itemsPerPage,
	loadingText,
	showComments,
	source,
	timezone,
}: Props = $props();

let entries = $state<MomentData[]>([]);
let loading = $state(true);
let failed = $state(false);
let displayedCount = $state(itemsPerPage);
let activeYear = $state("all");
let list: HTMLElement;
let template: HTMLTemplateElement | null = null;
let sentinel: HTMLDivElement;
let copiedId = $state("");
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

const pinnedEntries = $derived(
	entries.filter((entry) => entry.pinned && matchesYear(entry)),
);
const regularEntries = $derived(
	entries.filter((entry) => !entry.pinned && matchesYear(entry)),
);
const visibleRegularEntries = $derived(regularEntries.slice(0, displayedCount));
const visibleEntries = $derived([...pinnedEntries, ...visibleRegularEntries]);
const hasMore = $derived(displayedCount < regularEntries.length);
const years = $derived(
	[
		...new Set(
			entries.map((entry) => new Date(entry.published).getUTCFullYear()),
		),
	].sort((left, right) => right - left),
);

function matchesYear(entry: MomentData) {
	return (
		activeYear === "all" ||
		String(new Date(entry.published).getUTCFullYear()) === activeYear
	);
}

function anchorId(entry: MomentData) {
	return `moment-${entry.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function permalink(entry: MomentData) {
	return `${window.location.pathname}${window.location.search}#${anchorId(entry)}`;
}

function formatTime(published: number) {
	const date = new Date(published);
	const elapsed = Date.now() - date.getTime();
	const minutes = Math.floor(elapsed / 60_000);
	if (minutes >= 0 && minutes < 1) return "刚刚";
	if (minutes < 60) return `${minutes}分钟前`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}小时前`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}天前`;
	const formatted = new Intl.DateTimeFormat(
		document.documentElement.lang || undefined,
		{
			timeZone: "UTC",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		},
	).format(date);
	return `${formatted} ${formatTimezoneOffset(timezone, date)}`;
}

function createMoment(entry: MomentData) {
	if (!template) return null;
	const fragment = template.content.cloneNode(true) as DocumentFragment;
	const root = fragment.querySelector<HTMLElement>("[data-moment-entry]");
	if (!root) return null;
	root.id = anchorId(entry);
	if (entry.pinned) root.dataset.pinned = "true";

	root.querySelectorAll<HTMLElement>("[data-moment-author]").forEach((node) => {
		node.textContent = author;
	});
	const time = root.querySelector<HTMLTimeElement>("[data-moment-time]");
	if (time) {
		const date = new Date(entry.published);
		time.dateTime = date.toISOString();
		time.textContent = formatTime(entry.published);
		time.title = `${new Intl.DateTimeFormat(
			document.documentElement.lang || undefined,
			{
				timeZone: "UTC",
				dateStyle: "medium",
				timeStyle: "short",
			},
		).format(date)} ${formatTimezoneOffset(timezone, date)}`;
	}

	const pin = root.querySelector<HTMLElement>("[data-moment-pin]");
	if (pin) pin.hidden = !entry.pinned;

	const content = root.querySelector<HTMLElement>("[data-moment-content]");
	if (content) {
		content.id = `${anchorId(entry)}-content`;
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

	const tags = root.querySelector<HTMLElement>("[data-moment-tags]");
	if (tags) {
		for (const tag of entry.tags || []) {
			const item = document.createElement("span");
			item.textContent = `#${tag}`;
			tags.append(item);
		}
		tags.hidden = tags.childElementCount === 0;
	}

	const link = permalink(entry);
	root
		.querySelectorAll<HTMLAnchorElement>("[data-moment-permalink]")
		.forEach((node) => {
			node.href = link;
			node.dataset.noSwup = "";
		});
	root
		.querySelector<HTMLButtonElement>("[data-moment-share]")
		?.addEventListener("click", async () => {
			const absoluteURL = new URL(link, window.location.href).href;
			try {
				if (navigator.share) {
					await navigator.share({
						title: `${author} 的说说`,
						url: absoluteURL,
					});
				} else {
					await navigator.clipboard.writeText(absoluteURL);
					copiedId = entry.id;
					if (copiedTimer) clearTimeout(copiedTimer);
					copiedTimer = setTimeout(() => (copiedId = ""), 1800);
				}
			} catch (error) {
				if (error instanceof Error && error.name !== "AbortError") {
					console.error("Failed to share moment", error);
				}
			}
		});

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

async function renderItems(items: MomentData[]) {
	await tick();
	if (!list || !template) return;
	list.replaceChildren();
	for (const entry of items) {
		const item = createMoment(entry);
		if (item) list.append(item);
	}
	const hash = decodeURIComponent(window.location.hash.slice(1));
	if (hash) document.getElementById(hash)?.scrollIntoView({ block: "start" });
}

function setYear(year: string) {
	activeYear = year;
	displayedCount = itemsPerPage;
}

$effect(() => {
	renderItems(visibleEntries);
});

onMount(() => {
	registerDynamicGallery();
	registerDynamicInlineComments();
	template = document.querySelector<HTMLTemplateElement>(
		"[data-moment-template]",
	);
	const observer = new IntersectionObserver(
		(entries) => {
			if (entries.some((entry) => entry.isIntersecting) && hasMore) {
				displayedCount += itemsPerPage;
			}
		},
		{ rootMargin: "240px 0px" },
	);
	observer.observe(sentinel);

	const load = async () => {
		try {
			const response = await fetch(source);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			entries = (await response.json()) as MomentData[];
		} catch (error) {
			console.error("Failed to load moments", error);
			failed = true;
		} finally {
			loading = false;
		}
	};
	void load();

	return () => {
		observer.disconnect();
		if (copiedTimer) clearTimeout(copiedTimer);
	};
});
</script>

<div class="moments-filter" aria-label="说说年份筛选">
	<button
		type="button"
		class:is-active={activeYear === "all"}
		aria-pressed={activeYear === "all"}
		onclick={() => setYear("all")}
	>{allYearsText}</button>
	{#each years as year}
		<button
			type="button"
			class:is-active={activeYear === String(year)}
			aria-pressed={activeYear === String(year)}
			onclick={() => setYear(String(year))}
		>{year}</button>
	{/each}
</div>

{#if loading}
	<div class="moments-state card-base" role="status">
		<span class="moments-spinner" aria-hidden="true"></span>
		<p>{loadingText}</p>
	</div>
{:else if failed || entries.length === 0}
	<div class="moments-state card-base"><p>{emptyText}</p></div>
{/if}

{#if copiedId}
	<div class="moments-toast" role="status">说说链接已复制</div>
{/if}

<div class="moments-feed" bind:this={list}></div>

<div class="moments-sentinel" bind:this={sentinel} aria-live="polite">
	{#if !loading && !failed && hasMore}
		<span class="moments-spinner moments-spinner--small" aria-hidden="true"></span>
		<span>加载中...</span>
	{:else if !loading && !failed && visibleEntries.length > 0}
		<span>没有更多了</span>
	{/if}
</div>
