<script lang="ts">
import { onDestroy, onMount } from "svelte";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface Props {
	active?: boolean;
	isPlaying?: boolean;
}

interface SharedAudioGraph {
	context: AudioContext;
	gain: GainNode;
}

interface AudioBands {
	subBass: number;
	bass: number;
	lowMid: number;
	mid: number;
	highMid: number;
	presence: number;
	brilliance: number;
	air: number;
	warmth: number;
	brightness: number;
	sharpness: number;
	smoothness: number;
	density: number;
	energy: number;
}

interface RippleUniform {
	pos: THREE.Vector2;
	time: number;
	strength: number;
	isActive: number;
	rippleType: number;
}

interface Meteor {
	active: boolean;
	x: number;
	y: number;
	z: number;
	speed: number;
	strength: number;
}

interface Spark {
	active: boolean;
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	life: number;
	maxLife: number;
	scale: number;
}

type TerrainUniforms = {
	uTime: { value: number };
	uSubBass: { value: number };
	uBass: { value: number };
	uLowMid: { value: number };
	uMid: { value: number };
	uHighMid: { value: number };
	uPresence: { value: number };
	uBrilliance: { value: number };
	uAir: { value: number };
	uWarmth: { value: number };
	uBrightness: { value: number };
	uSharpness: { value: number };
	uSmoothness: { value: number };
	uDensity: { value: number };
	uEnergy: { value: number };
	uRipples: { value: RippleUniform[] };
	uBaseColor1: { value: THREE.Color };
	uBaseColor2: { value: THREE.Color };
	uCoolCore: { value: THREE.Color };
	uCoolEdge: { value: THREE.Color };
	uWarmCore: { value: THREE.Color };
	uWarmEdge: { value: THREE.Color };
	uRippleColor: { value: THREE.Color };
	uGlowIntensity: { value: number };
};

interface Palette {
	background: THREE.Color;
	base1: THREE.Color;
	base2: THREE.Color;
	coolCore: THREE.Color;
	coolEdge: THREE.Color;
	warmCore: THREE.Color;
	warmEdge: THREE.Color;
	ripple: THREE.Color;
	glow: number;
}

let { active = false, isPlaying = false }: Props = $props();
let container: HTMLDivElement;
let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let terrain: THREE.InstancedMesh | null = null;
let terrainMaterial: THREE.ShaderMaterial | null = null;
let meteorMesh: THREE.InstancedMesh | null = null;
let sparkMesh: THREE.InstancedMesh | null = null;
let analyser: AnalyserNode | null = null;
let frequencyData = new Uint8Array(512);
let animationFrame = 0;
let resizeObserver: ResizeObserver | null = null;
let themeObserver: MutationObserver | null = null;
let reducedMotion = false;
let lastTime = 0;
let lastBeatAt = 0;
let lastMeteorAt = 0;
let pointerDownAt = 0;
let pointerStartX = 0;
let pointerStartY = 0;
let sceneStartedAt = 0;
let rippleCursor = 0;
let meteorCursor = 0;
let sparkCursor = 0;
let targetPalette: Palette;

const AUDIO_GRAPH_KEY = "__fireflyAudioGraph";
const GRID_SIZE = 128;
const MOBILE_GRID_SIZE = 84;
const GRID_GAP = 1.05;
const RIPPLE_COUNT = 10;
const METEOR_COUNT = 12;
const SPARK_COUNT = 100;
const dummy = new THREE.Object3D();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const ripples: RippleUniform[] = Array.from({ length: RIPPLE_COUNT }, () => ({
	pos: new THREE.Vector2(),
	time: -100,
	strength: 0,
	isActive: 0,
	rippleType: 0,
}));
const meteors: Meteor[] = Array.from({ length: METEOR_COUNT }, () => ({
	active: false,
	x: 0,
	y: -1000,
	z: 0,
	speed: 0,
	strength: 0,
}));
const sparks: Spark[] = Array.from({ length: SPARK_COUNT }, () => ({
	active: false,
	x: 0,
	y: -1000,
	z: 0,
	vx: 0,
	vy: 0,
	vz: 0,
	life: 0,
	maxLife: 1,
	scale: 1,
}));
const smoothed: AudioBands = {
	subBass: 0,
	bass: 0,
	lowMid: 0,
	mid: 0,
	highMid: 0,
	presence: 0,
	brilliance: 0,
	air: 0,
	warmth: 0,
	brightness: 0,
	sharpness: 0,
	smoothness: 1,
	density: 0,
	energy: 0.09,
};

function getSceneTime() {
	return Math.max(0, (performance.now() - sceneStartedAt) / 1000);
}

