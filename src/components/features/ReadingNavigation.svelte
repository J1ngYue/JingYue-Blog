<script lang="ts">
import { onMount, tick, untrack } from "svelte";
import { fly, slide } from "svelte/transition";
import Icon from "@/components/common/Icon.svelte";
import {
	buildReadingOutline,
	type OutlineNode,
	outlinePath,
	readingHeading,
	readingProgress,
} from "@/utils/reading-outline";
import type { TocInput } from "@/utils/toc-shared";

interface LibraryGroup {
	name: string;
	entries: { id: string; title: string; href: string; published: Date }[];
}

let {
	headings,
	title,
	encrypted,
	libraryGroups,
	libraryTitle,
	currentId,
	currentCategory,
}: {
	headings: TocInput[];
	title: string;
	encrypted: boolean;
	libraryGroups: LibraryGroup[];
	libraryTitle: string;
	currentId: string;
	currentCategory: string;
} = $props();

let outline = $state(buildReadingOutline(untrack(() => headings)));
let locked = $state(untrack(() => encrypted));
let view = $state<"outline" | "library">("outline");
let activeId = $state("");
let progress = $state(0);
let automatic = $state(true);
let expanded = $state<Set<string>>(new Set());
let categories = $state<Set<string>>(new Set([untrack(() => currentCategory)]));
let reducedMotion = $state(false);
let mapOpen = $state(false);
let mapFullscreen = $state(false);
let zoom = $state(1);
let navigation: HTMLDivElement;
let scrollArea: HTMLDivElement;
let mapDialog = $state<HTMLDialogElement>();
let mapCanvas = $state<HTMLDivElement>();
let activeLink: HTMLAnchorElement | undefined;
const count = $derived(
	libraryGroups.reduce((total, group) => total + group.entries.length, 0),
);
const duration = $derived(reducedMotion ? 0 : 220);
const activePath = $derived(outlinePath(outline, activeId));
const branches = $derived(collectBranches(outline));
const allExpanded = $derived(
	branches.length > 0 && branches.every((id) => expanded.has(id)),
);

function collectBranches(nodes: OutlineNode[]): string[] {
	return nodes.flatMap((node) =>
		node.children.length ? [node.id, ...collectBranches(node.children)] : [],
	);
}

function toggleBranch(id: string) {
	automatic = false;
	const next = new Set(expanded);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	expanded = next;
}

function toggleAll() {
	automatic = false;
	expanded = allExpanded ? new Set() : new Set(branches);
}

function toggleAutomatic() {
	automatic = !automatic;
	if (automatic) expanded = new Set(activePath);
}

function toggleCategory(name: string) {
	const next = new Set(categories);
	if (next.has(name)) next.delete(name);
	else next.add(name);
	categories = next;
}

function navigate(event: MouseEvent, id?: string) {
	if (
		event.ctrlKey ||
		event.metaKey ||
		event.shiftKey ||
		event.altKey ||
		event.button !== 0
	)
		return;
	const target = id
		? document.getElementById(id)
		: document.querySelector(".post-reading-title");
	if (!target) return;
	event.preventDefault();
	if (mapOpen) mapDialog?.close();
	window.scrollTo({
		top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - 100),
		behavior: reducedMotion ? "instant" : "smooth",
	});
	history.replaceState(
		history.state,
		"",
		id ? `#${encodeURIComponent(id)}` : location.pathname + location.search,
	);
	navigation.dispatchEvent(
		new CustomEvent("article:navigate", { bubbles: true }),
	);
}

async function openMap() {
	mapOpen = true;
	mapFullscreen = false;
	zoom = 1;
	await tick();
	mapDialog?.showModal();
}

function changeZoom(delta: number) {
	zoom = Math.max(0.5, Math.min(1.8, Math.round((zoom + delta) * 10) / 10));
}

function resetMap() {
	zoom = 1;
	mapCanvas?.scrollTo({
		top: 0,
		left: 0,
		behavior: reducedMotion ? "instant" : "smooth",
	});
}

