type ClientChangelogLink = { t: number; p: string[] };
type ChangelogPageWindow = Window & {
	__jingyueChangelogPageBound?: boolean;
	__jingyueChangelogPageCleanup?: () => void;
	__jingyueChangelogSwupBound?: boolean;
	__jingyueChangelogSwupWaiting?: boolean;
};

const changelogPageWindow = window as ChangelogPageWindow;

function initChangelogPage() {
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
	let hoverFrame = 0;
	let closing = false;
	let closeAnimation: Animation | null = null;

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
		if (hoverFrame) cancelAnimationFrame(hoverFrame);
		hoverFrame = 0;
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
	const edgePoint = (
		rect: DOMRect,
		targetRect: DOMRect,
		containerRect: DOMRect,
	) => {
		const center = {
			x: rect.left - containerRect.left + rect.width / 2,
			y: rect.top - containerRect.top + rect.height / 2,
		};
		const target = {
			x: targetRect.left - containerRect.left + targetRect.width / 2,
			y: targetRect.top - containerRect.top + targetRect.height / 2,
		};
		const dx = target.x - center.x;
		const dy = target.y - center.y;
		if (Math.abs(dx) * rect.height >= Math.abs(dy) * rect.width) {
			const x = center.x + (dx < 0 ? -rect.width / 2 : rect.width / 2);
			return {
				x,
				y: center.y + (dx === 0 ? 0 : (dy * (x - center.x)) / dx),
			};
		}
		const y = center.y + (dy < 0 ? -rect.height / 2 : rect.height / 2);
		return {
			x: center.x + (dy === 0 ? 0 : (dx * (y - center.y)) / dy),
			y,
		};
	};
	const drawRowArrows = (cards: HTMLElement[], columns: number) => {
		wires.querySelectorAll("[data-row-arrow]").forEach((node) => {
			node.remove();
		});
		const boardBox = board.getBoundingClientRect();
		wires.setAttribute(
			"viewBox",
			`0 0 ${Math.max(board.clientWidth, board.scrollWidth)} ${Math.max(board.clientHeight, board.scrollHeight)}`,
		);
		const rows = Math.ceil(cards.length / columns);
		for (let row = 0; row < rows - 1; row += 1) {
			const fromCard = cards[row * columns + columns - 1];
			const toCard = cards[(row + 1) * columns];
			if (!fromCard || !toCard) continue;
			const from = fromCard.getBoundingClientRect();
			const to = toCard.getBoundingClientRect();
			const fromY = from.top - boardBox.top + from.height / 2;
			const toY = to.top - boardBox.top + to.height / 2;
			const fromX =
				row % 2 === 0 ? from.right - boardBox.left : from.left - boardBox.left;
			const toX =
				row % 2 === 0 ? to.right - boardBox.left : to.left - boardBox.left;
			const outside =
				row % 2 === 0 ? Math.max(fromX, toX) + 15 : Math.min(fromX, toX) - 15;
			const path = makePath(
				`M ${fromX} ${fromY} H ${outside} V ${toY} H ${toX}`,
				"changelog-wire changelog-wire--row",
			);
			path.dataset.rowArrow = "true";
			wires.appendChild(path);
		}
	};
	const layout = () => {
		layoutFrame = 0;
		const cards = visibleCards();
		wires.querySelectorAll("[data-row-arrow]").forEach((node) => {
			node.remove();
		});
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
		clearHover();
		drawRowArrows(cards, columns);
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
		const path = makePath(d, "changelog-wire changelog-wire--hover");
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
			label.classList.add("is-in");
			return;
		}
		hoverFrame = requestAnimationFrame(() => {
			path.classList.add("is-drawn");
			label.classList.add("is-in");
			hoverFrame = 0;
		});
	};
	const showRelations = (card: HTMLElement) => {
		clearHover();
		activeCard = card;
		board.classList.add("is-hovering");
		card.classList.add("is-active");
		const links = readLinks(card);
		if (!links.length) return;
		const boardBox = board.getBoundingClientRect();
		const sourceRect = card.getBoundingClientRect();
		const sourceCenter = {
			x: sourceRect.left - boardBox.left + sourceRect.width / 2,
			y: sourceRect.top - boardBox.top + sourceRect.height / 2,
		};
		for (const link of links) {
			const target = getCard(link.t);
			if (!target || target.hidden) continue;
			target.classList.add("is-linked");
			const targetRect = target.getBoundingClientRect();
			const targetCenter = {
				x: targetRect.left - boardBox.left + targetRect.width / 2,
				y: targetRect.top - boardBox.top + targetRect.height / 2,
			};
			const dx = targetCenter.x - sourceCenter.x;
			const dy = targetCenter.y - sourceCenter.y;
			const length = Math.max(1, Math.hypot(dx, dy));
			const curve = Math.min(48, length * 0.1);
			const control = {
				x: (sourceCenter.x + targetCenter.x) / 2 - (dy / length) * curve,
				y: (sourceCenter.y + targetCenter.y) / 2 + (dx / length) * curve,
			};
			const start = edgePoint(sourceRect, targetRect, boardBox);
			const end = edgePoint(targetRect, sourceRect, boardBox);
			drawHoverWire(
				`M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
				{
					x: sourceCenter.x * 0.25 + control.x * 0.5 + targetCenter.x * 0.25,
					y: sourceCenter.y * 0.25 + control.y * 0.5 + targetCenter.y * 0.25,
				},
				link.p.join("、"),
			);
		}
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
		if (hoverFrame) cancelAnimationFrame(hoverFrame);
		clearHover();
		if (dialog.open) dialog.close();
	};
	scheduleLayout();
}

function bindChangelogSwup() {
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
