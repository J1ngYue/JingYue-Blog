<script lang="ts">
import { onMount } from "svelte";
import {
	DARK_MODE_SPOTLIGHT_CHANGE_EVENT,
	getDarkModeSpotlightSettings,
	type DarkModeSpotlightSettings,
} from "@/utils/dark-mode-spotlight";

let settings = $state<DarkModeSpotlightSettings>(
	getDarkModeSpotlightSettings(),
);
let isDark = $state(false);
let tilt = $state(0);
let targetTilt = 0;
let tiltFrame = 0;

function animateTilt() {
	tiltFrame = 0;
	const delta = targetTilt - tilt;
	if (Math.abs(delta) < 0.04) {
		tilt = targetTilt;
		return;
	}
	tilt += delta * 0.12;
	tiltFrame = requestAnimationFrame(animateTilt);
}

function setTargetTilt(clientX: number) {
	const ratio = clientX / Math.max(1, window.innerWidth) - 0.5;
	const nextTilt = Math.max(-18, Math.min(18, ratio * 36));
	if (Math.abs(nextTilt - targetTilt) < 0.1) return;
	targetTilt = nextTilt;
	if (!tiltFrame) tiltFrame = requestAnimationFrame(animateTilt);
}

	onMount(() => {
		const syncTheme = () => {
			isDark = document.documentElement.classList.contains("dark");
		};
		const syncSettings = (event: Event) => {
			const next = (event as CustomEvent<DarkModeSpotlightSettings>).detail;
			if (!next || typeof next !== "object") return;
			settings = { ...settings, ...next };
		};
		const handlePointerMove = (event: PointerEvent) => {
			if (!isDark || event.pointerType === "touch") return;
			setTargetTilt(event.clientX);
		};
		const handleWindowBlur = () => {
			targetTilt = 0;
			if (!tiltFrame) tiltFrame = requestAnimationFrame(animateTilt);
		};
		const observer = new MutationObserver(syncTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		syncTheme();
		window.addEventListener(DARK_MODE_SPOTLIGHT_CHANGE_EVENT, syncSettings);
		window.addEventListener("pointermove", handlePointerMove, { passive: true });
		window.addEventListener("blur", handleWindowBlur);

		return () => {
			observer.disconnect();
			window.removeEventListener(
				DARK_MODE_SPOTLIGHT_CHANGE_EVENT,
				syncSettings,
			);
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("blur", handleWindowBlur);
			if (tiltFrame) cancelAnimationFrame(tiltFrame);
		};
	});
</script>

<div
	class="dark-mode-spotlight"
	class:is-disabled={!isDark || !settings.enabled}
	style={`--spotlight-color: ${settings.color}; --spotlight-width: ${12 + settings.angle * 0.18}rem; --spotlight-range: ${settings.range}; --spotlight-tilt: ${tilt}deg; --spotlight-offset: ${50 + tilt * 0.45}%; --spotlight-glow-offset: ${50 + tilt * 1.1}%;`}
	aria-hidden="true"
>
	<div class="dark-mode-spotlight__ambient"></div>
	<div class="dark-mode-spotlight__beam"></div>
	<div class="dark-mode-spotlight__lamp">
		<span class="dark-mode-spotlight__cable"></span>
		<span class="dark-mode-spotlight__mount"></span>
		<span class="dark-mode-spotlight__shade">
			<span class="dark-mode-spotlight__bulb"></span>
		</span>
	</div>
	<div class="dark-mode-spotlight__glow"></div>
</div>

<style>
	.dark-mode-spotlight {
		--spotlight-alpha: 0.38;
		position: fixed;
		inset: 0;
		z-index: 6;
		overflow: hidden;
		pointer-events: none;
		isolation: isolate;
		opacity: 1;
		transition: opacity 420ms ease;
	}

	.dark-mode-spotlight.is-disabled {
		opacity: 0;
	}

	.dark-mode-spotlight__beam,
	.dark-mode-spotlight__ambient,
	.dark-mode-spotlight__glow {
		position: absolute;
		pointer-events: none;
	}

	.dark-mode-spotlight__beam {
		top: clamp(4.2rem, 9vh, 7rem);
		left: var(--spotlight-offset);
		width: calc(var(--spotlight-width) + var(--spotlight-range) * 0.45vw);
		height: calc(30vh + var(--spotlight-range) * 0.66vh);
		transform: translateX(-50%) rotate(var(--spotlight-tilt));
		transform-origin: 50% 0;
		border-radius: 46% 46% 50% 50% / 8% 8% 48% 48%;
		background: radial-gradient(
			ellipse at 50% 0%,
			color-mix(in srgb, var(--spotlight-color) 38%, transparent) 0%,
			color-mix(in srgb, var(--spotlight-color) 16%, transparent) 26%,
			color-mix(in srgb, var(--spotlight-color) 6%, transparent) 48%,
			transparent 76%
		);
		filter: blur(1.65rem);
		mask-image: linear-gradient(180deg, transparent, #000 12%, #000 78%, transparent);
		mix-blend-mode: screen;
		opacity: var(--spotlight-alpha);
		transition:
			width 260ms ease,
			height 260ms ease,
			background 260ms ease;
	}

	.dark-mode-spotlight__ambient {
		inset: 0;
		background: radial-gradient(
			ellipse at var(--spotlight-glow-offset) 58%,
			color-mix(in srgb, var(--spotlight-color) 12%, transparent),
			transparent 48%
		);
		mix-blend-mode: screen;
		opacity: 0.38;
		transition: background 260ms ease;
	}

	.dark-mode-spotlight__lamp {
		position: absolute;
		top: 0.3rem;
		left: var(--spotlight-offset);
		width: 5.5rem;
		height: 7rem;
		transform: translateX(-50%) rotate(calc(var(--spotlight-tilt) * 0.38));
		transform-origin: 50% 0;
		filter: drop-shadow(0 0 1.15rem color-mix(in srgb, var(--spotlight-color) 52%, transparent));
		transition: transform 260ms ease, left 260ms ease;
	}

	.dark-mode-spotlight__cable {
		position: absolute;
		top: -0.3rem;
		left: 50%;
		width: 0.12rem;
		height: 3.9rem;
		transform: translateX(-50%);
		background: linear-gradient(180deg, #31343d, #0c0d12);
		box-shadow: 0 0 0.3rem rgb(0 0 0 / 65%);
	}

	.dark-mode-spotlight__mount {
		position: absolute;
		top: 0;
		left: 50%;
		width: 1rem;
		height: 0.42rem;
		transform: translateX(-50%);
		border-radius: 0.4rem 0.4rem 0.15rem 0.15rem;
		background: linear-gradient(90deg, #15171d, #8b8f9a 46%, #111218 100%);
		box-shadow: 0 0.1rem 0.38rem rgb(0 0 0 / 70%);
	}

	.dark-mode-spotlight__shade {
		position: absolute;
		top: 3.45rem;
		left: 50%;
		width: 4.8rem;
		height: 2.45rem;
		transform: translateX(-50%);
		border: 0.12rem solid #4b4f5b;
		border-top: 0;
		border-radius: 0 0 50% 50%;
		background: linear-gradient(145deg, #383b46, #0b0c11 62%);
		box-shadow:
			inset 0 0.2rem 0.35rem rgb(255 255 255 / 14%),
			0 0.45rem 0.8rem rgb(0 0 0 / 50%);
	}

	.dark-mode-spotlight__bulb {
		position: absolute;
		bottom: -0.28rem;
		left: 50%;
		width: 1.35rem;
		height: 0.65rem;
		transform: translateX(-50%);
		border-radius: 50%;
		background: var(--spotlight-color);
		box-shadow:
			0 0 0.4rem var(--spotlight-color),
			0 0 1.25rem color-mix(in srgb, var(--spotlight-color) 82%, transparent),
			0 0 2.5rem color-mix(in srgb, var(--spotlight-color) 45%, transparent);
	}

	.dark-mode-spotlight__glow {
		left: var(--spotlight-glow-offset);
		bottom: calc(7% + (100 - var(--spotlight-range)) * 0.08%);
		width: clamp(15rem, 34vw, 34rem);
		height: clamp(5rem, 13vw, 13rem);
		transform: translateX(-50%);
		border-radius: 50%;
		background: radial-gradient(
			ellipse,
			color-mix(in srgb, var(--spotlight-color) 28%, transparent),
			transparent 70%
		);
		filter: blur(1.5rem);
		mix-blend-mode: screen;
		opacity: 0.5;
		transition:
			left 260ms ease,
			bottom 260ms ease,
			background 260ms ease;
	}

	@media (max-width: 700px) {
		.dark-mode-spotlight__lamp {
			transform: translateX(-50%) scale(0.78)
				rotate(calc(var(--spotlight-tilt) * 0.38));
			transform-origin: 50% 0;
		}

		.dark-mode-spotlight__beam {
			top: 4.8rem;
			height: calc(32vh + var(--spotlight-range) * 0.62vh);
		}

		.dark-mode-spotlight__ambient {
			opacity: 0.42;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dark-mode-spotlight,
		.dark-mode-spotlight__beam,
		.dark-mode-spotlight__ambient,
		.dark-mode-spotlight__lamp,
		.dark-mode-spotlight__glow {
			transition: none;
		}
	}
</style>