function trackActive(element: HTMLAnchorElement, active: boolean) {
	if (active) activeLink = element;
	return {
		update(value: boolean) {
			if (value) activeLink = element;
		},
	};
}

function switchTab(event: KeyboardEvent) {
	if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
	event.preventDefault();
	view =
		event.key === "Home"
			? "outline"
			: event.key === "End"
				? "library"
				: view === "outline"
					? "library"
					: "outline";
	navigation
		.querySelector<HTMLButtonElement>(
			view === "outline" ? "#reading-outline-tab" : "#reading-library-tab",
		)
		?.focus();
}

onMount(() => {
	const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
	const syncMotion = () => {
		reducedMotion = motion.matches;
	};
	syncMotion();
	motion.addEventListener("change", syncMotion);
	let content: HTMLElement | null;
	let positions: { id: string; top: number }[] = [];
	let start = 0;
	let end = 0;
	let frame = 0;
	let dirty = true;
	let followTimer = 0;
	let pausedUntil = 0;
	const pauseFollowing = () => {
		pausedUntil = performance.now() + 1200;
	};

	function followActive() {
		window.clearTimeout(followTimer);
		followTimer = window.setTimeout(async () => {
			await tick();
			if (
				!activeLink?.isConnected ||
				activeLink.getAttribute("href") !== `#${activeId}` ||
				view !== "outline" ||
				performance.now() < pausedUntil ||
				navigation.closest(".is-collapsed")
			)
				return;
			const row = activeLink.getBoundingClientRect();
			const bounds = scrollArea.getBoundingClientRect();
			if (row.top < bounds.top + 16 || row.bottom > bounds.bottom - 16) {
				scrollArea.scrollTo({
					top: scrollArea.scrollTop + row.top - bounds.top - bounds.height / 3,
					behavior: reducedMotion ? "instant" : "smooth",
				});
			}
		}, duration);
	}

	function update() {
		frame = 0;
		if (!content || locked) return;
		const contentBounds = content.getBoundingClientRect();
		if (dirty) {
			positions = Array.from(
				content.querySelectorAll<HTMLElement>(
					"h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]",
				),
				(element) => ({
					id: element.id,
					top: element.getBoundingClientRect().top - contentBounds.top,
				}),
			);
			dirty = false;
		}
		const titleElement =
			document.querySelector(".post-reading-title") || content;
		start = titleElement.getBoundingClientRect().top + window.scrollY - 100;
		end = contentBounds.bottom + window.scrollY - window.innerHeight;
		progress = readingProgress(window.scrollY, start, Math.max(start, end));
		const current = readingHeading(positions, contentBounds.top);
		if (current !== activeId) {
			activeId = current;
			if (automatic) expanded = new Set(outlinePath(outline, current));
			followActive();
		}
	}
	const schedule = () => {
		if (!frame) frame = requestAnimationFrame(update);
	};
	const resize = () => {
		dirty = true;
		schedule();
	};
	const observer = new ResizeObserver(resize);
	function readContent() {
		observer.disconnect();
		content = document.querySelector<HTMLElement>("#post-container .custom-md");
		if (content) {
			locked = false;
			outline = buildReadingOutline(
				Array.from(
					content.querySelectorAll<HTMLElement>(
						"h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]",
					),
					(element) => ({
						depth: Number(element.tagName[1]),
						slug: element.id,
						text: element.textContent || element.id,
					}),
				),
			);
			observer.observe(content);
		}
		resize();
	}
	readContent();
	window.addEventListener("scroll", schedule, { passive: true });
	window.addEventListener("resize", resize);
	document.addEventListener("password:decrypted", readContent);
	scrollArea.addEventListener("wheel", pauseFollowing, { passive: true });
	scrollArea.addEventListener("touchstart", pauseFollowing, { passive: true });
	return () => {
		cancelAnimationFrame(frame);
		window.clearTimeout(followTimer);
		observer.disconnect();
		motion.removeEventListener("change", syncMotion);
		window.removeEventListener("scroll", schedule);
		window.removeEventListener("resize", resize);
		document.removeEventListener("password:decrypted", readContent);
		scrollArea.removeEventListener("wheel", pauseFollowing);
		scrollArea.removeEventListener("touchstart", pauseFollowing);
	};
});
</script>

