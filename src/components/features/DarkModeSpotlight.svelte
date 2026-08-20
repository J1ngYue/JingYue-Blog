<script lang="ts">
import { onMount } from "svelte";
import * as THREE from "three";
import {
	DARK_MODE_SPOTLIGHT_CHANGE_EVENT,
	DARK_MODE_SPOTLIGHT_RANGE_MAX,
	DARK_MODE_SPOTLIGHT_RANGE_MIN,
	type DarkModeSpotlightSettings,
	getDarkModeSpotlightSettings,
	setDarkModeSpotlightSettings,
} from "@/utils/dark-mode-spotlight";

const COLOR_PRESETS = ["#ffb36b", "#ffd9a3", "#8fdcff", "#c79cff", "#ff7a9e"];
type PointerCoordinates = Pick<MouseEvent, "clientX" | "clientY">;

let layer: HTMLDivElement;
let canvas: HTMLCanvasElement;
let settings = $state<DarkModeSpotlightSettings>(
	getDarkModeSpotlightSettings(),
);
let isDark = $state(false);
let isHome = $state(false);

onMount(() => {
	let renderer: THREE.WebGLRenderer;
	try {
		renderer = new THREE.WebGLRenderer({
			canvas,
			alpha: true,
			antialias: true,
			powerPreference: "high-performance",
		});
	} catch {
		return;
	}

	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
	renderer.setClearColor(0x000000, 0);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.12;

	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 50);
	camera.position.set(0, 0, 12);
	camera.lookAt(0, 0, 0);

	const ambient = new THREE.HemisphereLight(0x91a6c8, 0x0d0e14, 0.42);
	scene.add(ambient);
	const fill = new THREE.DirectionalLight(0x9cacc8, 0.08);
	fill.position.set(-4, 5, 6);
	scene.add(fill);

	const DOWN = new THREE.Vector3(0, -1, 0);
	const UP = new THREE.Vector3(0, 1, 0);
	const anchor = new THREE.Vector3();
	const position = new THREE.Vector3();
	const previous = new THREE.Vector3();
	const aimTarget = new THREE.Vector3();
	const pointerVelocity = new THREE.Vector3();
	const lastPointerTarget = new THREE.Vector3();
	const ropeDirection = new THREE.Vector3();
	const lightDirection = new THREE.Vector3();
	const currentLightDirection = DOWN.clone();
	const midpoint = new THREE.Vector3();
	const temp = new THREE.Vector3();
	const tempB = new THREE.Vector3();
	const tempC = new THREE.Vector3();
	const cableQuaternion = new THREE.Quaternion();
	const lampQuaternion = new THREE.Quaternion();
	const beamQuaternion = new THREE.Quaternion();
	const beamStart = new THREE.Vector3();
	const beamEnd = new THREE.Vector3();
	const beamDirection = new THREE.Vector3();
	const projection = new THREE.Vector3();
	const projectedBeamStart = new THREE.Vector3();
	const projectedBeamEnd = new THREE.Vector3();

	const ropeLength = 1.3;
	const defaultBeamLength = 4.6;
	const fixedStep = 1 / 120;
	const gravity = new THREE.Vector3(0, -9.81, 0);
	let halfWidth = 5;
	let halfHeight = 5;
	let beamLength = defaultBeamLength;
	let beamRadius = 1.4;
	let beamWidthMultiplier = 1;
	let pulling = false;
	let pointerTracking = false;
	let rangePointerId = -1;
	let rangeStartX = 0;
	let rangeStartValue = settings.range;
	let rangeGestureMoved = false;
	let suppressNextClick = false;
	let clickResetTimer = 0;
	let suppressContextMenu = false;
	let pullPointerId = -1;
	let pullStrength = 0;
	let lastPointerTime = 0;
	let stableFrames = 0;
	let accumulator = 0;
	let animationFrame = 0;
	let lastTime = performance.now();
	let disposed = false;

	anchor.set(0, 4.82, 0.8);
	position.copy(anchor).addScaledVector(DOWN, ropeLength);
	position.x = 0.1;
	previous.copy(position).add(new THREE.Vector3(0.014, 0, -0.01));
	aimTarget.copy(position);
	lastPointerTarget.copy(position);

	const lampRoot = new THREE.Group();
	scene.add(lampRoot);

	const cable = new THREE.Mesh(
		new THREE.CylinderGeometry(0.018, 0.018, 1, 10),
		new THREE.MeshStandardMaterial({
			color: 0x101218,
			roughness: 0.48,
			metalness: 0.62,
		}),
	);
	scene.add(cable);

	const ceilingCap = new THREE.Mesh(
		new THREE.CylinderGeometry(0.18, 0.23, 0.1, 24),
		new THREE.MeshStandardMaterial({
			color: 0x101218,
			roughness: 0.56,
			metalness: 0.72,
		}),
	);
	scene.add(ceilingCap);

	const shadeGroup = new THREE.Group();
	lampRoot.add(shadeGroup);
	const shadeProfile = [
		new THREE.Vector2(0.05, 0.07),
		new THREE.Vector2(0.12, 0.01),
		new THREE.Vector2(0.3, -0.07),
		new THREE.Vector2(0.58, -0.18),
		new THREE.Vector2(0.84, -0.27),
		new THREE.Vector2(0.86, -0.3),
	];
	const shadeMaterial = new THREE.MeshStandardMaterial({
		color: 0x15171c,
		emissive: 0x06070a,
		emissiveIntensity: 0.42,
		roughness: 0.44,
		metalness: 0.34,
		side: THREE.DoubleSide,
	});
	const shade = new THREE.Mesh(
		new THREE.LatheGeometry(shadeProfile, 48),
		shadeMaterial,
	);
	shadeGroup.add(shade);

	const rim = new THREE.Mesh(
		new THREE.TorusGeometry(0.855, 0.018, 8, 48),
		new THREE.MeshStandardMaterial({
			color: 0x111318,
			roughness: 0.36,
			metalness: 0.68,
		}),
	);
	rim.rotation.x = Math.PI / 2;
	rim.position.y = -0.29;
	shadeGroup.add(rim);

	const undersideMaterial = new THREE.MeshStandardMaterial({
		color: 0x3b2718,
		emissive: 0xffb36b,
		emissiveIntensity: 0.24,
		roughness: 0.9,
		side: THREE.DoubleSide,
	});
	const underside = new THREE.Mesh(
		new THREE.CircleGeometry(0.82, 48),
		undersideMaterial,
	);
	underside.scale.set(1, 0.22, 1);
	underside.position.y = -0.285;
	shadeGroup.add(underside);

	const connector = new THREE.Mesh(
		new THREE.CylinderGeometry(0.07, 0.09, 0.16, 20),
		new THREE.MeshStandardMaterial({
			color: 0x9c6744,
			roughness: 0.44,
			metalness: 0.66,
		}),
	);
	connector.position.y = 0.08;
	shadeGroup.add(connector);

	const bulbMaterial = new THREE.MeshStandardMaterial({
		color: 0xffc77f,
		emissive: 0xffb36b,
		emissiveIntensity: 2.35,
		roughness: 0.2,
	});
	const bulb = new THREE.Mesh(
		new THREE.SphereGeometry(0.105, 20, 12),
		bulbMaterial,
	);
	bulb.scale.y = 1.2;
	bulb.position.y = -0.235;
	shadeGroup.add(bulb);

	const glowMaterial = new THREE.SpriteMaterial({
		map: createGlowTexture(),
		color: 0xffb36b,
		transparent: true,
		opacity: 0.86,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
	});
	const glow = new THREE.Sprite(glowMaterial);
	glow.position.y = -0.255;
	glow.scale.set(0.7, 0.7, 0.7);
	shadeGroup.add(glow);

	const spotLight = new THREE.SpotLight(
		0xffb36b,
		1.6,
		12,
		THREE.MathUtils.degToRad(28),
		0.84,
		1.7,
	);
	spotLight.power = 30;
	spotLight.position.set(0, -0.25, 0.02);
	spotLight.target.position.set(0, -6, 0);
	shadeGroup.add(spotLight, spotLight.target);

	const softBeamMaterial = new THREE.ShaderMaterial({
		uniforms: {
			uColor: { value: new THREE.Color(0xffb36b) },
			uOpacity: { value: 0.13 },
		},
		vertexShader: `
			varying vec2 vUv;
			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}
		`,
		fragmentShader: `
			uniform vec3 uColor;
			uniform float uOpacity;
			varying vec2 vUv;
			void main() {
				float distanceFromCenter = abs(vUv.x - 0.5) * 2.0;
				float depth = 1.0 - vUv.y;
				float coneWidth = mix(0.055, 0.88, pow(depth, 0.82));
				float softEdge = 1.0 - smoothstep(coneWidth * 0.48, coneWidth, distanceFromCenter);
				float core = 1.0 - smoothstep(coneWidth * 0.08, coneWidth * 0.42, distanceFromCenter);
				float topFade = smoothstep(0.01, 0.12, depth);
				float bottomFade = 1.0 - smoothstep(0.86, 1.0, depth);
				float depthFalloff = mix(0.34, 0.86, smoothstep(0.02, 0.76, depth));
				float alpha = (softEdge * 0.68 + core * 0.2) * depthFalloff * topFade * bottomFade * uOpacity;
				gl_FragColor = vec4(uColor, alpha);
			}
		`,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		side: THREE.DoubleSide,
	});
	const beam = new THREE.Mesh(
		new THREE.PlaneGeometry(1, 1, 1, 8),
		softBeamMaterial,
	);
	scene.add(beam);

	const poolMaterial = new THREE.SpriteMaterial({
		map: createGlowTexture(),
		color: 0xffb36b,
		transparent: true,
		opacity: 0.25,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
	});
	const pool = new THREE.Sprite(poolMaterial);
	scene.add(pool);

	function createGlowTexture() {
		const textureCanvas = document.createElement("canvas");
		textureCanvas.width = 64;
		textureCanvas.height = 64;
		const context = textureCanvas.getContext("2d");
		if (context) {
			const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
			gradient.addColorStop(0, "rgba(255,255,255,1)");
			gradient.addColorStop(0.14, "rgba(255,218,164,.72)");
			gradient.addColorStop(0.42, "rgba(255,164,74,.17)");
			gradient.addColorStop(1, "rgba(255,124,46,0)");
			context.fillStyle = gradient;
			context.fillRect(0, 0, 64, 64);
		}
		const texture = new THREE.CanvasTexture(textureCanvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		return texture;
	}

	function applySettings(next: DarkModeSpotlightSettings) {
		const color = new THREE.Color(next.color);
		const enabled = isHome && isDark && next.enabled;
		const rangeProgress = THREE.MathUtils.clamp(
			(next.range - DARK_MODE_SPOTLIGHT_RANGE_MIN) /
				(DARK_MODE_SPOTLIGHT_RANGE_MAX - DARK_MODE_SPOTLIGHT_RANGE_MIN),
			0,
			1,
		);
		beamWidthMultiplier = THREE.MathUtils.lerp(0.62, 1.75, rangeProgress);
		softBeamMaterial.uniforms.uColor.value.copy(color);
		softBeamMaterial.uniforms.uOpacity.value = enabled
			? 0.2 + next.range / 680
			: 0;
		poolMaterial.color.copy(color);
		poolMaterial.opacity = enabled ? 0.12 + next.range / 650 : 0;
		glowMaterial.color.copy(color);
		glowMaterial.opacity = enabled ? 0.42 + next.range / 620 : 0;
		bulbMaterial.emissive.copy(color);
		bulbMaterial.emissiveIntensity = enabled ? 1.9 + next.range / 34 : 0.04;
		undersideMaterial.color.copy(color).multiplyScalar(0.18);
		undersideMaterial.emissive.copy(color);
		undersideMaterial.emissiveIntensity = enabled
			? 0.2 + next.range / 400
			: 0.03;
		spotLight.color.copy(color);
		spotLight.angle = THREE.MathUtils.degToRad(next.angle);
		spotLight.intensity = enabled ? 1.2 + next.range / 90 : 0;
		spotLight.power = enabled ? 20 + next.range * 0.42 : 0;
		layer.style.setProperty("--spotlight-color", next.color);
		layer.style.setProperty("--spotlight-range", `${next.range}`);
		layer.style.setProperty(
			"--spotlight-pool-x",
			`${16 + rangeProgress * 22}vmax`,
		);
		layer.style.setProperty(
			"--spotlight-pool-y",
			`${9 + rangeProgress * 14}vmax`,
		);
		wake();
	}

	function resize() {
		const width = Math.max(1, layer.clientWidth);
		const height = Math.max(1, layer.clientHeight);
		const aspect = width / height;
		halfHeight = 5;
		halfWidth = halfHeight * aspect;
		camera.left = -halfWidth;
		camera.right = halfWidth;
		camera.top = halfHeight;
		camera.bottom = -halfHeight;
		camera.updateProjectionMatrix();
		renderer.setPixelRatio(
			Math.min(window.devicePixelRatio || 1, width < 760 ? 1.25 : 1.5),
		);
		renderer.setSize(width, height, false);
		anchor.set(0, halfHeight - 0.18, 0.8);
		ceilingCap.position.copy(anchor).add(new THREE.Vector3(0, 0.06, 0));
		if (!pulling && !pointerTracking) {
			position.copy(anchor).addScaledVector(DOWN, ropeLength);
			previous.copy(position);
		}
		wake();
	}

	function updateRig() {
		ropeDirection.copy(position).sub(anchor).normalize();
		midpoint.copy(anchor).add(position).multiplyScalar(0.5);
		cable.position.copy(midpoint);
		cable.scale.set(1, ropeLength, 1);
		cableQuaternion.setFromUnitVectors(UP, ropeDirection);
		cable.quaternion.copy(cableQuaternion);

		if (pulling || pointerTracking) {
			lightDirection.copy(aimTarget).sub(position);
			if (lightDirection.lengthSq() < 1e-8) {
				lightDirection.copy(currentLightDirection);
			} else {
				lightDirection.normalize();
			}
			currentLightDirection
				.lerp(lightDirection, pulling ? 0.3 : 0.38)
				.normalize();
		} else {
			lightDirection.copy(DOWN);
			currentLightDirection.lerp(lightDirection, 0.14).normalize();
		}
		lampQuaternion.setFromUnitVectors(DOWN, currentLightDirection);
		lampRoot.position.copy(position);
		lampRoot.quaternion.copy(lampQuaternion);

		if (pointerTracking) {
			beamDirection.copy(aimTarget).sub(position);
			if (beamDirection.lengthSq() < 1e-8) {
				beamDirection.copy(currentLightDirection);
			} else {
				beamDirection.normalize();
			}
		} else {
			beamDirection.copy(currentLightDirection).normalize();
		}
		beamStart.copy(position).addScaledVector(beamDirection, 0.3);
		if (pointerTracking) {
			beamEnd.copy(aimTarget);
			beamLength = beamStart.distanceTo(beamEnd);
		} else {
			beamLength = defaultBeamLength;
			beamEnd.copy(beamStart).addScaledVector(beamDirection, beamLength);
		}
		beamRadius = THREE.MathUtils.clamp(
			Math.tan(THREE.MathUtils.degToRad(settings.angle * 0.5)) *
				defaultBeamLength *
				beamWidthMultiplier,
			0.72,
			2.6,
		);
		beam.visible = beamLength > 0.01;
		beam.position.copy(beamStart).add(beamEnd).multiplyScalar(0.5);
		beam.scale.set(
			Math.max(0.12, beamRadius * 2),
			Math.max(0.001, beamLength),
			1,
		);
		beamQuaternion.setFromUnitVectors(DOWN, beamDirection);
		beam.quaternion.copy(beamQuaternion);
		pool.position.copy(beamEnd);
		pool.scale.set(
			Math.max(1.15, beamRadius * 1.22),
			Math.max(0.68, beamRadius * 0.62),
			1,
		);
		spotLight.distance = beamLength + 0.6;
		spotLight.target.position.y = -(beamLength + 0.4);
		if (!pointerTracking) {
			projection.copy(beamEnd).project(camera);
			layer.style.setProperty(
				"--spotlight-x",
				`${((projection.x + 1) / 2) * 100}%`,
			);
			layer.style.setProperty(
				"--spotlight-y",
				`${((1 - projection.y) / 2) * 100}%`,
			);
		}
	}

	function stepPhysics() {
		const velocity = temp
			.copy(position)
			.sub(previous)
			.multiplyScalar(pulling ? 0.985 : 0.9948);
		previous.copy(position);
		position.add(velocity).addScaledVector(gravity, fixedStep * fixedStep);

		if (pulling || pointerTracking) {
			const trackingStrength = pulling
				? pullStrength
				: Math.max(0.18, pullStrength * 0.56);
			tempB.copy(aimTarget).sub(anchor).normalize();
			tempB
				.lerp(DOWN, 1 - trackingStrength * (pulling ? 0.82 : 0.54))
				.normalize();
			tempC.copy(tempB).multiplyScalar(ropeLength).add(anchor).sub(position);
			ropeDirection.copy(position).sub(anchor).normalize();
			tempC.addScaledVector(ropeDirection, -tempC.dot(ropeDirection));
			position.addScaledVector(
				tempC,
				(pulling ? 52 : 28) * fixedStep * fixedStep,
			);
		}

		temp.copy(position).sub(anchor);
		if (temp.lengthSq() < 1e-8) temp.copy(DOWN);
		temp.normalize().multiplyScalar(ropeLength);
		position.copy(anchor).add(temp);
		if (position.distanceToSquared(previous) < 0.000000014) stableFrames += 1;
		else stableFrames = 0;
	}

	function wake() {
		stableFrames = 0;
		if (!animationFrame && !disposed) {
			lastTime = performance.now();
			animationFrame = requestAnimationFrame(animate);
		}
	}

	function animate(time: number) {
		animationFrame = 0;
		if (disposed) return;
		const delta = Math.min((time - lastTime) / 1000, 0.05);
		lastTime = time;
		accumulator = Math.min(accumulator + delta, fixedStep * 5);
		while (accumulator >= fixedStep) {
			stepPhysics();
			accumulator -= fixedStep;
		}
		updateRig();
		renderer.render(scene, camera);
		if (
			isHome &&
			isDark &&
			settings.enabled &&
			(pulling || stableFrames < 80)
		) {
			animationFrame = requestAnimationFrame(animate);
		}
	}

	function updatePointerTarget(event: PointerCoordinates) {
		const rect = layer.getBoundingClientRect();
		const pointerX = THREE.MathUtils.clamp(
			((event.clientX - rect.left) / rect.width) * 100,
			0,
			100,
		);
		const pointerY = THREE.MathUtils.clamp(
			((event.clientY - rect.top) / rect.height) * 100,
			0,
			100,
		);
		const nx = pointerX / 50 - 1;
		const ny = 1 - pointerY / 50;
		aimTarget.set(nx * halfWidth, ny * halfHeight, 0.8);
		layer.style.setProperty("--spotlight-x", `${pointerX}%`);
		layer.style.setProperty("--spotlight-y", `${pointerY}%`);
		const projected = projection.copy(position).project(camera);
		const distanceX = (nx - projected.x) * 0.75;
		const distanceY = ny - projected.y;
		pullStrength = THREE.MathUtils.smoothstep(
			Math.hypot(distanceX, distanceY),
			0.08,
			1.15,
		);
	}

	function pointerNearLamp(event: PointerCoordinates) {
		const rect = layer.getBoundingClientRect();
		projection.copy(position).project(camera);
		const x = rect.left + ((projection.x + 1) / 2) * rect.width;
		const y = rect.top + ((1 - projection.y) / 2) * rect.height;
		return Math.hypot(event.clientX - x, event.clientY - y) < 130;
	}

	function pointerWithinLight(event: PointerCoordinates) {
		if (pointerNearLamp(event)) return true;
		const rect = layer.getBoundingClientRect();
		projectedBeamStart.copy(beamStart).project(camera);
		projectedBeamEnd.copy(beamEnd).project(camera);
		const startX = rect.left + ((projectedBeamStart.x + 1) / 2) * rect.width;
		const startY = rect.top + ((1 - projectedBeamStart.y) / 2) * rect.height;
		const endX = rect.left + ((projectedBeamEnd.x + 1) / 2) * rect.width;
		const endY = rect.top + ((1 - projectedBeamEnd.y) / 2) * rect.height;
		const beamX = endX - startX;
		const beamY = endY - startY;
		const beamLengthSquared = beamX * beamX + beamY * beamY;
		if (beamLengthSquared < 1) return false;
		const progress = THREE.MathUtils.clamp(
			((event.clientX - startX) * beamX + (event.clientY - startY) * beamY) /
				beamLengthSquared,
			0,
			1,
		);
		const nearestX = startX + beamX * progress;
		const nearestY = startY + beamY * progress;
		const worldToScreen = rect.width / (halfWidth * 2);
		const radius = THREE.MathUtils.lerp(
			48,
			Math.max(120, beamRadius * worldToScreen * 1.15),
			progress,
		);
		return (
			Math.hypot(event.clientX - nearestX, event.clientY - nearestY) <= radius
		);
	}

	function cycleLightColor() {
		const currentColor = settings.color.toLowerCase();
		const currentIndex = COLOR_PRESETS.indexOf(currentColor);
		const nextColor = COLOR_PRESETS[(currentIndex + 1) % COLOR_PRESETS.length];
		setDarkModeSpotlightSettings({ color: nextColor });
	}

	function onPointerDown(event: PointerEvent) {
		if (
			!isHome ||
			!isDark ||
			!settings.enabled ||
			event.pointerType === "touch"
		)
			return;
		if (event.button === 2) {
			if (!pointerWithinLight(event)) return;
			cycleLightColor();
			suppressContextMenu = true;
			wake();
			return;
		}
		const isNearLamp = pointerNearLamp(event);
		const isWithinLight = pointerWithinLight(event);
		updatePointerTarget(event);
		pointerTracking = true;
		if (event.button !== 0) return;
		if (isNearLamp) {
			pulling = true;
			pullPointerId = event.pointerId;
			lastPointerTime = performance.now();
			lastPointerTarget.copy(aimTarget);
			pointerVelocity.set(0, 0, 0);
		} else if (isWithinLight) {
			rangePointerId = event.pointerId;
			rangeStartX = event.clientX;
			rangeStartValue = settings.range;
			rangeGestureMoved = false;
		}
		wake();
	}

	function onPointerMove(event: PointerEvent) {
		if (
			!isHome ||
			!isDark ||
			!settings.enabled ||
			event.pointerType === "touch"
		)
			return;
		updatePointerTarget(event);
		pointerTracking = true;
		if (event.pointerId === rangePointerId) {
			const distanceX = event.clientX - rangeStartX;
			if (Math.abs(distanceX) >= 6) {
				rangeGestureMoved = true;
				suppressNextClick = true;
				document.documentElement.classList.add("spotlight-range-adjusting");
				event.preventDefault();
				const range = THREE.MathUtils.clamp(
					Math.round(rangeStartValue + distanceX * 0.24),
					DARK_MODE_SPOTLIGHT_RANGE_MIN,
					DARK_MODE_SPOTLIGHT_RANGE_MAX,
				);
				if (range !== settings.range) {
					setDarkModeSpotlightSettings({ range });
				}
			}
			wake();
			return;
		}
		if (!pulling || event.pointerId !== pullPointerId) {
			wake();
			return;
		}
		const now = performance.now();
		const elapsed = Math.max(
			0.008,
			Math.min(0.05, (now - lastPointerTime) / 1000),
		);
		temp
			.copy(aimTarget)
			.sub(lastPointerTarget)
			.multiplyScalar(1 / elapsed);
		pointerVelocity.lerp(temp, 0.34);
		lastPointerTarget.copy(aimTarget);
		lastPointerTime = now;
		wake();
	}

	function onPointerUp(event: PointerEvent) {
		if (event.pointerId === rangePointerId) {
			rangePointerId = -1;
			document.documentElement.classList.remove("spotlight-range-adjusting");
			if (rangeGestureMoved) {
				window.clearTimeout(clickResetTimer);
				clickResetTimer = window.setTimeout(() => {
					suppressNextClick = false;
				}, 0);
			}
			rangeGestureMoved = false;
			wake();
			return;
		}
		if (!pulling || event.pointerId !== pullPointerId) return;
		const velocity = temp
			.copy(position)
			.sub(previous)
			.multiplyScalar(1 / fixedStep);
		ropeDirection.copy(position).sub(anchor).normalize();
		pointerVelocity
			.addScaledVector(ropeDirection, -pointerVelocity.dot(ropeDirection))
			.clampLength(0, 6);
		velocity.addScaledVector(
			pointerVelocity,
			THREE.MathUtils.lerp(0.055, 0.12, pullStrength),
		);
		velocity.clampLength(0, 4.25);
		previous.copy(position).addScaledVector(velocity, -fixedStep);
		pulling = false;
		pullPointerId = -1;
		pullStrength = 0;
		wake();
	}

	function onPointerCancel(event: PointerEvent) {
		if (event.pointerId === rangePointerId) {
			rangePointerId = -1;
			rangeGestureMoved = false;
			document.documentElement.classList.remove("spotlight-range-adjusting");
		}
		if (event.pointerId === pullPointerId) {
			pulling = false;
			pullPointerId = -1;
			pullStrength = 0;
		}
		wake();
	}

	function resetMotion() {
		pulling = false;
		pointerTracking = false;
		pullPointerId = -1;
		pullStrength = 0;
		position.copy(anchor).addScaledVector(DOWN, ropeLength);
		previous.copy(position);
		currentLightDirection.copy(DOWN);
		wake();
	}

	function syncTheme() {
		isDark = document.documentElement.classList.contains("dark");
		if (!isDark) pointerTracking = false;
		applySettings(settings);
		if (!isDark) renderer.clear();
	}

	function syncHome() {
		const nextIsHome = document.body.classList.contains("home-landing-active");
		if (nextIsHome === isHome) return;
		isHome = nextIsHome;
		if (!isHome) resetMotion();
		applySettings(settings);
	}

	function syncSettings(event: Event) {
		const next = (event as CustomEvent<DarkModeSpotlightSettings>).detail;
		if (!next || typeof next !== "object") return;
		settings = { ...settings, ...next };
		applySettings(settings);
	}

	function onDoubleClick(event: MouseEvent) {
		if (pointerNearLamp(event)) resetMotion();
	}

	function onClick(event: MouseEvent) {
		if (!suppressNextClick) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		suppressNextClick = false;
	}

	function onContextMenu(event: MouseEvent) {
		if (!isHome || !isDark || !settings.enabled) {
			suppressContextMenu = false;
			return;
		}
		if (suppressContextMenu || pointerWithinLight(event)) {
			event.preventDefault();
			suppressContextMenu = false;
		}
	}

	function onWindowBlur() {
		pointerTracking = false;
		pulling = false;
		rangePointerId = -1;
		rangeGestureMoved = false;
		suppressNextClick = false;
		suppressContextMenu = false;
		pullPointerId = -1;
		pullStrength = 0;
		document.documentElement.classList.remove("spotlight-range-adjusting");
		wake();
	}

	const observer = new MutationObserver(syncTheme);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});
	const homeObserver = new MutationObserver(syncHome);
	homeObserver.observe(document.body, {
		attributes: true,
		attributeFilter: ["class"],
	});
	window.addEventListener(DARK_MODE_SPOTLIGHT_CHANGE_EVENT, syncSettings);
	window.addEventListener("pointerdown", onPointerDown, { passive: true });
	window.addEventListener("pointermove", onPointerMove, { passive: false });
	window.addEventListener("pointerup", onPointerUp);
	window.addEventListener("pointercancel", onPointerCancel);
	window.addEventListener("resize", resize, { passive: true });
	window.addEventListener("dblclick", onDoubleClick);
	window.addEventListener("click", onClick, true);
	window.addEventListener("contextmenu", onContextMenu);
	window.addEventListener("blur", onWindowBlur);

	resize();
	syncHome();
	syncTheme();
	applySettings(settings);
	wake();

	return () => {
		disposed = true;
		if (animationFrame) cancelAnimationFrame(animationFrame);
		window.clearTimeout(clickResetTimer);
		document.documentElement.classList.remove("spotlight-range-adjusting");
		observer.disconnect();
		homeObserver.disconnect();
		window.removeEventListener(DARK_MODE_SPOTLIGHT_CHANGE_EVENT, syncSettings);
		window.removeEventListener("pointerdown", onPointerDown);
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("pointercancel", onPointerCancel);
		window.removeEventListener("resize", resize);
		window.removeEventListener("dblclick", onDoubleClick);
		window.removeEventListener("click", onClick, true);
		window.removeEventListener("contextmenu", onContextMenu);
		window.removeEventListener("blur", onWindowBlur);
		renderer.dispose();
		scene.traverse((object) => {
			if (object instanceof THREE.Mesh) {
				object.geometry.dispose();
				const materials = Array.isArray(object.material)
					? object.material
					: [object.material];
				for (const material of materials) material.dispose();
			}
			if (object instanceof THREE.Sprite) {
				object.material.map?.dispose();
				object.material.dispose();
			}
		});
	};
});
</script>