const vertexShader = `
	uniform float uTime;
	uniform float uSubBass;
	uniform float uBass;
	uniform float uLowMid;
	uniform float uMid;
	uniform float uHighMid;
	uniform float uSmoothness;
	uniform float uDensity;
	uniform float uEnergy;

	struct Ripple {
		vec2 pos;
		float time;
		float strength;
		float isActive;
		float rippleType;
	};

	uniform Ripple uRipples[10];

	varying vec2 vUv;
	varying float vElevation;
	varying float vDistance;
	varying vec2 vRippleAnim;
	varying vec3 vNormal;
	varying float vRelativeY;
	varying vec2 vInstancePos;

	vec3 mod289(vec3 x) {
		return x - floor(x * (1.0 / 289.0)) * 289.0;
	}

	vec2 mod289(vec2 x) {
		return x - floor(x * (1.0 / 289.0)) * 289.0;
	}

	vec3 permute(vec3 x) {
		return mod289(((x * 34.0) + 1.0) * x);
	}

	float snoise(vec2 v) {
		const vec4 C = vec4(
			0.211324865405187,
			0.366025403784439,
			-0.577350269189626,
			0.024390243902439
		);
		vec2 i = floor(v + dot(v, C.yy));
		vec2 x0 = v - i + dot(i, C.xx);
		vec2 i1 = x0.x > x0.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
		vec4 x12 = x0.xyxy + C.xxzz;
		x12.xy -= i1;
		i = mod289(i);
		vec3 p = permute(
			permute(i.y + vec3(0.0, i1.y, 1.0)) +
			i.x +
			vec3(0.0, i1.x, 1.0)
		);
		vec3 m = max(
			0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
			0.0
		);
		m = m * m;
		m = m * m;
		vec3 x = 2.0 * fract(p * C.www) - 1.0;
		vec3 h = abs(x) - 0.5;
		vec3 ox = floor(x + 0.5);
		vec3 a0 = x - ox;
		m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
		vec3 g;
		g.x = a0.x * x0.x + h.x * x0.y;
		g.yz = a0.yz * x12.xz + h.yz * x12.yw;
		return 130.0 * dot(m, g);
	}

	float random(vec2 st) {
		return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
	}

	void main() {
		vUv = uv;
		vNormal = normal;
		vec4 instancePosition = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
		vec2 position2D = instancePosition.xz;
		vInstancePos = position2D;

		float centerDistance = length(position2D);
		vDistance = centerDistance;
		float randomValue = random(position2D);
		vec2 movingPosition =
			position2D * 0.05 + vec2(uTime * 0.1, uTime * 0.05);
		float baseNoise = (snoise(movingPosition) + 1.0) * 0.5;
		float wave =
			sin(position2D.x * 0.15 + position2D.y * 0.1 - uTime * 0.6) *
				0.5 +
			0.5;
		float globalFalloff = smoothstep(50.0, 25.0, centerDistance);
		float idleElevation =
			mix(baseNoise, wave, uSmoothness * 0.5 + 0.2) *
			0.6 *
			globalFalloff;

		float subRegion = smoothstep(20.0, 0.0, centerDistance);
		float subLift = uSubBass * subRegion * 4.0;
		float bassNoise =
			snoise(position2D * 0.1 - vec2(0.0, uTime * 0.2));
		float bassRegion =
			smoothstep(30.0, 5.0, centerDistance + bassNoise * 5.0);
		float bassLift =
			uBass *
			bassRegion *
			smoothstep(0.0, 1.0, randomValue + uDensity * 0.5) *
			3.0;
		float lowMidNoise =
			snoise(position2D * 0.05 + vec2(uTime * 0.1, 0.0));
		float lowMidLift = uLowMid * (lowMidNoise * 0.5 + 0.5) * 2.0;
		float riverFlow = sin(
			position2D.x * 0.2 +
			position2D.y * 0.2 +
			snoise(position2D * 0.1) * 2.0 -
			uTime * 2.0
		);
		float midLift = uMid * max(0.0, riverFlow) * 2.5;
		float highMidRegion = smoothstep(10.0, 35.0, centerDistance);
		float highMidLift = 0.0;
		if (fract(randomValue * 13.3) > 0.8) {
			highMidLift =
				uHighMid *
				highMidRegion *
				fract(randomValue * 7.7) *
				2.0;
		}

		float audioElevation =
			subLift + bassLift + lowMidLift + midLift + highMidLift;
		if (randomValue > 0.99) {
			audioElevation += uEnergy * 4.0;
		}
		audioElevation *= globalFalloff;
		float elevation = idleElevation + audioElevation;

		float rippleElevation = 0.0;
		float normalRipple = 0.0;
		float accentRipple = 0.0;
		for (int i = 0; i < 10; i++) {
			if (uRipples[i].isActive > 0.0) {
				float distanceFromRipple =
					length(position2D - uRipples[i].pos);
				float elapsed = uTime - uRipples[i].time;
				float speed = uRipples[i].rippleType > 0.5 ? 20.0 : 15.0;
				float width = uRipples[i].rippleType > 0.5 ? 1.0 : 3.0;
				float fadeDistance =
					uRipples[i].rippleType > 0.5 ? 8.0 : 15.0;
				float height = uRipples[i].rippleType > 0.5 ? 1.0 : 3.0;
				float waveDistance = distanceFromRipple - elapsed * speed;
				float rippleWave =
					exp(-(waveDistance * waveDistance) / width);
				float fade = exp(-(elapsed * speed) / fadeDistance);
				float pulse =
					rippleWave * fade * uRipples[i].strength;
				rippleElevation += pulse * height;
				if (uRipples[i].rippleType > 0.5) {
					accentRipple += pulse;
				} else {
					normalRipple += pulse;
				}
			}
		}

		elevation += rippleElevation;
		vRippleAnim = vec2(
			clamp(normalRipple, 0.0, 1.0),
			clamp(accentRipple, 0.0, 1.0)
		);
		vElevation = elevation;
		float yPosition = position.y + 0.5;
		vRelativeY = yPosition;
		vec3 transformedPosition = position;
		transformedPosition.y =
			-0.5 + yPosition * (1.0 + elevation);
		vec4 worldPosition =
			instanceMatrix * vec4(transformedPosition, 1.0);
		gl_Position =
			projectionMatrix * viewMatrix * modelMatrix * worldPosition;
	}
`;

