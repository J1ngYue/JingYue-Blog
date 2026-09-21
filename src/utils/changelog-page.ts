type ClientChangelogLink = { t: number; p: string[] };
type ChangelogPageWindow = Window & {
	__jingyueChangelogPageBound?: boolean;
	__jingyueChangelogPageCleanup?: () => void;
	__jingyueChangelogSwupBound?: boolean;
	__jingyueChangelogSwupWaiting?: boolean;
};

const changelogPageWindow = window as ChangelogPageWindow;

function initChangelogPage(): void {
	changelogPageWindow.__jingyueChangelogPageCleanup?.();

	const page = document.querySelector<HTMLElement>("[data-changelog-page]");
	const board = page?.querySelector<HTMLElement>("[data-changelog]");
	const grid = page?.querySelector<HTMLOListElement>("[data-changelog-grid]");
	const wires = page?.querySelector<SVGSVGElement>("[data-changelog-wires]");
	const filters = page?.querySelector<HTMLElement>(".changelog-filter");
	const dialog = page?.querySelector<HTMLDialogElement>(
		"[data-changelog-dialog]",
	);
	if (!page || !board || !grid || !wires || !filters || !dialog) return;

	const controller = new AbortController();
	const { signal } = controller;
	const reducedMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	const numberEl = dialog.querySelector<HTMLElement>("[data-dialog-number]");
	const typeEl = dialog.querySelector<HTMLElement>("[data-dialog-type]");
	const dateEl = dialog.querySelector<HTMLElement>("[data-dialog-date]");
	const titleEl = dialog.querySelector<HTMLElement>("[data-dialog-title]");
	const summaryEl = dialog.querySelector<HTMLElement>("[data-dialog-summary]");
	const versionEl = dialog.querySelector<HTMLElement>("[data-dialog-version]");
	const changesEl = dialog.querySelector<HTMLUListElement>(
		"[data-dialog-changes]",
	);
	const typePillEl = dialog.querySelector<HTMLElement>(
		"[data-dialog-type-pill]",
	);
	const relatedEl = dialog.querySelector<HTMLElement>("[data-dialog-related]");
	let activeCard: HTMLElement | null = null;
	let restoreFocus: HTMLElement | null = null;
	let layoutFrame = 0;
	let closing = false;
	let closeAnimation: Animation | null = null;
	const wireAnimations = new Set<() => void>();

	const allCards = () =>
		Array.from(grid.querySelectorAll<HTMLElement>("[data-changelog-card]"));
	const visibleCards = () => allCards().filter((card) => !card.hidden);
	const getCard = (index: number) =>
		grid.querySelector<HTMLElement>(
			`[data-changelog-card][data-index="${index}"]`,
		);
	const parseList = <T>(value: string | undefined): T[] => {
		try {
			const parsed = JSON.parse(value ?? "[]");
			return Array.isArray(parsed) ? (parsed as T[]) : [];
		} catch {
			return [];
		}
	};
	const readLinks = (card: HTMLElement) =>
		parseList<ClientChangelogLink>(card.dataset.links);
	const makePath = (d: string, className: string, marker = true) => {
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("d", d);
		path.setAttribute("class", className);
		if (marker) path.setAttribute("marker-end", "url(#changelog-arrow)");
		return path;
	};
	const clearHover = () => {
		for (const cancel of wireAnimations) cancel();
		wireAnimations.clear();
		board.querySelectorAll("[data-hover-wire]").forEach((node) => {
			node.remove();
		});
		board
			.querySelectorAll(".changelog-card.is-active, .changelog-card.is-linked")
			.forEach((node) => {
				node.classList.remove("is-active", "is-linked");
			});
		board.classList.remove("is-hovering");
		activeCard = null;
	};
	const cardCenter = (
		card: HTMLElement,
		boardBox = board.getBoundingClientRect(),
	) => {
		const rect = card.getBoundingClientRect();
		return {
			x: rect.left - boardBox.left + rect.width / 2,
			y: rect.top - boardBox.top + rect.height / 2,
		};
	};
	const sizeWires = () => {
		wires.setAttribute(
			"viewBox",
			`0 0 ${Math.max(board.clientWidth, board.scrollWidth)} ${Math.max(board.clientHeight, board.scrollHeight)}`,
		);
	};
	const drawRowArrows = (cards: HTMLElement[], columns: number) => {
		sizeWires();
		wires.querySelectorAll("[data-row-wire]").forEach((node) => {
			node.remove();
		});
		const rows = Math.ceil(cards.length / columns);
		const boardBox = board.getBoundingClientRect();
		for (let row = 0; row < rows - 1; row += 1) {
			const fromCard = cards[row * columns + columns - 1];
			const toCard = cards[(row + 1) * columns];
			if (!fromCard || !toCard) continue;
			const fromRect = fromCard.getBoundingClientRect();
			const toRect = toCard.getBoundingClientRect();
			const fromY = fromRect.top - boardBox.top + fromRect.height / 2;
			const toY = toRect.top - boardBox.top + toRect.height / 2;
			let pathData: string;
			if (row % 2 === 0) {
				const fromX = fromRect.right - boardBox.left;
				const toX = toRect.right - boardBox.left;
				const outsideX = Math.max(fromX, toX) + 16;
				pathData = `M ${toX} ${toY} H ${outsideX} V ${fromY} H ${fromX}`;
			} else {
				const fromX = fromRect.left - boardBox.left;
				const toX = toRect.left - boardBox.left;
				const outsideX = Math.min(fromX, toX) - 16;
				pathData = `M ${toX} ${toY} H ${outsideX} V ${fromY} H ${fromX}`;
			}
			const path = makePath(pathData, "changelog-wire changelog-wire--row");
			path.dataset.rowWire = "true";
			wires.appendChild(path);
		}
	};
	const layout = () => {
		layoutFrame = 0;
		const cards = visibleCards();
		if (!cards.length || !page.isConnected) return;
		const columns = Math.max(
			1,
			getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length,
		);
		cards.forEach((card, index) => {
			const row = Math.floor(index / columns);
			const column = index % columns;
			const visualColumn = row % 2 === 0 ? column : columns - 1 - column;
			card.style.order = String(row * columns + visualColumn);
		});
		drawRowArrows(cards, columns);
		clearHover();
	};
	const scheduleLayout = () => {
		if (layoutFrame) cancelAnimationFrame(layoutFrame);
		layoutFrame = requestAnimationFrame(layout);
	};
	const drawHoverWire = (
		d: string,
		midpoint: { x: number; y: number },
		labelText: string,
	) => {
		const path = makePath(d, "changelog-wire changelog-wire--hover", false);
		path.dataset.hoverWire = "true";
		wires.appendChild(path);
		const label = document.createElement("span");
		label.className = "changelog-wire-label";
		label.dataset.hoverWire = "true";
		label.textContent = labelText;
		label.style.left = `${midpoint.x}px`;
		label.style.top = `${midpoint.y}px`;
		board.appendChild(label);
		if (reducedMotion) {
			path.classList.add("is-drawn");
			path.setAttribute("marker-end", "url(#changelog-arrow)");
			label.classList.add("is-in");
			return;
		}

		const length = path.getTotalLength();
		const duration = Math.min(750, Math.max(350, (length / 700) * 1000));
		const dash = 7;
		const gap = 6;
		const revealDash = (drawn: number) => {
			const segments: number[] = [];
			let used = 0;
			let isDash = true;
			while (used < drawn) {
				const segment = Math.min(isDash ? dash : gap, drawn - used);
				segments.push(segment);
				used += segment;
				isDash = !isDash;
			}
			if (!segments.length) segments.push(0);
			if (segments.length % 2 === 0) segments.push(0);
			segments.push(length + dash + gap);
			path.style.strokeDasharray = segments.join(" ");
		};

		const arrow = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"polygon",
		);
		arrow.setAttribute("points", "-9,-5 0,0 -9,5 -6,0");
		arrow.setAttribute("class", "changelog-wire-arrow");
		arrow.dataset.hoverWire = "true";
		wires.appendChild(arrow);

		const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;
		const startedAt = performance.now();
		let frame = 0;
		const cancel = () => {
			cancelAnimationFrame(frame);
			arrow.remove();
		};
		wireAnimations.add(cancel);
		const tick = (now: number) => {
			const progress = Math.min(1, (now - startedAt) / duration);
			const drawn = length * easeOutCubic(progress);
			revealDash(drawn);
			const tip = path.getPointAtLength(drawn);
			const behind = path.getPointAtLength(Math.max(0, drawn - 1));
			const ahead = path.getPointAtLength(Math.min(length, drawn + 1));
			const angle =
				(Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180) / Math.PI;
			arrow.setAttribute(
				"transform",
				`translate(${tip.x} ${tip.y}) rotate(${angle})`,
			);
			if (progress < 1) {
				frame = requestAnimationFrame(tick);
				return;
			}
			wireAnimations.delete(cancel);
			path.style.strokeDasharray = "";
			path.classList.add("is-drawn");
			path.setAttribute("marker-end", "url(#changelog-arrow)");
			arrow.remove();
			label.classList.add("is-in");
		};
		frame = requestAnimationFrame(tick);
	};
	const getHoverLinks = (card: HTMLElement): ClientChangelogLink[] => {
		const sourceIndex = Number(card.dataset.index);
		const sourceType = card.dataset.logType;
		const sourceLabel = card.dataset.logTypeLabel ?? "相关更新";
		if (!Number.isFinite(sourceIndex) || !sourceType) return readLinks(card);

		const sameType = visibleCards()
			.filter(
				(candidate) =>
					candidate !== card && candidate.dataset.logType === sourceType,
			)
			.map((candidate) => Number(candidate.dataset.index))
			.filter(Number.isFinite)
			.sort(
				(first, second) =>
					Math.abs(first - sourceIndex) - Math.abs(second - sourceIndex),
			)
			.slice(0, 3)
			.map((targetIndex) => ({ t: targetIndex, p: [sourceLabel] }));

		return sameType.length ? sameType : readLinks(card);
	};
	const showRelations = (card: HTMLElement) => {
		clearHover();
		activeCard = card;
		board.classList.add("is-hovering");
		card.classList.add("is-active");
		const links = getHoverLinks(card);
		if (!links.length) return;
		sizeWires();
		const boardBox = board.getBoundingClientRect();
		const sourceIndex = Number(card.dataset.index);
		const sourceCenter = cardCenter(card, boardBox);
		links.forEach((link) => {
			const target = getCard(link.t);
			if (!target || target.hidden) return;
			target.classList.add("is-linked");
			const targetCenter = cardCenter(target, boardBox);
			const dx = targetCenter.x - sourceCenter.x;
			const dy = targetCenter.y - sourceCenter.y;
			const length = Math.max(1, Math.hypot(dx, dy));
			const curve = Math.min(72, Math.max(18, length * 0.12));
			const control = {
				x: (sourceCenter.x + targetCenter.x) / 2 - (dy / length) * curve,
				y: (sourceCenter.y + targetCenter.y) / 2 + (dx / length) * curve,
			};
			const targetIsNewer = link.t < sourceIndex;
			const start = targetIsNewer ? sourceCenter : targetCenter;
			const end = targetIsNewer ? targetCenter : sourceCenter;
			drawHoverWire(
				`M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
				{
					x: start.x * 0.25 + control.x * 0.5 + end.x * 0.25,
					y: start.y * 0.25 + control.y * 0.5 + end.y * 0.25,
				},
				link.p.join("、"),
			);
		});
	};

	const fillDialog = (index: number) => {
		const card = getCard(index);
		if (!card) return;
		const cards = allCards();
		if (numberEl) {
			numberEl.textContent = `#${String(cards.length - index).padStart(2, "0")}`;
		}
		if (typeEl) typeEl.textContent = card.dataset.logTypeLabel ?? "";
		if (dateEl) {
			dateEl.textContent = card.dataset.logDate ?? "";
			dateEl.setAttribute(
				"datetime",
				`${card.dataset.logDate ?? ""}T${card.dataset.logTime ?? "00:00"}`,
			);
		}
		if (titleEl) titleEl.textContent = card.dataset.logTitle ?? "";
		if (summaryEl) summaryEl.textContent = card.dataset.logSummary ?? "";
		if (versionEl) versionEl.textContent = card.dataset.logVersion ?? "";
		if (typePillEl) typePillEl.textContent = card.dataset.logTypeLabel ?? "";
		if (changesEl) {
			changesEl.replaceChildren();
			for (const change of parseList<string>(card.dataset.logChanges)) {
				const item = document.createElement("li");
				item.textContent = change;
				changesEl.appendChild(item);
			}
		}
		if (relatedEl) {
			relatedEl.replaceChildren();
			for (const link of readLinks(card)) {
				const relatedCard = getCard(link.t);
				if (!relatedCard) continue;
				const button = document.createElement("button");
				button.type = "button";
				button.className = "changelog-dialog__related-item";
				button.dataset.dialogRelatedIndex = String(link.t);
				const relationTitle = document.createElement("strong");
				relationTitle.textContent = `#${String(cards.length - link.t).padStart(2, "0")} ${relatedCard.dataset.logTitle ?? ""}`;
				const relationType = document.createElement("span");
				relationType.textContent = link.p.join("、");
				button.append(relationTitle, relationType);
				relatedEl.appendChild(button);
			}
			if (!relatedEl.childElementCount) {
				const empty = document.createElement("span");
				empty.className = "changelog-dialog__empty";
				empty.textContent = "暂无关联更新";
				relatedEl.appendChild(empty);
			}
		}
	};
	const openDialog = (index: number, trigger?: HTMLElement) => {
		fillDialog(index);
		if (!dialog.open) {
			closeAnimation?.cancel();
			closeAnimation = null;
			restoreFocus =
				trigger ??
				(document.activeElement instanceof HTMLElement
					? document.activeElement
					: null);
			dialog.showModal();
		}
	};
	const finishClose = () => {
		if (dialog.open) dialog.close();
		closeAnimation?.cancel();
		closeAnimation = null;
		dialog.classList.remove("is-closing");
		closing = false;
	};
	const closeDialog = () => {
		if (!dialog.open || closing) return;
		if (reducedMotion) {
			finishClose();
			return;
		}
		closing = true;
		dialog.classList.add("is-closing");
		closeAnimation = dialog.animate(
			[
				{ opacity: 1, transform: "translateY(0) scale(1)" },
				{ opacity: 0, transform: "translateY(6px) scale(.97)" },
			],
			{
				duration: 170,
				easing: "cubic-bezier(0.4, 0, 1, 1)",
				fill: "forwards",
			},
		);
		closeAnimation.finished.then(finishClose, finishClose);
	};

	grid.addEventListener(
		"pointerover",
		(event) => {
			if (!(event.target instanceof Element)) return;
			const card = event.target.closest<HTMLElement>("[data-changelog-card]");
			if (card && card !== activeCard) showRelations(card);
		},
		{ signal },
	);
	grid.addEventListener("pointerleave", () => clearHover(), { signal });
	grid.addEventListener(
		"focusin",
		(event) => {
			if (!(event.target instanceof Element)) return;
			const card = event.target.closest<HTMLElement>("[data-changelog-card]");
			if (card) showRelations(card);
		},
		{ signal },
	);
	grid.addEventListener(
		"focusout",
		(event) => {
			if (
				!(event.relatedTarget instanceof Node) ||
				!grid.contains(event.relatedTarget)
			) {
				clearHover();
			}
		},
		{ signal },
	);
	grid.addEventListener(
		"click",
		(event) => {
			if (!(event.target instanceof Element)) return;
			const trigger = event.target.closest<HTMLElement>("[data-log-toggle]");
			const card = trigger?.closest<HTMLElement>("[data-changelog-card]");
			if (!trigger || !card) return;
			openDialog(Number(card.dataset.index), trigger);
		},
		{ signal },
	);
	filters.addEventListener(
		"click",
		(event) => {
			if (!(event.target instanceof Element)) return;
			const button =
				event.target.closest<HTMLButtonElement>("[data-log-filter]");
			if (!button || !filters.contains(button)) return;
			const filter = button.dataset.logFilter ?? "all";
			filters
				.querySelectorAll<HTMLButtonElement>("[data-log-filter]")
				.forEach((item) => {
					const selected = item === button;
					item.classList.toggle("is-active", selected);
					item.setAttribute("aria-pressed", String(selected));
				});
			allCards().forEach((card) => {
				card.hidden = filter !== "all" && card.dataset.logType !== filter;
			});
			scheduleLayout();
		},
		{ signal },
	);
	dialog
		.querySelector("[data-changelog-dialog-close]")
		?.addEventListener("click", closeDialog, { signal });
	dialog.addEventListener(
		"click",
		(event) => {
			if (event.target === dialog) closeDialog();
		},
		{ signal },
	);
	dialog.addEventListener(
		"cancel",
		(event) => {
			event.preventDefault();
			closeDialog();
		},
		{ signal },
	);
	dialog.addEventListener(
		"close",
		() => {
			restoreFocus?.focus({ preventScroll: true });
			restoreFocus = null;
		},
		{ signal },
	);
	relatedEl?.addEventListener(
		"click",
		(event) => {
			if (!(event.target instanceof Element)) return;
			const button = event.target.closest<HTMLElement>(
				"[data-dialog-related-index]",
			);
			if (button) fillDialog(Number(button.dataset.dialogRelatedIndex));
		},
		{ signal },
	);

	const resizeObserver = new ResizeObserver(scheduleLayout);
	resizeObserver.observe(grid);
	window.addEventListener("resize", scheduleLayout, { signal });
	document.fonts?.ready.then(scheduleLayout);
	changelogPageWindow.__jingyueChangelogPageCleanup = () => {
		controller.abort();
		resizeObserver.disconnect();
		if (layoutFrame) cancelAnimationFrame(layoutFrame);
		clearHover();
		if (dialog.open) dialog.close();
	};
	scheduleLayout();
}

function bindChangelogSwup(): void {
	if (changelogPageWindow.__jingyueChangelogSwupBound || !window.swup?.hooks) {
		return;
	}
	changelogPageWindow.__jingyueChangelogSwupBound = true;
	window.swup.hooks.on("visit:start", () => {
		changelogPageWindow.__jingyueChangelogPageCleanup?.();
	});
	window.swup.hooks.on("page:view", initChangelogPage);
}

if (!changelogPageWindow.__jingyueChangelogPageBound) {
	changelogPageWindow.__jingyueChangelogPageBound = true;
	document.addEventListener("astro:page-load", initChangelogPage);
	document.addEventListener("astro:after-swap", initChangelogPage);
	document.addEventListener("swup:contentReplaced", initChangelogPage);
	document.addEventListener("swup:content:replaced", initChangelogPage);
	window.addEventListener("pageshow", initChangelogPage);
}
if (window.swup?.hooks) {
	bindChangelogSwup();
} else if (!changelogPageWindow.__jingyueChangelogSwupWaiting) {
	changelogPageWindow.__jingyueChangelogSwupWaiting = true;
	document.addEventListener(
		"swup:enable",
		() => {
			changelogPageWindow.__jingyueChangelogSwupWaiting = false;
			bindChangelogSwup();
		},
		{ once: true },
	);
}
initChangelogPage();
