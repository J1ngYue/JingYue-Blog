interface DropdownElements {
	menu: HTMLElement;
	panel: HTMLElement;
	box: HTMLElement;
	arrow: HTMLElement;
	items: HTMLElement[];
	pages: Map<number, HTMLElement>;
}

const normalizePath = (pathname: string) => pathname.replace(/\/+$/, "") || "/";

function parseIndex(raw: string | undefined): number | null {
	if (raw === undefined) return null;
	const index = Number.parseInt(raw, 10);
	return Number.isInteger(index) ? index : null;
}

function getElements(): DropdownElements | null {
	const menu = document.querySelector<HTMLElement>("#navbar .navbar-main-menu");
	const panel = menu?.querySelector<HTMLElement>(
		"[data-navbar-dropdown-panel]",
	);
	const box = panel?.querySelector<HTMLElement>(".navbar-dropdown-box");
	const arrow = panel?.querySelector<HTMLElement>(".navbar-dropdown-arrow");
	if (!menu || !panel || !box || !arrow) return null;

	const items = Array.from(
		menu.querySelectorAll<HTMLElement>(":scope > [data-dropdown-index]"),
	);
	const pages = new Map<number, HTMLElement>();
	panel
		.querySelectorAll<HTMLElement>("[data-dropdown-page]")
		.forEach((page) => {
			const index = parseIndex(page.dataset.dropdownPage);
			if (index !== null) pages.set(index, page);
		});
	return { menu, panel, box, arrow, items, pages };
}