const fragmentShader = `
	uniform float uTime;
	uniform float uPresence;
	uniform float uBrilliance;
	uniform float uAir;
	uniform float uWarmth;
	uniform float uBrightness;
	uniform float uSharpness;
	uniform vec3 uBaseColor1;
	uniform vec3 uBaseColor2;
	uniform vec3 uCoolCore;
	uniform vec3 uCoolEdge;
	uniform vec3 uWarmCore;
	uniform vec3 uWarmEdge;
	uniform vec3 uRippleColor;
	uniform float uGlowIntensity;

	varying vec2 vUv;
	varying float vElevation;
	varying float vDistance;
	varying vec2 vRippleAnim;
	varying vec3 vNormal;
	varying float vRelativeY;
	varying vec2 vInstancePos;

	float random(vec2 st) {
		return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
	}

	void main() {
		bool isTop = vNormal.y > 0.5;
		float distanceFromTop = 1.0 - vRelativeY;
		float randomValue = random(vInstancePos);
		float centerDistance = length(vInstancePos);
		float normalizedElevation = clamp(vElevation / 6.0, 0.0, 1.0);
		float warmBlend = smoothstep(
			0.0,
			1.0,
			uWarmth * 1.5 + (0.5 - centerDistance / 70.0)
		);
		vec3 zoneCore = mix(uCoolCore, uWarmCore, warmBlend);
		vec3 zoneEdge = mix(uCoolEdge, uWarmEdge, warmBlend);
		vec3 targetGlow =
			mix(zoneCore, zoneEdge, fract(randomValue * 11.0));
		float distanceFade =
			1.0 - smoothstep(30.0, 65.0, centerDistance);
		targetGlow = mix(
			targetGlow,
			vec3(0.4, 0.8, 1.0),
			uBrightness * 0.5
		);
		vec3 currentGlow =
			mix(
				uBaseColor2,
				targetGlow,
				clamp(
					normalizedElevation * 1.4 +
					distanceFade * 0.18,
					0.0,
					1.0
				)
			) *
			uGlowIntensity *
			distanceFade;
		currentGlow = mix(
			currentGlow,
			uRippleColor,
			vRippleAnim.x
		);
		currentGlow = mix(
			currentGlow,
			vec3(1.0),
			vRippleAnim.y
		);
		vec3 bodyColor =
			mix(uBaseColor1, uBaseColor2, vRelativeY * distanceFade);
		vec3 finalColor;

		if (isTop) {
			float topIntensity =
				clamp(
					smoothstep(0.0, 0.4, normalizedElevation) +
					distanceFade * 0.12,
					0.0,
					1.0
				);
			float twinkleDistance =
				smoothstep(50.0, 25.0, centerDistance);
			float twinkleMultiplier = mix(
				twinkleDistance,
				1.0,
				smoothstep(0.01, 0.1, normalizedElevation)
			);
			if (
				fract(randomValue * 31.0) > 0.95 &&
				normalizedElevation < 0.1
			) {
				topIntensity += uAir * 1.5 * twinkleMultiplier;
			}
			finalColor = mix(uBaseColor2, currentGlow, topIntensity);
			float edgeX =
				smoothstep(0.05, 0.01, vUv.x) +
				smoothstep(0.95, 0.99, vUv.x);
			float edgeY =
				smoothstep(0.05, 0.01, vUv.y) +
				smoothstep(0.95, 0.99, vUv.y);
			float edge = min(edgeX + edgeY, 1.0);
			finalColor +=
				currentGlow * edge * 0.6 * (topIntensity + 0.3);
			float flashChance = smoothstep(0.3, 1.0, uPresence);
			if (
				fract(randomValue * 53.0) >
				0.98 - flashChance * 0.1
			) {
				float flash =
					sin(uTime * 40.0 + randomValue * 100.0) *
						0.5 +
					0.5;
				finalColor +=
					mix(
						vec3(1.0),
						vec3(0.5, 1.0, 1.0),
						randomValue
					) *
					flash *
					uPresence *
					(1.0 + uSharpness * 2.0) *
					twinkleMultiplier;
			}
			if (
				edge > 0.5 &&
				fract(randomValue * 89.0 + uTime * 2.0) > 0.98
			) {
				finalColor +=
					vec3(1.0) * uBrilliance * 2.0 * twinkleMultiplier;
			}
		} else {
			float verticalFalloff = mix(1.0, 3.0, uSharpness);
			float sideGlow =
				smoothstep(
					0.5 / verticalFalloff,
					0.0,
					distanceFromTop
				) * normalizedElevation;
			if (normalizedElevation < 0.02) {
				sideGlow = 0.0;
			}
			finalColor = mix(bodyColor, currentGlow, sideGlow * 1.2);
			float rimGlow =
				smoothstep(0.03, 0.0, distanceFromTop) *
				normalizedElevation;
			finalColor += currentGlow * rimGlow;
		}

		finalColor += uRippleColor * vRippleAnim.x * 0.5;
		finalColor += vec3(1.0) * vRippleAnim.y;
		float aerialFog = smoothstep(25.0, 55.0, vDistance);
		vec3 atmosphericColor =
			mix(uBaseColor1, uBaseColor2, 0.4);
		finalColor = mix(
			finalColor,
			atmosphericColor,
			aerialFog * 0.4
		);
		float alphaFade =
			1.0 - smoothstep(45.0, 65.0, vDistance);
		gl_FragColor = vec4(finalColor, alphaFade);
	}
`;