{#snippet outlineNodes(nodes: OutlineNode[], map = false)}
	<ul class:map-branches={map}>
		{#each nodes as node (node.id)}
			<li class:in-path={activePath.includes(node.id)}>
				<div class="outline-row" class:is-active={activeId === node.id}>
					<a href="#{node.id}" title={node.text} aria-current={activeId === node.id ? "location" : undefined} onclick={(event) => navigate(event, node.id)} use:trackActive={activeId === node.id && !map}>
						<span class="outline-dot" aria-hidden="true"></span><span>{node.text}</span>
					</a>
					{#if node.children.length && !map}
						<button class="branch-toggle" aria-label="{expanded.has(node.id) ? '收起' : '展开'}：{node.text}" aria-expanded={expanded.has(node.id)} onclick={() => toggleBranch(node.id)}>
							<Icon icon="material-symbols:expand-more-rounded" />
						</button>
					{/if}
				</div>
				{#if node.children.length && (map || expanded.has(node.id))}
					<div class="outline-children" transition:slide={{ duration }}>
						{@render outlineNodes(node.children, map)}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<div class="reading-navigation" bind:this={navigation}>
	<div class="navigation-tabs" role="tablist" aria-label="阅读导航">
		<button id="reading-outline-tab" role="tab" aria-selected={view === "outline"} aria-controls="reading-outline-view" tabindex={view === "outline" ? 0 : -1} onclick={() => view = "outline"} onkeydown={switchTab}>
			<Icon icon="material-symbols:format-list-bulleted-rounded" />目录
		</button>
		<button id="reading-library-tab" role="tab" aria-selected={view === "library"} aria-controls="reading-library-view" tabindex={view === "library" ? 0 : -1} onclick={() => view = "library"} onkeydown={switchTab}>
			<Icon icon="material-symbols:library-books-rounded" />{libraryTitle}<small>{count}</small>
		</button>
	</div>
	<div class="navigation-body">
		<div id="reading-outline-view" class="navigation-view" class:is-hidden={view !== "outline"} role="tabpanel" tabindex="0" aria-labelledby="reading-outline-tab" inert={view !== "outline"} aria-hidden={view !== "outline"}>
			<div class="outline-toolbar">
				<button aria-label="自动手风琴" title="自动手风琴：跟随当前章节展开" aria-pressed={automatic} onclick={toggleAutomatic} disabled={locked || !branches.length}><Icon icon="mingcute:list-collapse-line" /></button>
				<button aria-label={allExpanded ? "全部收起" : "全部展开"} title={allExpanded ? "全部收起" : "全部展开"} onclick={toggleAll} disabled={locked || !branches.length}>
					{#if allExpanded}<Icon icon="material-symbols:unfold-less-rounded" />{:else}<Icon icon="material-symbols:unfold-more-rounded" />{/if}
				</button>
				<button aria-label="思维导图" title="思维导图" onclick={openMap} disabled={locked || !outline.length}><Icon icon="material-symbols:account-tree-outline-rounded" /></button>
				<span class="reading-progress" role="progressbar" aria-label="阅读进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>{progress}%</span>
			</div>
			<div class="outline-scroll custom-scrollbar" bind:this={scrollArea}>
				<nav class="outline-tree" aria-label="文章章节">
					<a class="outline-title" href="#post-container" title={title} aria-current={!activeId ? "location" : undefined} onclick={(event) => navigate(event)}><span class="outline-dot" aria-hidden="true"></span><strong>{title}</strong></a>
					{#if locked}<p class="empty-state">解锁文章后显示目录</p>
					{:else if !outline.length}<p class="empty-state">当前文章没有目录</p>
					{:else}{@render outlineNodes(outline)}{/if}
				</nav>
			</div>
			<div class="progress-track" aria-hidden="true"><span style:transform="scaleX({progress / 100})"></span></div>
		</div>
		<div id="reading-library-view" class="navigation-view library-scroll custom-scrollbar" class:is-hidden={view !== "library"} role="tabpanel" tabindex="0" aria-labelledby="reading-library-tab" inert={view !== "library"} aria-hidden={view !== "library"}>
			<nav class="library-tree" aria-label="{libraryTitle}分类">
				{#each libraryGroups as group (group.name)}
					<div class="library-group">
						<button class="category-toggle" aria-expanded={categories.has(group.name)} onclick={() => toggleCategory(group.name)}><Icon icon="material-symbols:folder-rounded" /><strong>{group.name}</strong><small>{group.entries.length}</small><span class:rotated={categories.has(group.name)}><Icon icon="material-symbols:chevron-right-rounded" /></span></button>
						{#if categories.has(group.name)}
							<div transition:slide={{ duration }} class="library-entries">
								{#each group.entries as entry (entry.id)}
									<a href={entry.href} title={entry.title} class:is-current={entry.id === currentId} aria-current={entry.id === currentId ? "page" : undefined}><Icon icon="material-symbols:description-outline-rounded" /><span>{entry.title}</span><time datetime={entry.published.toISOString()}>{new Intl.DateTimeFormat("en-CA").format(entry.published)}</time></a>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</nav>
		</div>
	</div>
</div>

{#if mapOpen}
	<dialog class="outline-map" class:is-fullscreen={mapFullscreen} bind:this={mapDialog} aria-label="文章思维导图" onclose={() => mapOpen = false} onclick={(event) => { if (event.target === mapDialog) mapDialog?.close(); }} onkeydown={(event) => { if (event.key === "Escape") mapDialog?.close(); }}>
		<div class="map-panel" transition:fly={{ y: reducedMotion ? 0 : 12, duration }}>
			<header><div><strong>思维导图</strong><small>{title}</small></div><div class="map-tools">
				<button aria-label="缩小导图" onclick={() => changeZoom(-0.1)} disabled={zoom <= 0.5}><Icon icon="material-symbols:zoom-out-rounded" /></button><span>{Math.round(zoom * 100)}%</span>
				<button aria-label="放大导图" onclick={() => changeZoom(0.1)} disabled={zoom >= 1.8}><Icon icon="material-symbols:zoom-in-rounded" /></button>
				<button aria-label="重置导图" onclick={resetMap}><Icon icon="material-symbols:restart-alt-rounded" /></button>
				<button aria-label={mapFullscreen ? "退出导图全屏" : "导图全屏"} aria-pressed={mapFullscreen} onclick={() => mapFullscreen = !mapFullscreen}>{#if mapFullscreen}<Icon icon="material-symbols:fullscreen-exit-rounded" />{:else}<Icon icon="material-symbols:fullscreen-rounded" />{/if}</button>
				<button aria-label="关闭思维导图" onclick={() => mapDialog?.close()}><Icon icon="material-symbols:close-rounded" /></button>
			</div></header>
			<div class="map-canvas custom-scrollbar" bind:this={mapCanvas}>
				<div class="map-tree" style:zoom={zoom}><a class="map-root" href="#post-container" onclick={(event) => navigate(event)}>{title}</a>{@render outlineNodes(outline, true)}</div>
			</div>
			<p>点击节点跳转章节 · 在画布内滚动查看 · Esc 关闭</p>
		</div>
	</dialog>
{/if}

<style>
.reading-navigation { position: relative; z-index: 1; display: flex; flex: 1; min-height: 0; flex-direction: column; color: var(--content-meta); }
button, a { -webkit-tap-highlight-color: transparent; }
button { cursor: pointer; }
button:disabled { opacity: .35; cursor: default; }
button:focus-visible, a:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.navigation-tabs { display: flex; gap: .25rem; padding: .75rem 2.8rem .75rem .75rem; border-bottom: 1px solid var(--line-divider); }
.navigation-tabs button { display: flex; align-items: center; justify-content: center; gap: .4rem; min-height: 2.5rem; padding: .4rem .6rem; border-radius: .7rem; font-size: .85rem; font-weight: 700; white-space: nowrap; transition: background 200ms, color 200ms; }
.navigation-tabs button[aria-selected="true"] { background: color-mix(in srgb, var(--primary) 12%, var(--card-bg)); color: var(--primary); }
.navigation-tabs small { min-width: 1.2rem; font-size: .65rem; font-variant-numeric: tabular-nums; opacity: .65; }
.navigation-body { position: relative; flex: 1; min-height: 0; }
.navigation-view { position: absolute; inset: 0; display: flex; flex-direction: column; opacity: 1; transform: translateX(0); visibility: visible; transition: opacity 200ms, transform 260ms cubic-bezier(.22,.8,.2,1), visibility 260ms; }
.navigation-view.is-hidden { opacity: 0; transform: translateX(-.65rem); visibility: hidden; pointer-events: none; }
.library-scroll.is-hidden { transform: translateX(.65rem); }
.outline-toolbar { display: flex; align-items: center; gap: .15rem; padding: .45rem .75rem .2rem; }
.outline-toolbar button, .map-tools button { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: .55rem; font-size: 1.1rem; transition: background 180ms, color 180ms; }
.outline-toolbar button:hover:not(:disabled), .map-tools button:hover:not(:disabled) { background: var(--btn-card-bg-hover); }
.outline-toolbar button[aria-pressed="true"] { color: var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); }
.reading-progress { margin-left: auto; color: var(--primary); font-size: .78rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.outline-scroll, .library-scroll { min-height: 0; flex: 1; overflow: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: .4rem .75rem 1rem; }
.outline-tree { position: relative; }
.outline-title { display: flex; align-items: center; gap: .6rem; min-height: 2.75rem; padding: .5rem .45rem; color: var(--deep-text); font-size: .86rem; }
.outline-title strong { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.outline-title .outline-dot { background: var(--primary); border-color: var(--primary); }
ul { margin: 0; padding: 0; list-style: none; }
.outline-tree > ul { margin-left: .77rem; padding-left: .45rem; border-left: 1px solid var(--line-divider); }
.outline-row { display: flex; align-items: center; min-height: 2.45rem; border-radius: .6rem; background: color-mix(in srgb, var(--card-bg) 60%, transparent); transition: color 180ms, background 200ms; }
.outline-row a { display: flex; flex: 1; min-width: 0; align-items: center; gap: .6rem; padding: .55rem .4rem; font-size: .82rem; }
.outline-row a > span:last-child { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.outline-dot { width: .5rem; height: .5rem; flex-shrink: 0; border: 1.5px solid color-mix(in srgb, var(--content-meta) 50%, transparent); border-radius: 50%; transition: background 200ms, border-color 200ms; }
.outline-row:hover, .outline-title:hover { background: color-mix(in srgb, var(--card-bg) 60%, transparent); }
.outline-row.is-active { background: color-mix(in srgb, var(--primary) 10%, transparent); color: var(--primary); font-weight: 700; }
.is-active .outline-dot { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent); }
.branch-toggle { width: 2rem; height: 2rem; flex-shrink: 0; border-radius: .5rem; display: grid; place-items: center; }
.branch-toggle :global(.inline-icon) { transition: transform 220ms; }
.branch-toggle[aria-expanded="false"] :global(.inline-icon) { transform: rotate(-90deg); }
.outline-children > ul { margin-left: .65rem; padding-left: .65rem; border-left: 1px solid var(--line-divider); }
li.in-path > .outline-children > ul { border-left-color: color-mix(in srgb, var(--primary) 55%, transparent); }
.empty-state { margin: 1.5rem 0; color: color-mix(in srgb, var(--content-meta) 70%, transparent); font-size: .8rem; text-align: center; }
.progress-track { height: 2px; flex-shrink: 0; background: var(--line-divider); }
.progress-track span { display: block; height: 100%; background: var(--primary); transform-origin: left; transition: transform 180ms linear; }
.library-scroll { padding-top: .7rem; }
.category-toggle { display: flex; align-items: center; width: 100%; gap: .6rem; padding: .5rem; min-height: 2.75rem; font-size: .8rem; border-radius: .6rem; }
.category-toggle strong { flex: 1; text-align: left; }
.category-toggle small { font-size: .7rem; opacity: .65; }
.category-toggle > span:last-child { transition: transform 220ms; }
.category-toggle .rotated { transform: rotate(90deg); }
.category-toggle:hover { background: var(--btn-card-bg-hover); }
.library-entries { margin: .1rem 0 .4rem .9rem; border-left: 1px solid var(--line-divider); padding-left: .5rem; }
.library-entries a { display: grid; grid-template-columns: 1rem minmax(0,1fr); column-gap: .5rem; min-height: 3rem; padding: .4rem .55rem; border-radius: .6rem; background: color-mix(in srgb, var(--card-bg) 72%, transparent); transition: background 180ms, color 180ms; }
.library-entries a > :global(.inline-icon) { grid-row: span 2; align-self: center; }
.library-entries a > span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: .78rem; }
.library-entries time { font-size: .65rem; color: color-mix(in srgb, var(--content-meta) 70%, transparent); font-variant-numeric: tabular-nums; }
.library-entries a:hover { background: color-mix(in srgb, var(--card-bg) 70%, transparent); }
.library-entries a.is-current { background: color-mix(in srgb, var(--primary) 10%, transparent); box-shadow: inset 3px 0 var(--primary); }
.outline-map { width: min(72rem, calc(100vw - 2rem)); height: min(48rem, calc(100dvh - 2rem)); max-width: none; max-height: none; margin: auto; padding: 0; overflow: hidden; border: 1px solid var(--line-divider); border-radius: 1.1rem; background: var(--card-bg); color: var(--content-meta); }
.outline-map::backdrop { background: rgb(0 0 0 / 40%); backdrop-filter: blur(5px); }
.outline-map.is-fullscreen { width: 100vw; height: 100dvh; border: 0; border-radius: 0; }
.map-panel { display: flex; height: 100%; flex-direction: column; }
.map-panel header { display: flex; justify-content: space-between; align-items: center; gap: .75rem; padding: .75rem 1rem; border-bottom: 1px solid var(--line-divider); }
.map-panel header > div:first-child { min-width: 0; }
.map-panel header small { display: block; max-width: 28rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .75rem; opacity: .65; }
.map-tools { display: flex; align-items: center; flex-shrink: 0; gap: .1rem; }
.map-tools > span { width: 3rem; text-align: center; font-size: .7rem; font-variant-numeric: tabular-nums; }
.map-canvas { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 2rem; background: radial-gradient(var(--line-divider) 1px, transparent 1px) 0 0 / 20px 20px; }
.map-tree { display: flex; align-items: flex-start; width: max-content; min-height: 100%; gap: 2rem; }
.map-root { width: 13rem; flex-shrink: 0; padding: 1rem; border: 1px solid var(--primary); border-radius: .8rem; background: var(--card-bg); color: var(--primary); font-size: .85rem; font-weight: 700; }
.map-branches { display: flex; flex-direction: column; gap: .65rem; }
.map-branches li { position: relative; display: flex; align-items: center; gap: 1.8rem; padding-left: 1rem; border-left: 1px solid var(--line-divider); }
.map-branches li::before { position: absolute; top: 50%; left: 0; width: 1rem; height: 1px; background: var(--line-divider); content: ""; }
.map-branches .outline-row { width: 13rem; border: 1px solid var(--line-divider); background: var(--card-bg); flex-shrink: 0; }
.map-branches .outline-row a > span:last-child { white-space: normal; }
.map-branches .outline-children > ul { margin: 0; padding: 0; border: 0; }
.map-panel > p { margin: 0; padding: .6rem 1rem; border-top: 1px solid var(--line-divider); font-size: .7rem; opacity: .65; }
@media (max-width: 760px) {
	.navigation-tabs { padding-left: .6rem; gap: .1rem; }
	.navigation-tabs button { font-size: .8rem; padding-inline: .45rem; }
	.map-panel header { flex-wrap: wrap; }
	.map-panel header small { max-width: calc(100vw - 4rem); }
	.map-tools { margin-left: auto; }
}
@media (prefers-reduced-motion: reduce) {
	*, .branch-toggle :global(.inline-icon) { transition-duration: .01ms !important; }
}
</style>
