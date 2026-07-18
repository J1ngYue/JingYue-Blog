<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import { DARK_MODE, LIGHT_MODE, SYSTEM_MODE } from "@/constants/constants";
import type { LIGHT_DARK_MODE } from "@/types/config.ts";
import {
	applyThemeToDocument,
	getStoredTheme,
	setTheme,
} from "@/utils/setting-utils";

// Define Swup type for window object
interface SwupHooks {
	on(event: string, callback: () => void): void;
}

interface SwupInstance {
	hooks?: SwupHooks;
}

type WindowWithSwup = Window & { swup?: SwupInstance };

let mode: LIGHT_DARK_MODE = $state(LIGHT_MODE);
let displayedMode: LIGHT_DARK_MODE = $state(LIGHT_MODE); // 显示的实际主题（在system模式下会随系统变化）

function switchScheme(newMode: LIGHT_DARK_MODE) {
	mode = newMode;
	setTheme(newMode);
	updateDisplayedMode();
}

// 更新显示的主题（用于显示当前实际主题）
function updateDisplayedMode() {
	if (mode === SYSTEM_MODE) {
		// 如果是system模式，显示实际的系统主题
		const isSystemDark = window.matchMedia(
			"(prefers-color-scheme: dark)",
		).matches;
		displayedMode = isSystemDark ? DARK_MODE : LIGHT_MODE;
	} else {
		displayedMode = mode;
	}
}

// 使用onMount确保在组件挂载后正确初始化
onMount(() => {
	// 立即获取并设置正确的主题
	const storedTheme = getStoredTheme();
	mode = storedTheme;
	updateDisplayedMode();

	// 确保DOM状态与存储的主题一致（只对非system模式检查）
	if (storedTheme !== SYSTEM_MODE) {
		const currentTheme = document.documentElement.classList.contains("dark")
			? DARK_MODE
			: LIGHT_MODE;
		if (storedTheme !== currentTheme) {
			applyThemeToDocument(storedTheme);
		}
	}

	// 如果是system模式，监听系统主题变化
	const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
	const handleSystemChange = () => {
		if (mode === SYSTEM_MODE) updateDisplayedMode();
	};
	mediaQuery.addEventListener("change", handleSystemChange);

	// 添加Swup监听
	const handleContentReplace = () => {
		const newTheme = getStoredTheme();
		mode = newTheme;
		updateDisplayedMode();
	};

	// 检查Swup是否已经加载
	const win = window as WindowWithSwup;
	if (win.swup?.hooks) {
		win.swup.hooks.on("content:replace", handleContentReplace);
	} else {
		document.addEventListener("swup:enable", () => {
			const w = window as WindowWithSwup;
			if (w.swup?.hooks) {
				w.swup.hooks.on("content:replace", handleContentReplace);
			}
		});
	}

	// 监听主题变化事件
	const handleThemeChange = () => {
		// 只有当mode不是system模式时才更新mode
		// system模式下，mode应该保持为SYSTEM_MODE，displayedMode会自动更新
		if (mode !== SYSTEM_MODE) {
			const newTheme = getStoredTheme();
			mode = newTheme;
			updateDisplayedMode();
		} else {
			// system模式下只需要更新displayedMode
			updateDisplayedMode();
		}
	};

	window.addEventListener("theme-change", handleThemeChange);

	// 清理函数
	return () => {
		mediaQuery.removeEventListener("change", handleSystemChange);
		window.removeEventListener("theme-change", handleThemeChange);
	};
});
</script>

<div
	id="scheme-switch"
	class="theme-segmented"
	role="group"
	aria-label="颜色模式"
>
	<button
		type="button"
		class:active={displayedMode === LIGHT_MODE}
		aria-label="切换为浅色模式"
		aria-pressed={displayedMode === LIGHT_MODE}
		title="浅色模式"
		onclick={() => switchScheme(LIGHT_MODE)}
	>
		<Icon icon="material-symbols:wb-sunny-outline-rounded" class="text-[1.2rem]"></Icon>
	</button>
	<button
		type="button"
		class:active={displayedMode === DARK_MODE}
		aria-label="切换为深色模式"
		aria-pressed={displayedMode === DARK_MODE}
		title="深色模式"
		onclick={() => switchScheme(DARK_MODE)}
	>
		<Icon icon="material-symbols:dark-mode-outline-rounded" class="text-[1.2rem]"></Icon>
	</button>
</div>

<style>
	.theme-segmented {
		display: inline-flex;
		align-self: center;
		align-items: center;
		gap: 0.125rem;
		margin-inline: 0.125rem;
		padding: 0.18rem;
		border: 1px solid color-mix(in oklch, var(--primary) 18%, transparent);
		border-radius: 999px;
		background: color-mix(in oklch, var(--card-bg) 72%, transparent);
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 32%);
		backdrop-filter: blur(0.65rem);
	}

	.theme-segmented button {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: transparent;
		color: var(--btn-content);
		cursor: pointer;
		opacity: 0.58;
		transition: background-color 180ms ease, color 180ms ease, opacity 180ms ease, box-shadow 180ms ease;
	}

	.theme-segmented button:hover,
	.theme-segmented button:focus-visible {
		opacity: 1;
		outline: none;
		background: color-mix(in oklch, var(--primary) 10%, transparent);
	}

	.theme-segmented button:focus-visible {
		box-shadow: 0 0 0 2px color-mix(in oklch, var(--primary) 42%, transparent);
	}

	.theme-segmented button.active {
		background: var(--primary);
		color: white;
		opacity: 1;
		box-shadow: 0 0.25rem 0.75rem color-mix(in oklch, var(--primary) 28%, transparent);
	}

	@media (max-width: 767px) {
		.theme-segmented button {
			width: 1.8rem;
			height: 1.8rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.theme-segmented button {
			transition: none;
		}
	}
</style>