function makePalette(dark: boolean): Palette {
	if (dark) {
		return {
			background: new THREE.Color("#0a0a15"),
			base1: new THREE.Color("#050810"),
			base2: new THREE.Color("#0a0f1a"),
			coolCore: new THREE.Color("#2255ff"),
			coolEdge: new THREE.Color("#8844ff"),
			warmCore: new THREE.Color("#ff4422"),
			warmEdge: new THREE.Color("#ffaa00"),
			ripple: new THREE.Color("#44ddff"),
			glow: 1.2,
		};
	}

	return {
		background: new THREE.Color("#f7fbfd"),
		base1: new THREE.Color("#d4e3ea"),
		base2: new THREE.Color("#edf6f8"),
		coolCore: new THREE.Color("#2d7dff"),
		coolEdge: new THREE.Color("#8466ff"),
		warmCore: new THREE.Color("#ff5b8f"),
		warmEdge: new THREE.Color("#ffb162"),
		ripple: new THREE.Color("#15c7d7"),
		glow: 0.9,
	};
}

function getAudioGraph(audio: HTMLAudioElement): SharedAudioGraph | null {
	const sharedWindow = window as unknown as Record<string, unknown>;
	const existing = sharedWindow[AUDIO_GRAPH_KEY] as
		| SharedAudioGraph
		| undefined;
	if (existing) return existing;

	try {
		const AudioContextClass =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext })
				.webkitAudioContext;
		const context = new AudioContextClass();
		const source = context.createMediaElementSource(audio);
		const gain = context.createGain();
		source.connect(gain);
		gain.connect(context.destination);
		const graph = { context, gain };
		sharedWindow[AUDIO_GRAPH_KEY] = graph;
		return graph;
	} catch (error) {
		console.warn("Music visualizer audio graph is unavailable", error);
		return null;
	}
}

function connectAudio() {
	if (analyser) return;
	const audio = document.getElementById(
		"firefly-music-audio",
	) as HTMLAudioElement | null;
	if (!audio) return;
	const graph = getAudioGraph(audio);
	if (!graph) return;

	analyser = graph.context.createAnalyser();
	analyser.fftSize = 1024;
	analyser.smoothingTimeConstant = 0.8;
	graph.gain.connect(analyser);
	frequencyData = new Uint8Array(analyser.frequencyBinCount);
	if (graph.context.state === "suspended") void graph.context.resume();
}

