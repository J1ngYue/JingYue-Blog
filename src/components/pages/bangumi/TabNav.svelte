<script lang="ts">
interface Tab {
	id: string;
	name: string;
	count?: number;
}

interface Props {
	tabs: Tab[];
	activeTab: string;
	onTabChange: (tabId: string) => void;
}

const { tabs, activeTab, onTabChange }: Props = $props();

function handleHashChange() {
	const hash = window.location.hash.replace(/^#/, "");
	if (!hash) return;
	try {
		const decoded = decodeURIComponent(hash);
		if (tabs.some((tab) => tab.id === decoded)) onTabChange(decoded);
	} catch {}
}

$effect(() => {
	window.addEventListener("hashchange", handleHashChange);
	return () => window.removeEventListener("hashchange", handleHashChange);
});

function clickTab(tabId: string) {
	onTabChange(tabId);
	const nextHash = `#${encodeURIComponent(tabId)}`;
	if (window.location.hash !== nextHash) {
		window.history.replaceState(null, "", nextHash);
	}
}
</script>

<nav class="bangumi-tabs" aria-label="作品分类">
	{#each tabs as tab}
		<button
			class:is-active={tab.id === activeTab}
			onclick={() => clickTab(tab.id)}
			type="button"
			aria-pressed={tab.id === activeTab}
		>
			<span>{tab.name}</span>
			{#if tab.count !== undefined}<small>{tab.count}</small>{/if}
		</button>
	{/each}
</nav>

<style>
	.bangumi-tabs {
		display: flex;
		min-height: 3.2rem;
		align-items: center;
		gap: 0.35rem;
		overflow-x: auto;
		margin: 0 0 1.35rem;
		border: 2px solid var(--record-ink, #111);
		border-radius: 1.1rem;
		padding: 0.32rem;
		scrollbar-width: none;
	}

	.bangumi-tabs::-webkit-scrollbar {
		display: none;
	}

	button {
		display: inline-flex;
		min-height: 2.35rem;
		flex: 0 0 auto;
		align-items: center;
		gap: 0.45rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		padding: 0.35rem 0.9rem;
		color: var(--record-ink, var(--deep-text));
		font: inherit;
		font-size: 0.84rem;
		font-weight: 650;
		cursor: pointer;
		transition: background-color 160ms ease, color 160ms ease;
	}

	button:hover,
	button:focus-visible {
		background: color-mix(in srgb, var(--record-ink, #111) 8%, transparent);
		outline: none;
	}

	button:focus-visible {
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 22%, transparent);
	}

	button.is-active {
		background: var(--record-ink, #111);
		color: var(--card-bg, #fff);
	}

	small {
		display: grid;
		min-width: 1.35rem;
		height: 1.35rem;
		place-items: center;
		border-radius: 999px;
		background: color-mix(in srgb, currentColor 12%, transparent);
		font-size: 0.66rem;
		font-weight: 750;
	}
</style>
