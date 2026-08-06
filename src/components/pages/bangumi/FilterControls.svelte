<script lang="ts">
interface Filter {
	value: string;
	label: string;
	count?: number;
}

interface Props {
	filters: Filter[];
	activeFilter: string;
	onFilterChange: (filter: string) => void;
}

const { filters, activeFilter, onFilterChange }: Props = $props();
</script>

<nav class="bangumi-filters" aria-label="收藏状态">
	{#each filters as filter}
		<button
			class:is-active={filter.value === activeFilter}
			onclick={() => onFilterChange(filter.value)}
			type="button"
			aria-pressed={filter.value === activeFilter}
		>
			<span>{filter.label}</span>
			{#if filter.count !== undefined}<small>{filter.count}</small>{/if}
		</button>
	{/each}
</nav>

<style>
	.bangumi-filters {
		display: flex;
		min-height: 3.2rem;
		align-items: center;
		gap: 0.3rem;
		overflow-x: auto;
		margin: 0 0 1.25rem;
		border: 2px solid var(--record-ink, #111);
		border-radius: 1.1rem;
		padding: 0.32rem;
		scrollbar-width: none;
	}

	.bangumi-filters::-webkit-scrollbar {
		display: none;
	}

	button {
		display: inline-flex;
		min-height: 2.35rem;
		flex: 0 0 auto;
		align-items: center;
		gap: 0.42rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		padding: 0.35rem 0.9rem;
		color: var(--record-ink, var(--deep-text));
		font: inherit;
		font-size: 0.82rem;
		font-weight: 620;
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