function average(start: number, end: number) {
	const safeStart = Math.max(0, Math.min(frequencyData.length - 1, start));
	const safeEnd = Math.max(safeStart + 1, Math.min(frequencyData.length, end));
	let total = 0;
	for (let index = safeStart; index < safeEnd; index += 1) {
		total += frequencyData[index];
	}
	return total / (safeEnd - safeStart) / 255;
}

function updateAudioBands(delta: number) {
	if (!analyser) {
		connectAudio();
	}

	if (analyser && isPlaying) {
		analyser.getByteFrequencyData(frequencyData);
	} else {
		for (let index = 0; index < frequencyData.length; index += 1) {
			frequencyData[index] = Math.floor(frequencyData[index] * 0.94);
		}
	}

	const subBass = average(0, 2);
	const bass = average(2, 4);
	const lowMid = average(4, 8);
	const mid = average(8, 19);
	const highMid = average(19, 47);
	const presence = average(47, 94);
	const brilliance = average(94, 187);
	const air = average(187, 373);
	const energy =
		(subBass + bass + lowMid + mid + highMid + presence + brilliance) / 7;
	const warmth = (subBass + bass + lowMid + mid) / 4;
	const brightness = (highMid + presence + brilliance + air) / 4;
	const sharpness = Math.max(0, brightness - smoothed.brightness) * 10;
	const smoothness = Math.max(0.05, 1 - sharpness * 0.7);
	const density =
		[subBass, bass, lowMid, mid, highMid, presence, brilliance, air].filter(
			(value) => value > Math.max(0.05, energy * 1.5),
		).length / 8;
	const ambient = isPlaying
		? 0
		: 0.09 + Math.sin(performance.now() * 0.00055) * 0.018;
	const values: AudioBands = {
		subBass: Math.max(subBass, ambient * 0.7),
		bass: Math.max(bass, ambient * 0.8),
		lowMid: Math.max(lowMid, ambient),
		mid: Math.max(mid, ambient * 1.12),
		highMid: Math.max(highMid, ambient * 0.82),
		presence: Math.max(presence, ambient * 0.52),
		brilliance: Math.max(brilliance, ambient * 0.34),
		air: Math.max(air, ambient * 0.2),
		warmth: Math.max(warmth, ambient * 0.86),
		brightness: Math.max(brightness, ambient * 0.48),
		sharpness,
		smoothness,
		density: Math.max(density, ambient * 1.4),
		energy: Math.max(energy, ambient),
	};
	const easing = isPlaying ? Math.min(1, delta * 9) : Math.min(1, delta * 4);

	for (const key of Object.keys(smoothed) as Array<keyof AudioBands>) {
		smoothed[key] += (values[key] - smoothed[key]) * easing;
	}

	const now = performance.now();
	if (
		isPlaying &&
		smoothed.bass > 0.24 &&
		smoothed.bass > smoothed.energy * 1.18 &&
		now - lastBeatAt > 310
	) {
		const angle = Math.random() * Math.PI * 2;
		const radius = Math.random() * 20;
		addRipple(
			Math.cos(angle) * radius,
			Math.sin(angle) * radius,
			Math.min(3, 0.9 + smoothed.bass * 3),
			false,
		);
		lastBeatAt = now;
	}

	if (isPlaying && smoothed.sharpness > 0.1 && now - lastMeteorAt > 950) {
		spawnMeteor(Math.min(1, smoothed.sharpness * 1.8));
		lastMeteorAt = now;
	}
}

function addRipple(x: number, z: number, strength = 1.5, accent = false) {
	const ripple = ripples[rippleCursor];
	ripple.pos.set(x, z);
	ripple.time = getSceneTime();
	ripple.strength = strength;
	ripple.isActive = 1;
	ripple.rippleType = accent ? 1 : 0;
	rippleCursor = (rippleCursor + 1) % ripples.length;
}

function spawnMeteor(strength: number) {
	const meteor = meteors[meteorCursor];
	const angle = Math.random() * Math.PI * 2;
	const radius = Math.random() * 25;
	meteor.active = true;
	meteor.x = Math.cos(angle) * radius;
	meteor.z = Math.sin(angle) * radius;
	meteor.y = 30 + Math.random() * 10;
	meteor.speed = 1 + Math.random() * 0.5 + strength * 1.5;
	meteor.strength = strength;
	meteorCursor = (meteorCursor + 1) % meteors.length;
}

