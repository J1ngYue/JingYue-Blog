<script lang="ts">
import { BookOpen, Star } from "lucide-svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import type { UserSubjectCollection } from "@/types/bangumi";

interface Props {
	item: UserSubjectCollection;
	loadImage?: boolean;
	priority?: boolean;
	subjectBaseUrl?: string;
	variant?: "book" | "poster";
}

const {
	item,
	loadImage = false,
	priority = false,
	subjectBaseUrl = "https://bangumi.one/subject/",
	variant = "poster",
}: Props = $props();

function getStatusText(type: number): string {
	const subjectType = item.subject?.type;
	switch (type) {
		case 1:
			if (subjectType === 1) return i18n(I18nKey.bangumiStatusBookWish);
			if (subjectType === 3) return i18n(I18nKey.bangumiStatusMusicWish);
			if (subjectType === 4) return i18n(I18nKey.bangumiStatusGameWish);
			return i18n(I18nKey.bangumiStatusWish);
		case 2:
			if (subjectType === 1) return i18n(I18nKey.bangumiStatusBookRead);
			if (subjectType === 3) return i18n(I18nKey.bangumiStatusMusicListened);
			if (subjectType === 4) return i18n(I18nKey.bangumiStatusGamePlayed);
			return i18n(I18nKey.bangumiStatusWatched);
		case 3:
			if (subjectType === 1) return i18n(I18nKey.bangumiStatusBookReading);
			if (subjectType === 3) return i18n(I18nKey.bangumiStatusMusicListening);
			if (subjectType === 4) return i18n(I18nKey.bangumiStatusGamePlaying);
			return i18n(I18nKey.bangumiStatusWatching);
		case 4:
			return i18n(I18nKey.bangumiStatusOnHold);
		case 5:
			return i18n(I18nKey.bangumiStatusDropped);
		default:
			return i18n(I18nKey.bangumiStatusUnknown);
	}
}

const images = $derived(item.subject?.images);
const coverFallbacks = $derived(
	images
		? [images.medium, images.common, images.small, images.large].filter(Boolean)
		: [],
);
const title = $derived(
	item.subject?.name_cn || item.subject?.name || "未命名作品",
);
const year = $derived(
	item.subject?.date ? item.subject.date.substring(0, 4) : "",
);
const score = $derived(item.subject?.score || 0);

function handleLoad(event: Event) {
	const image = event.currentTarget as HTMLImageElement;
	image.dataset.loaded = "true";
}

function handleError(event: Event) {
	const image = event.currentTarget as HTMLImageElement;
	const index = Number(image.dataset.fallbackIndex || "0");
	if (index < coverFallbacks.length - 1) {
		image.dataset.fallbackIndex = String(index + 1);
		image.src = coverFallbacks[index + 1];
		return;
	}
	image.hidden = true;
}
</script>

<a
	href="{subjectBaseUrl}{item.subject?.id}"
	target="_blank"
	rel="noopener noreferrer nofollow"
	class="bangumi-card"
	class:is-book={variant === "book"}
	data-status={item.type}
