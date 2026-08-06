import { getTagUrl } from "@/utils/url-utils";

export interface ArchiveKnowledgeGraphInput {
	title: string;
	tags?: string[];
}

export interface ArchiveKnowledgeGraphNode {
	id: string;
	name: string;
	value: number;
	url: string;
	posts: string[];
	group: number;
}

export interface ArchiveKnowledgeGraphLink {
	source: string;
	target: string;
	value: number;
}

export interface ArchiveKnowledgeGraphData {
	nodes: ArchiveKnowledgeGraphNode[];
	links: ArchiveKnowledgeGraphLink[];
}

function normalizeTags(tags: string[] | undefined): string[] {
	return [
		...new Set(
			(tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0),
		),
	].sort((a, b) => a.localeCompare(b));
}

function pairKey(source: string, target: string): string {
	return `${source}\u0000${target}`;
}

export function buildArchiveKnowledgeGraph(
	posts: ArchiveKnowledgeGraphInput[],
): ArchiveKnowledgeGraphData {
	const nodeMap = new Map<string, Omit<ArchiveKnowledgeGraphNode, "group">>();
	const linkMap = new Map<string, ArchiveKnowledgeGraphLink>();

	for (const post of posts) {
		const tags = normalizeTags(post.tags);
		for (const tag of tags) {
			const node = nodeMap.get(tag) ?? {
				id: tag,
				name: tag,
				value: 0,
				url: getTagUrl(tag),
				posts: [],
			};
			node.value += 1;
			node.posts.push(post.title);
			nodeMap.set(tag, node);
		}

		for (let sourceIndex = 0; sourceIndex < tags.length; sourceIndex++) {
			for (
				let targetIndex = sourceIndex + 1;
				targetIndex < tags.length;
				targetIndex++
			) {
				const source = tags[sourceIndex];
				const target = tags[targetIndex];
				const key = pairKey(source, target);
				const link = linkMap.get(key) ?? { source, target, value: 0 };
				link.value += 1;
				linkMap.set(key, link);
			}
		}
	}

	const links = [...linkMap.values()].sort(
		(a, b) =>
			b.value - a.value ||
			a.source.localeCompare(b.source) ||
			a.target.localeCompare(b.target),
	);
	const adjacency = new Map<string, Set<string>>();
	for (const nodeId of nodeMap.keys()) adjacency.set(nodeId, new Set());
	for (const link of links) {
		adjacency.get(link.source)?.add(link.target);
		adjacency.get(link.target)?.add(link.source);
	}

	const groupMap = new Map<string, number>();
	let group = 0;
	for (const nodeId of nodeMap.keys()) {
		if (groupMap.has(nodeId)) continue;
		const queue = [nodeId];
		groupMap.set(nodeId, group);
		while (queue.length > 0) {
			const current = queue.shift();
			if (!current) continue;
			for (const neighbor of adjacency.get(current) ?? []) {
				if (groupMap.has(neighbor)) continue;
				groupMap.set(neighbor, group);
				queue.push(neighbor);
			}
		}
		group += 1;
	}

	const nodes = [...nodeMap.values()]
		.map((node) => ({
			...node,
			posts: node.posts.slice(0, 4),
			group: groupMap.get(node.id) ?? 0,
		}))
		.sort(
			(a, b) =>
				b.value - a.value ||
				a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
		);

	return { nodes, links };
}