function spawnSpark(x: number, y: number, z: number, force: number) {
	const spark = sparks[sparkCursor];
	spark.active = true;
	spark.x = x + (Math.random() - 0.5) * 1.5;
	spark.y = y + (Math.random() - 0.5) * 1.5;
	spark.z = z + (Math.random() - 0.5) * 1.5;
	spark.vx = (Math.random() - 0.5) * 2;
	spark.vy = Math.random() * 2 + 10 * force;
	spark.vz = (Math.random() - 0.5) * 2;
	spark.life = 0;
	spark.maxLife = 0.5 + Math.random() * 0.5;
	spark.scale = 0.2 + Math.random() * 0.6;
	sparkCursor = (sparkCursor + 1) % sparks.length;
}

function createTerrain(gridSize: number) {
	const uniforms: TerrainUniforms = {
		uTime: { value: 0 },
		uSubBass: { value: 0 },
		uBass: { value: 0 },
		uLowMid: { value: 0 },
		uMid: { value: 0 },
		uHighMid: { value: 0 },
		uPresence: { value: 0 },
		uBrilliance: { value: 0 },
		uAir: { value: 0 },
		uWarmth: { value: 0 },
		uBrightness: { value: 0 },
		uSharpness: { value: 0 },
		uSmoothness: { value: 1 },
		uDensity: { value: 0 },
		uEnergy: { value: 0 },
		uRipples: { value: ripples },
		uBaseColor1: { value: targetPalette.base1.clone() },
		uBaseColor2: { value: targetPalette.base2.clone() },
		uCoolCore: { value: targetPalette.coolCore.clone() },
		uCoolEdge: { value: targetPalette.coolEdge.clone() },
		uWarmCore: { value: targetPalette.warmCore.clone() },
		uWarmEdge: { value: targetPalette.warmEdge.clone() },
		uRippleColor: { value: targetPalette.ripple.clone() },
		uGlowIntensity: { value: targetPalette.glow },
	};
	terrainMaterial = new THREE.ShaderMaterial({
		vertexShader,
		fragmentShader,
		uniforms,
		transparent: true,
		side: THREE.DoubleSide,
	});

	const geometry = new THREE.BoxGeometry(0.9, 1, 0.9);
	terrain = new THREE.InstancedMesh(
		geometry,
		terrainMaterial,
		gridSize * gridSize,
	);
	terrain.instanceMatrix.setUsage(THREE.StaticDrawUsage);
	const offset = ((gridSize - 1) * GRID_GAP) / 2;
	let index = 0;
	for (let row = 0; row < gridSize; row += 1) {
		for (let column = 0; column < gridSize; column += 1) {
			dummy.position.set(
				row * GRID_GAP - offset,
				0.5,
				column * GRID_GAP - offset,
			);
			dummy.updateMatrix();
			terrain.setMatrixAt(index, dummy.matrix);
			index += 1;
		}
	}
	terrain.instanceMatrix.needsUpdate = true;
	scene?.add(terrain);
}

function createParticles() {
	const meteorGeometry = new THREE.BoxGeometry(0.42, 1.3, 0.42);
	const meteorMaterial = new THREE.MeshBasicMaterial({
		color: "#dffcff",
		toneMapped: false,
	});
	meteorMesh = new THREE.InstancedMesh(
		meteorGeometry,
		meteorMaterial,
		METEOR_COUNT,
	);
	meteorMesh.frustumCulled = false;
	scene?.add(meteorMesh);

	const sparkGeometry = new THREE.BoxGeometry(0.55, 0.55, 0.55);
	const sparkMaterial = new THREE.MeshBasicMaterial({
		color: "#93efff",
		transparent: true,
		opacity: 0.72,
		toneMapped: false,
	});
	sparkMesh = new THREE.InstancedMesh(
		sparkGeometry,
		sparkMaterial,
		SPARK_COUNT,
	);
	sparkMesh.frustumCulled = false;
	scene?.add(sparkMesh);
}

function resize() {
	if (!container || !renderer || !camera) return;
	const width = Math.max(1, container.clientWidth);
	const height = Math.max(1, container.clientHeight);
	camera.aspect = width / height;
	camera.updateProjectionMatrix();
	renderer.setPixelRatio(
		Math.min(window.devicePixelRatio || 1, reducedMotion ? 1 : 1.6),
	);
	renderer.setSize(width, height, false);
}

function setTargetTheme() {
	targetPalette = makePalette(
		document.documentElement.classList.contains("dark"),
	);
}

function onPointerDown(event: PointerEvent) {
	if (event.button !== 0) return;
	pointerDownAt = performance.now();
	pointerStartX = event.clientX;
	pointerStartY = event.clientY;
}