export function initNavbarDropdownPanel(): () => void {
	const elements = getElements();
	if (!elements) return () => {};

	const { menu, panel, box, arrow, items, pages } = elements;
	const controller = new AbortController();
	const { signal } = controller;
	let pinnedIndex: number | null = null;
	let activeIndex: number | null = null;

	const itemIndex = (item: HTMLElement) =>
		parseIndex(item.dataset.dropdownIndex);

	const syncTriggerStates = (index: number | null) => {
		items.forEach((item) => {
			const trigger = item.querySelector<HTMLElement>(
				":scope > [data-dropdown-trigger]",
			);
			const open = itemIndex(item) === index;
			item.classList.toggle("is-dropdown-open", open);
			trigger?.setAttribute("aria-expanded", String(open));
		});
	};

	const close = (clearPinned = true) => {
		if (clearPinned) pinnedIndex = null;
		activeIndex = null;
		panel.classList.remove("is-open");
		pages.forEach((page) => {
			page.classList.remove("is-active");
		});
		syncTriggerStates(null);
	};

	const position = (item: HTMLElement, page: HTMLElement, instant = false) => {
		const menuRect = menu.getBoundingClientRect();
		const itemRect = item.getBoundingClientRect();
		if (instant) panel.setAttribute("data-instant", "");
		panel.style.left = `${Math.round(itemRect.left - menuRect.left)}px`;
		arrow.style.left = `${Math.round(itemRect.width / 2 - 6)}px`;
		box.style.width = `${page.offsetWidth}px`;
		box.style.height = `${page.offsetHeight}px`;
		if (instant) {
			void panel.offsetWidth;
			panel.removeAttribute("data-instant");
		}
	};

	const open = (item: HTMLElement, index: number, pin = false) => {
		const page = pages.get(index);
		if (!page) {
			close(!pin);
			return;
		}
		if (pin) pinnedIndex = index;

		pages.forEach((candidate) => {
			candidate.classList.toggle("is-active", candidate === page);
		});
		const wasOpen = panel.classList.contains("is-open");
		activeIndex = index;
		position(item, page, !wasOpen);
		panel.classList.add("is-open");
		syncTriggerStates(index);
	};

	const syncActiveState = (pathname = window.location.pathname) => {
		const currentPath = normalizePath(pathname);
		const matchesPath = (targetPathname: string) => {
			const targetPath = normalizePath(targetPathname);
			return targetPath === "/"
				? currentPath === "/"
				: currentPath === targetPath ||
						currentPath.startsWith(`${targetPath}/`);
		};
		let activeItem: HTMLElement | null = null;

		items.forEach((item) => {
			const index = itemIndex(item);
			const links: HTMLAnchorElement[] = [];
			const directLink =
				item.querySelector<HTMLAnchorElement>(":scope > a[href]");
			if (directLink) links.push(directLink);
			if (index !== null) {
				pages
					.get(index)
					?.querySelectorAll<HTMLAnchorElement>("a[href]")
					.forEach((link) => {
						links.push(link);
					});
			}
			if (
				!activeItem &&
				links.some((link) => {
					const target = new URL(link.href, window.location.href);
					return (
						target.origin === window.location.origin &&
						matchesPath(target.pathname)
					);
				})
			) {
				activeItem = item;
			}
		});

		items.forEach((item) => {
			const trigger = item.querySelector<HTMLElement>(
				":scope > .navbar-menu-item",
			);
			const isActive = item === activeItem;
			item.classList.toggle("is-active", isActive);
			trigger?.classList.toggle("is-active", isActive);
			if (isActive) trigger?.setAttribute("aria-current", "page");
			else trigger?.removeAttribute("aria-current");
		});
	};

	items.forEach((item) => {
		item.addEventListener(
			"pointerenter",
			() => {
				if (pinnedIndex !== null) return;
				const index = itemIndex(item);
				if (index !== null && pages.has(index)) open(item, index);
				else close(false);
			},
			{ signal },
		);
	});

	menu.addEventListener(
		"pointerleave",
		() => {
			if (pinnedIndex === null) close(false);
		},
		{ signal },
	);

	menu.addEventListener(
		"click",
		(event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const trigger = target.closest<HTMLElement>("[data-dropdown-trigger]");
			if (!trigger) return;
			const item = trigger.closest<HTMLElement>("[data-dropdown-index]");
			const index = item ? itemIndex(item) : null;
			if (!item || index === null || !pages.has(index)) return;
			if (pinnedIndex === index) close();
			else open(item, index, true);
		},
		{ signal },
	);

	menu.addEventListener(
		"keydown",
		(event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const trigger = target.closest<HTMLElement>("[data-dropdown-trigger]");
			if (trigger) {
				const item = trigger.closest<HTMLElement>("[data-dropdown-index]");
				const index = item ? itemIndex(item) : null;
				if (!item || index === null || !pages.has(index)) return;
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					if (pinnedIndex === index) close();
					else open(item, index, true);
				} else if (event.key === "ArrowDown") {
					event.preventDefault();
					open(item, index, true);
					pages
						.get(index)
						?.querySelector<HTMLElement>(".dropdown-item")
						?.focus();
				}
				return;
			}

			const pageItem = target.closest<HTMLElement>(".dropdown-item");
			if (!pageItem || (event.key !== "ArrowDown" && event.key !== "ArrowUp"))
				return;
			const page = pageItem.closest<HTMLElement>("[data-dropdown-page]");
			const pageItems = Array.from(
				page?.querySelectorAll<HTMLElement>(".dropdown-item") ?? [],
			);
			const current = pageItems.indexOf(pageItem);
			if (current < 0 || pageItems.length === 0) return;
			event.preventDefault();
			const offset = event.key === "ArrowDown" ? 1 : -1;
			pageItems[
				(current + offset + pageItems.length) % pageItems.length
			]?.focus();
		},
		{ signal },
	);

	document.addEventListener(
		"keydown",
		(event) => {
			if (event.key !== "Escape" || !panel.classList.contains("is-open"))
				return;
			const index = pinnedIndex ?? activeIndex;
			close();
			if (index !== null) {
				items
					.find((item) => itemIndex(item) === index)
					?.querySelector<HTMLElement>("[data-dropdown-trigger]")
					?.focus();
			}
		},
		{ signal },
	);

	document.addEventListener(
		"click",
		(event) => {
			const target = event.target;
			if (!(target instanceof Element)) return;
			const anchor = target.closest<HTMLAnchorElement>("a[href]");
			if (anchor) {
				const destination = new URL(anchor.href, window.location.href);
				if (destination.origin === window.location.origin)
					syncActiveState(destination.pathname);
			}
			if (target.closest(".dropdown-item")) {
				close();
				return;
			}
			if (!menu.contains(target)) close();
		},
		{ signal },
	);

	window.addEventListener(
		"resize",
		() => {
			if (activeIndex === null || !panel.classList.contains("is-open")) return;
			const item = items.find(
				(candidate) => itemIndex(candidate) === activeIndex,
			);
			const page = pages.get(activeIndex);
			if (item && page) position(item, page, true);
		},
		{ signal },
	);

	syncActiveState();
	close();
	return () => controller.abort();
}
