import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

// Exercise the actual inline controller, without a browser or a duplicate implementation.
const source = readFileSync(
	process.argv.includes("--stdin")
		? 0
		: new URL(
				"../src/components/pages/home/HomeLanding.astro",
				import.meta.url,
			),
	"utf8",
);
const controller = source.slice(
	source.indexOf("const exhibitSlideDuration ="),
	source.indexOf("const handleLocalCoverState ="),
);
const declarations = source.match(/^\s*let exhibit\w+ = .*;/gm).join("\n");
class Button {
	setAttribute() {}
	removeAttribute() {}
	setPointerCapture() {}
	blur() {}
}
function setup() {
	let now = 100;
	let nextId = 1;
	const frames = new Map();
	const timers = new Map();
	const context = createContext({
		HTMLElement: Button,
		performance: { now: () => now },
		document: { hidden: false },
		reducedMotion: { matches: false },
		exhibitSlides: Array.from({ length: 6 }, () => ({
			style: { setProperty() {} },
			setAttribute() {},
			dataset: {},
		})),
		exhibitMeter: null,
		exhibitMeterFills: [],
		exhibitVideo: null,
		exhibitCarousel: new Button(),
		exhibitToggle: new Button(),
		exhibitPrevious: new Button(),
		exhibitNext: new Button(),
		requestAnimationFrame: (callback) => {
			const id = nextId++;
			frames.set(id, callback);
			return id;
		},
		window: {
			cancelAnimationFrame: (id) => frames.delete(id),
			setTimeout: (callback) => {
				const id = nextId++;
				timers.set(id, callback);
				return id;
			},
			clearTimeout: (id) => timers.delete(id),
		},
	});
	runInContext(
		`${declarations}\n${controller}\nexhibitVisible = true;`,
		context,
	);
	return {
		context,
		run: (code) => runInContext(code, context),
		frame: (elapsed) => {
			now += elapsed;
			const pending = [...frames.values()];
			frames.clear();
			pending.forEach((callback) => callback(now));
		},
		event: (button, detail = 0) => ({
			currentTarget: context[button],
			isPrimary: true,
			button: 0,
			pointerId: 1,
			detail,
			preventDefault() {},
		}),
	};
}

const next = setup();
next.context.event = next.event("exhibitNext");
next.run("handleExhibitHoldPointerDown(event)");
assert.equal(
	next.run("exhibitTransition?.to"),
	1,
	"press must start immediately",
);
next.frame(16);
assert.ok(
	next.run("exhibitProgressPosition") > 0.05,
	"first frame must visibly move",
);
next.run("handleExhibitHoldPointerUp(event)");
next.context.event.detail = 1;
next.run("handleNextExhibitClick(event)");
assert.equal(
	next.run("exhibitTransition.to"),
	1,
	"release/click must not double advance",
);
next.frame(650);
assert.equal(next.run("exhibitProgressPosition"), 1);

const rapid = setup();
rapid.context.event = rapid.event("exhibitNext");
rapid.run("handleNextExhibitClick(event)");
rapid.frame(160);
const beforeRetarget = rapid.run("exhibitProgressPosition");
rapid.run("handleNextExhibitClick(event)");
assert.equal(
	rapid.run("exhibitProgressPosition"),
	beforeRetarget,
	"no jump on retarget",
);
rapid.frame(16);
assert.ok(rapid.run("exhibitProgressPosition") > beforeRetarget + 0.05);
rapid.context.event = rapid.event("exhibitPrevious");
rapid.run("handlePreviousExhibitClick(event)");
assert.equal(rapid.run("exhibitTransition.to"), 1, "reverse the queued target");

const hold = setup();
hold.context.event = hold.event("exhibitPrevious");
hold.run("handleExhibitHoldPointerDown(event)");
hold.frame(300);
const beforeHold = hold.run("exhibitProgressPosition");
hold.run("startExhibitHold()");
hold.frame(16);
assert.ok(
	hold.run("exhibitProgressPosition") < beforeHold,
	"hold continues on first frame",
);
hold.run("handleExhibitHoldPointerCancel(event)");
assert.equal(hold.run("exhibitSuppressClick"), false);
assert.equal(hold.run("exhibitHoldFrame"), 0);

const reduced = setup();
reduced.context.reducedMotion.matches = true;
reduced.context.event = reduced.event("exhibitNext");
reduced.run(
	"handleExhibitHoldPointerDown(event); handleNextExhibitClick(event)",
);
assert.equal(
	reduced.run("exhibitProgressPosition"),
	1,
	"keyboard/reduced motion stays usable",
);
assert.equal(reduced.run("exhibitTransition"), null);
console.log(
	"Home exhibit controls: immediate press, first-frame movement, no duplicate click, rapid retarget, hold/cancel and reduced motion passed.",
);