function onPointerUp(event: PointerEvent) {
	if (
		event.button !== 0 ||
		!terrain ||
		!camera ||
		!renderer ||
		performance.now() - pointerDownAt > 520 ||
		Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) > 8
	) {
		return;
	}

	const bounds = renderer.domElement.getBoundingClientRect();
	pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
	pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
	raycaster.setFromCamera(pointer, camera);
	const intersection = raycaster.intersectObject(terrain, false)[0];
	if (!intersection) return;
	addRipple(
		intersection.point.x,
		intersection.point.z,
		Math.min(2.5, 0.7 + (performance.now() - pointerDownAt) / 400),
		false,
	);
}

function updateParticles(delta: number) {
	if (!meteorMesh || !sparkMesh) return;
	const meteorMaterial = meteorMesh.material as THREE.MeshBasicMaterial;
	meteorMaterial.color.lerp(
		targetPalette.warmCore.clone().lerp(new THREE.Color("#ffffff"), 0.7),
		Math.min(1, delta * 3),
	);

	for (let index = 0; index < meteors.length; index += 1) {
		const meteor = meteors[index];
		if (meteor.active) {
			meteor.y -= 50 * meteor.speed * delta;
			if (meteor.y <= 0) {
				meteor.active = false;
				addRipple(meteor.x, meteor.z, Math.min(1, meteor.strength), true);
				for (let count = 0; count < 8; count += 1) {
					spawnSpark(meteor.x, 0.5, meteor.z, 1.2 * meteor.speed);
				}
			}
			if (meteor.active && Math.random() > 0.45) {
				spawnSpark(meteor.x, meteor.y, meteor.z, 0.15 * meteor.speed);
			}
		}
		dummy.position.set(
			meteor.active ? meteor.x : 0,
			meteor.active ? meteor.y : -1000,
			meteor.active ? meteor.z : 0,
		);
		dummy.scale.setScalar(meteor.active ? 1.5 : 0);
		dummy.updateMatrix();
		meteorMesh.setMatrixAt(index, dummy.matrix);
	}
	meteorMesh.instanceMatrix.needsUpdate = true;

	const sparkMaterial = sparkMesh.material as THREE.MeshBasicMaterial;
	sparkMaterial.color.copy(meteorMaterial.color);
	for (let index = 0; index < sparks.length; index += 1) {
		const spark = sparks[index];
		if (spark.active) {
			spark.life += delta;
			if (spark.life >= spark.maxLife) {
				spark.active = false;
			} else {
				spark.x += spark.vx * delta * 8;
				spark.y += spark.vy * delta * 8;
				spark.z += spark.vz * delta * 8;
			}
		}
		const scale = spark.active
			? spark.scale * (1 - spark.life / spark.maxLife)
			: 0;
		dummy.position.set(
			spark.active ? spark.x : 0,
			spark.active ? spark.y : -1000,
			spark.active ? spark.z : 0,
		);
		dummy.scale.setScalar(scale);
		dummy.updateMatrix();
		sparkMesh.setMatrixAt(index, dummy.matrix);
	}
	sparkMesh.instanceMatrix.needsUpdate = true;
}

function render(now: number) {
	animationFrame = requestAnimationFrame(render);
	if (
		!active ||
		!renderer ||
		!scene ||
		!camera ||
		!terrainMaterial ||
		!controls
	) {
		lastTime = now;
		return;
	}

	const delta = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
	lastTime = now;
	updateAudioBands(delta);

	const uniforms = terrainMaterial.uniforms as TerrainUniforms;
	const elapsed = getSceneTime();
	uniforms.uTime.value = elapsed;
	uniforms.uSubBass.value = smoothed.subBass;
	uniforms.uBass.value = smoothed.bass;
	uniforms.uLowMid.value = smoothed.lowMid;
	uniforms.uMid.value = smoothed.mid;
	uniforms.uHighMid.value = smoothed.highMid;
	uniforms.uPresence.value = smoothed.presence;
	uniforms.uBrilliance.value = smoothed.brilliance;
	uniforms.uAir.value = smoothed.air;
	uniforms.uWarmth.value = smoothed.warmth;
	uniforms.uBrightness.value = smoothed.brightness;
	uniforms.uSharpness.value = smoothed.sharpness;
	uniforms.uSmoothness.value = smoothed.smoothness;
	uniforms.uDensity.value = smoothed.density;
	uniforms.uEnergy.value = smoothed.energy;
	uniforms.uBaseColor1.value.lerp(targetPalette.base1, Math.min(1, delta * 3));
	uniforms.uBaseColor2.value.lerp(targetPalette.base2, Math.min(1, delta * 3));
	uniforms.uCoolCore.value.lerp(targetPalette.coolCore, Math.min(1, delta * 3));
	uniforms.uCoolEdge.value.lerp(targetPalette.coolEdge, Math.min(1, delta * 3));
	uniforms.uWarmCore.value.lerp(targetPalette.warmCore, Math.min(1, delta * 3));
	uniforms.uWarmEdge.value.lerp(targetPalette.warmEdge, Math.min(1, delta * 3));
	uniforms.uRippleColor.value.lerp(
		targetPalette.ripple,
		Math.min(1, delta * 3),
	);
	uniforms.uGlowIntensity.value = THREE.MathUtils.lerp(
		uniforms.uGlowIntensity.value,
		targetPalette.glow,
		Math.min(1, delta * 3),
	);

	if (scene.background instanceof THREE.Color) {
		scene.background.lerp(targetPalette.background, Math.min(1, delta * 3));
	}
	if (scene.fog instanceof THREE.Fog) {
		scene.fog.color.lerp(targetPalette.background, Math.min(1, delta * 3));
	}

	for (const ripple of ripples) {
		if (ripple.isActive && elapsed - ripple.time > 5) {
			ripple.isActive = 0;
		}
	}
	updateParticles(delta);
	controls.update(delta);
	renderer.render(scene, camera);
}

