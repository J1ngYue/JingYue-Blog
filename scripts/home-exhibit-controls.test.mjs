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
			attributes: new Map(),
			attributeWrites: 0,
			getAttribute(name) {
				return this.attributes.get(name) ?? null;
			},
			setAttribute(name, value) {
				this.attributes.set(name, value);
				this.attributeWrites++;
			},
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
		advance: (elapsed) => {
			now += elapsed;
		},
		frame: (elapsed) => {
			now += elapsed;
			const pending = [...frames.values()];
			frames.clear();
			pending.forEach((callback) => {
				callback(now);
			});
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
	next.run("exhibitProgressPosition") > 0.02,
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

const uniform = setup();
uniform.context.event = uniform.event("exhibitNext");
uniform.run("handleNextExhibitClick(event)");
for (const elapsed of [16, 32, 100, 48, 16]) {
	const before = uniform.run("exhibitProgressPosition");
	uniform.frame(elapsed);
	assert.ok(
		Math.abs(
			uniform.run("exhibitProgressPosition") - before - (1.6 * elapsed) / 1000,
		) < 1e-9,
		"manual movement must keep the same speed at every frame interval",
	);
}
uniform.run("handleNextExhibitClick(event)");
const beforeQueue = uniform.run("exhibitProgressPosition");
uniform.frame(100);
assert.ok(
	Math.abs(uniform.run("exhibitProgressPosition") - beforeQueue - 0.16) < 1e-9,
	"queuing another slide must not accelerate or restart easing",
);
assert.ok(
	uniform.context.exhibitSlides.every((slide) => slide.attributeWrites === 1),
	"stable slide visibility must not trigger redundant DOM writes every frame",
);
uniform.advance(8);
uniform.run("handleNextExhibitClick(event)");
const beforeBetweenFrameRetarget = uniform.run("exhibitProgressPosition");
uniform.frame(16);
assert.ok(
	Math.abs(
		uniform.run("exhibitProgressPosition") -
			beforeBetweenFrameRetarget -
			(1.6 * 24) / 1000,
	) < 1e-9,
	"retargeting between frames must not drop elapsed movement time",
);

const reverse = setup();
reverse.run("exhibitProgressPosition = 1.2");
reverse.context.event = reverse.event("exhibitPrevious");
reverse.run("handlePreviousExhibitClick(event)");
reverse.frame(32);
assert.ok(Math.abs(reverse.run("exhibitProgressPosition") - 1.1488) < 1e-9);

const automatic = setup();
automatic.run("syncExhibitPlayback()");
automatic.frame(16);
const beforeAuto = automatic.run("exhibitProgressPosition");
automatic.frame(100);
assert.ok(
	Math.abs(
		automatic.run("exhibitProgressPosition") - beforeAuto - 100 / 12000,
	) < 1e-9,
	"automatic movement must not discard elapsed time on a delayed frame",
);

const hidden = setup();
hidden.context.event = hidden.event("exhibitNext");
hidden.run("handleNextExhibitClick(event)");
hidden.frame(100);
const beforeHidden = hidden.run("exhibitProgressPosition");
hidden.context.document.hidden = true;
hidden.run("handleExhibitVisibilityChange()");
hidden.advance(2000);
hidden.context.document.hidden = false;
hidden.run("handleExhibitVisibilityChange()");
hidden.frame(16);
assert.ok(
	Math.abs(hidden.run("exhibitProgressPosition") - beforeHidden - 0.0256) <
		1e-9,
	"returning to the page must resume movement without jumping over hidden time",
);

const boundaryHold = setup();
boundaryHold.run("exhibitProgressPosition = 0.95");
boundaryHold.context.event = boundaryHold.event("exhibitNext");
boundaryHold.run("handleExhibitHoldPointerDown(event)");
for (let frame = 0; frame < 10; frame++) {
	const before = boundaryHold.run("exhibitProgressPosition");
	boundaryHold.frame(16);
	assert.ok(
		Math.abs(boundaryHold.run("exhibitProgressPosition") - before - 0.0256) <
			1e-9,
		"holding near a slide boundary must not pause before hold activation",
	);
}
boundaryHold.run("startExhibitHold()");
const beforeContinuousHold = boundaryHold.run("exhibitProgressPosition");
boundaryHold.frame(100);
assert.ok(
	Math.abs(
		boundaryHold.run("exhibitProgressPosition") - beforeContinuousHold - 0.16,
	) < 1e-9,
	"hold takeover must keep the same wall-clock speed even on a delayed frame",
);

const betweenFrames = setup();
betweenFrames.context.event = betweenFrames.event("exhibitNext");
betweenFrames.run("handleExhibitHoldPointerDown(event)");
betweenFrames.frame(288);
const beforeHandoff = betweenFrames.run("exhibitProgressPosition");
betweenFrames.advance(12);
betweenFrames.run("startExhibitHold()");
betweenFrames.frame(16);
assert.ok(
	Math.abs(
		betweenFrames.run("exhibitProgressPosition") -
			beforeHandoff -
			(1.6 * 28) / 1000,
	) < 1e-9,
	"hold timer between frames must not drop elapsed motion time",
);

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
assert.ok(
	Math.abs(rapid.run("exhibitProgressPosition") - beforeRetarget - 0.0256) <
		1e-9,
);
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
	"Home exhibit controls: immediate press, constant frame speed, continuous retarget/hold, no duplicate click, cancel and reduced motion passed.",
);