<div
	bind:this={layer}
	class="dark-mode-spotlight"
	class:is-disabled={!isHome || !isDark || !settings.enabled}
	aria-hidden="true"
>
	<canvas bind:this={canvas} class="dark-mode-spotlight__canvas"></canvas>
	<div class="dark-mode-spotlight__wash"></div>
	<div class="dark-mode-spotlight__vignette"></div>
</div>

<style>
	.dark-mode-spotlight {
		--spotlight-color: #ffb36b;
		--spotlight-range: 76;
		--spotlight-x: 50%;
		--spotlight-y: 48%;
		--spotlight-pool-x: 31vmax;
		--spotlight-pool-y: 19vmax;
		position: fixed;
		inset: 0;
		z-index: 35;
		overflow: hidden;
		pointer-events: none;
		isolation: isolate;
		opacity: 1;
		transition: opacity 420ms ease;
	}

	.dark-mode-spotlight.is-disabled {
		opacity: 0;
	}

	:global(html.is-page-transitioning) .dark-mode-spotlight {
		opacity: 0;
		transition: none;
	}

	.dark-mode-spotlight__canvas,
	.dark-mode-spotlight__wash,
	.dark-mode-spotlight__vignette {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.dark-mode-spotlight__canvas {
		z-index: 3;
	}

	.dark-mode-spotlight__wash {
		z-index: 2;
		background: radial-gradient(
			ellipse var(--spotlight-pool-x) var(--spotlight-pool-y) at var(--spotlight-x) var(--spotlight-y),
			color-mix(in srgb, var(--spotlight-color) 30%, transparent) 0%,
			color-mix(in srgb, var(--spotlight-color) 15%, transparent) 24%,
			color-mix(in srgb, var(--spotlight-color) 4%, transparent) 58%,
			transparent 100%
		);
		filter: blur(1.05rem);
		mix-blend-mode: screen;
		opacity: 0.9;
		transition: background 260ms ease;
	}

	.dark-mode-spotlight__vignette {
		z-index: 1;
		background: radial-gradient(
			ellipse var(--spotlight-pool-x) var(--spotlight-pool-y) at var(--spotlight-x) var(--spotlight-y),
			rgb(0 0 0 / 6%) 0%,
			rgb(0 0 0 / 48%) 42%,
			rgb(0 0 0 / 88%) 80%,
			rgb(0 0 0 / 94%) 100%
		);
		mix-blend-mode: normal;
		opacity: 1;
	}

	@media (max-width: 700px) {
		.dark-mode-spotlight__wash {
			opacity: 0.78;
		}

		.dark-mode-spotlight__vignette {
			background: radial-gradient(
				ellipse var(--spotlight-pool-x) var(--spotlight-pool-y) at var(--spotlight-x) var(--spotlight-y),
				rgb(0 0 0 / 5%) 0%,
				rgb(0 0 0 / 38%) 42%,
				rgb(0 0 0 / 75%) 80%,
				rgb(0 0 0 / 82%) 100%
			);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dark-mode-spotlight {
			transition: none;
		}
	}
</style>

<svelte:head>
	<style>
		html.spotlight-range-adjusting,
		html.spotlight-range-adjusting * {
			cursor: ew-resize !important;
			user-select: none !important;
		}
	</style>
</svelte:head>
