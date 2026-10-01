import assert from "node:assert/strict";
import { test } from "node:test";
import {
	buildReadingOutline,
	outlinePath,
	readingHeading,
	readingProgress,
} from "../src/utils/reading-outline";

test("outline preserves order and handles skipped heading levels", () => {
	const tree = buildReadingOutline([
		{ depth: 2, slug: "a", text: "A #" },
		{ depth: 4, slug: "b", text: "B" },
		{ depth: 3, slug: "c", text: "C" },
		{ depth: 2, slug: "d", text: "D" },
		{ depth: 1, slug: "", text: "skip" },
	]);
	assert.deepEqual(
		tree.map((node) => node.id),
		["a", "d"],
	);
	assert.deepEqual(
		tree[0].children.map((node) => node.id),
		["b", "c"],
	);
	assert.equal(tree[0].text, "A");
	assert.deepEqual(outlinePath(tree, "c"), ["a", "c"]);
	assert.deepEqual(outlinePath(tree, "missing"), []);
});

test("empty outlines and empty heading labels", () => {
	assert.deepEqual(buildReadingOutline([]), []);
	assert.equal(
		buildReadingOutline([{ depth: 6, slug: "fallback", text: "" }])[0].text,
		"fallback",
	);
});

test("reading progress clamps both ends and supports short articles", () => {
	assert.equal(readingProgress(0, 100, 1100), 0);
	assert.equal(readingProgress(600, 100, 1100), 50);
	assert.equal(readingProgress(2000, 100, 1100), 100);
	assert.equal(readingProgress(99, 100, 100), 0);
	assert.equal(readingProgress(100, 100, 100), 100);
});

test("active heading follows content movement after an upstream cover loads", () => {
	const positions = [
		{ id: "overview", top: 0 },
		{ id: "sidebar", top: 800 },
	];
	assert.equal(readingHeading(positions, -720), "sidebar");
	assert.equal(readingHeading(positions, -500), "overview");
	assert.equal(readingHeading(positions, 200), "");
	assert.equal(readingHeading([], -720), "");
});