function initializeScene() {
	setTargetTheme();
	scene = new THREE.Scene();
	scene.background = targetPalette.background.clone();
	scene.fog = new THREE.Fog(targetPalette.background.clone(), 25, 80);
	camera = new THREE.PerspectiveCamera(
		60,
		Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
		0.1,
		200,
	);
	camera.position.set(-12, 32, 50);

	renderer = new THREE.WebGLRenderer({
		antialias: !window.matchMedia("(max-width: 768px)").matches,
		alpha: true,
		powerPreference: "high-performance",
	});
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.2;
	renderer.domElement.setAttribute(
		"aria-label",
		"可拖拽旋转、点击产生涟漪的 3D 音乐频谱地形",
	);
	container.appendChild(renderer.domElement);

	controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = !reducedMotion;
	controls.dampingFactor = 0.05;
	controls.autoRotate = !reducedMotion;
	controls.autoRotateSpeed = -0.3;
	controls.enablePan = false;
	controls.minDistance = 24;
	controls.maxDistance = 80;
	controls.maxPolarAngle = Math.PI / 2 - 0.1;

	scene.add(new THREE.AmbientLight("#ffffff", 0.5));
	const keyLight = new THREE.DirectionalLight("#ffffff", 0.8);
	keyLight.position.set(10, 20, 10);
	scene.add(keyLight);

	createTerrain(
		window.matchMedia("(max-width: 768px)").matches
			? MOBILE_GRID_SIZE
			: GRID_SIZE,
	);
	createParticles();
	renderer.domElement.addEventListener("pointerdown", onPointerDown);
	renderer.domElement.addEventListener("pointerup", onPointerUp);
	resizeObserver = new ResizeObserver(resize);
	resizeObserver.observe(container);
	themeObserver = new MutationObserver(setTargetTheme);
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});
	resize();
	sceneStartedAt = performance.now();
	addRipple(0, 0, 1.2, true);
	lastTime = performance.now();
	animationFrame = requestAnimationFrame(render);
}

function disposeMesh(mesh: THREE.InstancedMesh | null) {
	if (!mesh) return;
	mesh.geometry.dispose();
	const materials = Array.isArray(mesh.material)
		? mesh.material
		: [mesh.material];
	for (const material of materials) material.dispose();
}

onMount(() => {
	reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	initializeScene();
});

onDestroy(() => {
	cancelAnimationFrame(animationFrame);
	resizeObserver?.disconnect();
	themeObserver?.disconnect();
	controls?.dispose();
	if (renderer) {
		renderer.domElement.removeEventListener("pointerdown", onPointerDown);
		renderer.domElement.removeEventListener("pointerup", onPointerUp);
		renderer.dispose();
		renderer.forceContextLoss();
		renderer.domElement.remove();
	}
	disposeMesh(terrain);
	disposeMesh(meteorMesh);
	disposeMesh(sparkMesh);
	if (analyser) {
		try {
			analyser.disconnect();
		} catch {
			// The global audio manager owns the shared graph lifecycle.
		}
	}
});
</script>

<div bind:this={container} class="music-terrain" aria-hidden={!active}></div>

<style>
	.music-terrain {
		position: absolute;
		inset: 0;
		overflow: hidden;
		cursor: grab;
		touch-action: none;
	}

	.music-terrain:active {
		cursor: grabbing;
	}

	.music-terrain :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
		outline: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.music-terrain {
			cursor: default;
		}
	}
</style>