>
	<div class="bangumi-card__cover">
		{#if coverFallbacks.length > 0}
			<div class="bangumi-card__placeholder" aria-hidden="true"></div>
			<img
				src={loadImage ? coverFallbacks[0] : undefined}
				data-src={loadImage ? undefined : coverFallbacks[0]}
				data-fallback-index="0"
				alt={title}
				loading={priority ? "eager" : "lazy"}
				fetchpriority={priority ? "high" : "auto"}
				decoding="async"
				onload={handleLoad}
				onerror={handleError}
			/>
		{:else}
			<div class="bangumi-card__missing">
				<BookOpen size={26} strokeWidth={1.6} />
				<span>暂无封面</span>
			</div>
		{/if}

		<span class="bangumi-card__status">{getStatusText(item.type)}</span>
		{#if score}
			<span class="bangumi-card__score"><Star size={12} fill="currentColor" />{score}</span>
		{/if}

		{#if variant === "poster"}
			<div class="bangumi-card__overlay">
				<h3>{title}</h3>
				{#if year}<small>{year}</small>{/if}
			</div>
		{/if}
	</div>

	{#if variant === "book"}
		<h3 class="bangumi-card__book-title" title={title}>{title}</h3>
	{/if}
</a>

<style>
	.bangumi-card {
		display: block;
		min-width: 0;
		color: inherit;
		text-decoration: none;
		transition: transform 180ms ease;
	}

	.bangumi-card:hover,
	.bangumi-card:focus-visible {
		outline: none;
		transform: translateY(-0.2rem);
	}

	.bangumi-card:focus-visible .bangumi-card__cover {
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 38%, transparent);
	}

	.bangumi-card__cover {
		position: relative;
		aspect-ratio: 2 / 3;
		overflow: hidden;
		border-radius: 0.3rem;
		background: var(--btn-regular-bg);
		box-shadow: 0 0.25rem 0.75rem rgb(0 0 0 / 10%);
	}

	.bangumi-card__placeholder,
	.bangumi-card__cover img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.bangumi-card__placeholder {
		background: var(--btn-regular-bg);
	}

	.bangumi-card__cover img {
		z-index: 1;
		object-fit: cover;
		opacity: 1;
		transition: transform 260ms ease;
	}

	.bangumi-card:hover .bangumi-card__cover img {
		transform: scale(1.035);
	}

	.bangumi-card__missing {
		position: absolute;
		inset: 0;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 0.45rem;
		color: var(--content-meta);
		font-size: 0.68rem;
	}

	.bangumi-card__status,
	.bangumi-card__score {
		position: absolute;
		z-index: 3;
		top: 0.5rem;
		display: inline-flex;
		min-height: 1.55rem;
		align-items: center;
		border-radius: 999px;
		padding: 0.18rem 0.55rem;
		color: white;
		font-size: 0.66rem;
		font-weight: 750;
		box-shadow: 0 0.15rem 0.45rem rgb(0 0 0 / 16%);
	}

	.bangumi-card__status {
		left: 0.5rem;
		background: #24ba87;
	}

	.bangumi-card[data-status="1"] .bangumi-card__status {
		background: #27a8d8;
	}

	.bangumi-card[data-status="3"] .bangumi-card__status {
		background: #f3a90f;
	}

	.bangumi-card[data-status="4"] .bangumi-card__status {
		background: #8b6be8;
	}

	.bangumi-card[data-status="5"] .bangumi-card__status {
		background: #ef5d68;
	}

	.bangumi-card__score {
		right: 0.5rem;
		gap: 0.18rem;
		background: rgb(18 18 18 / 68%);
		backdrop-filter: blur(0.35rem);
	}

	.bangumi-card__score :global(svg) {
		color: #ffd13b;
	}

	.bangumi-card__overlay {
		position: absolute;
		z-index: 2;
		inset: auto 0 0;
		padding: 2.8rem 0.65rem 0.65rem;
		background: linear-gradient(to top, rgb(0 0 0 / 80%), transparent);
		color: white;
	}

	.bangumi-card__overlay h3 {
		display: -webkit-box;
		overflow: hidden;
		margin: 0;
		font-size: 0.78rem;
		font-weight: 700;
		line-height: 1.35;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}

	.bangumi-card__overlay small {
		display: block;
		margin-top: 0.15rem;
		color: rgb(255 255 255 / 66%);
		font-size: 0.62rem;
	}

	.bangumi-card__book-title {
		overflow: hidden;
		margin: 0.45rem 0 0;
		color: var(--record-ink, var(--deep-text));
		font-size: 0.72rem;
		font-weight: 560;
		line-height: 1.35;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (prefers-reduced-motion: reduce) {
		.bangumi-card,
		.bangumi-card__cover img {
			transition: none;
		}
	}
</style>
