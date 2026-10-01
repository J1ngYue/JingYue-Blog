import type { TocInput } from "./toc-shared";

export interface OutlineNode {
	id: string;
	text: string;
	depth: number;
	children: OutlineNode[];
}

export function buildReadingOutline(headings: TocInput[]): OutlineNode[] {
	const roots: OutlineNode[] = [];
	const stack: OutlineNode[] = [];
	for (const heading of headings) {
		if (!heading.slug) continue;
		const node: OutlineNode = {
			id: heading.slug,
			text: heading.text.replace(/#+\s*$/, "").trim() || heading.slug,
			depth: heading.depth,
			children: [],
		};
		while (stack.length && stack[stack.length - 1].depth >= node.depth) {
			stack.pop();
		}
		(stack[stack.length - 1]?.children || roots).push(node);
		stack.push(node);
	}
	return roots;
}

export function outlinePath(nodes: OutlineNode[], id: string): string[] {
	for (const node of nodes) {
		if (node.id === id) return [node.id];
		const path = outlinePath(node.children, id);
		if (path.length) return [node.id, ...path];
	}
	return [];
}

export function readingProgress(
	position: number,
	start: number,
	end: number,
): number {
	if (end <= start) return position >= start ? 100 : 0;
	return Math.round(
		Math.max(0, Math.min(1, (position - start) / (end - start))) * 100,
	);
}
