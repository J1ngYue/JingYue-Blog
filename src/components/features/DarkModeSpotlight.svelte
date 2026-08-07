<script lang="ts">
import { onMount } from "svelte";
import * as THREE from "three";
import {
	DARK_MODE_SPOTLIGHT_CHANGE_EVENT,
	type DarkModeSpotlightSettings,
	getDarkModeSpotlightSettings,
	setDarkModeSpotlightSettings,
} from "@/utils/dark-mode-spotlight";

let layer: HTMLDivElement;
let canvas: HTMLCanvasElement;
let settings = $state<DarkModeSpotlightSettings>(
	getDarkModeSpotlightSettings(),
);
let isDark = $state(false);

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
	const fill = new THREE.DirectionalLight(0x9cacc8, 0.2);
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

	const ropeLength = 1.55;
	const fixedStep = 1 / 120;
	const gravity = new THREE.Vector3(0, -9.81, 0);
	let halfWidth = 5;
	let halfHeight = 5;
	let beamLength = 3.8;
	let beamRadius = 1.4;
	let pulling = false;
	let pullPointerId = -1;
	let pullStrength = 0;
	let lastPointerTime = 0;
	let stableFrames = 0;
	let accumulator = 0;
	let animationFrame = 0;
	let lastTime = performance.now();
	let disposed = false;

	anchor.set(0, 4.2, 0.8);
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
		new THREE.Vector2(0.08, 0.08),
		new THREE.Vector2(0.18, 0.02),
		new THREE.Vector2(0.43, -0.1),
		new THREE.Vector2(0.82, -0.25),
		new THREE.Vector2(1.08, -0.36),
		new THREE.Vector2(1.1, -0.41),
	];
	const shadeMaterial = new THREE.MeshStandardMaterial({
		color: 0x101116,
		roughness: 0.34,
		metalness: 0.76,
		side: THREE.DoubleSide,
	});
	const shade = new THREE.Mesh(
		new THREE.LatheGeometry(shadeProfile, 48),
		shadeMaterial,
	);
	shadeGroup.add(shade);

	const rim = new THREE.Mesh(
		new THREE.TorusGeometry(1.095, 0.027, 8, 48),
		new THREE.MeshStandardMaterial({
			color: 0x1b1d24,
			roughness: 0.26,
			metalness: 0.82,
		}),
	);
	rim.rotation.x = Math.PI / 2;
	rim.position.y = -0.397;
	shadeGroup.add(rim);

	const undersideMaterial = new THREE.MeshStandardMaterial({
		color: 0x3a261b,
		emissive: 0xffb36b,
		emissiveIntensity: 0.42,
		roughness: 0.9,
		side: THREE.DoubleSide,
	});
	const underside = new THREE.Mesh(
		new THREE.CircleGeometry(1.055, 48),
		undersideMaterial,
	);
	underside.rotation.x = Math.PI / 2;
	underside.position.y = -0.385;
	shadeGroup.add(underside);

	const connector = new THREE.Mesh(
		new THREE.CylinderGeometry(0.095, 0.12, 0.2, 20),
		new THREE.MeshStandardMaterial({
			color: 0x9c6744,
			roughness: 0.44,
			metalness: 0.66,
		}),
	);
	connector.position.y = 0.08;
	shadeGroup.add(connector);

	const bulbMaterial = new THREE.MeshStandardMaterial({
		color: 0xffd7ad,
		emissive: 0xffb36b,
		emissiveIntensity: 3.2,
		roughness: 0.2,
	});
	const bulb = new THREE.Mesh(
		new THREE.SphereGeometry(0.16, 20, 12),
		bulbMaterial,
	);
	bulb.scale.y = 1.2;
	bulb.position.y = -0.33;
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
	glow.position.y = -0.36;
	glow.scale.set(0.96, 0.96, 0.96);
	shadeGroup.add(glow);

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
				float edge = 1.0 - smoothstep(0.06, 0.5, abs(vUv.x - 0.5));
				float topFade = smoothstep(0.0, 0.18, vUv.y);
				float bottomFade = 1.0 - smoothstep(0.76, 1.0, vUv.y);
				float alpha = edge * topFade * bottomFade * uOpacity;
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
			gradient.addColorStop(0.16, "rgba(255,222,172,.82)");
			gradient.addColorStop(0.46, "rgba(255,170,94,.24)");
			gradient.addColorStop(1, "rgba(255,140,70,0)");
			context.fillStyle = gradient;
			context.fillRect(0, 0, 64, 64);
		}
		const texture = new THREE.CanvasTexture(textureCanvas);
		texture.colorSpace = THREE.SRGBColorSpace;
		return texture;
	}

	function applySettings(next: DarkModeSpotlightSettings) {
		const color = new THREE.Color(next.color);
		const enabled = isDark && next.enabled;
		beamLength = THREE.MathUtils.lerp(2.8, 5.2, (next.range - 40) / 60);
		beamRadius =
			Math.tan(THREE.MathUtils.degToRad(next.angle * 0.5)) * beamLength;
		softBeamMaterial.uniforms.uColor.value.copy(color);
		softBeamMaterial.uniforms.uOpacity.value = enabled
			? 0.16 + next.range / 800
			: 0;
		beam.scale.set(Math.max(0.12, beamRadius * 2), beamLength, 1);
		poolMaterial.color.copy(color);
		poolMaterial.opacity = enabled ? 0.22 + next.range / 300 : 0;
		pool.scale.setScalar(Math.max(1.3, beamRadius * 1.35));
		glowMaterial.color.copy(color);
		glowMaterial.opacity = enabled ? 0.52 + next.range / 420 : 0;
		bulbMaterial.emissive.copy(color);
		bulbMaterial.emissiveIntensity = enabled ? 2.4 + next.range / 26 : 0.04;
		undersideMaterial.color.copy(color).multiplyScalar(0.18);
		undersideMaterial.emissive.copy(color);
		undersideMaterial.emissiveIntensity = enabled
			? 0.22 + next.range / 340
			: 0.03;
		layer.style.setProperty("--spotlight-color", next.color);
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
		anchor.set(0, halfHeight - 0.32, 0.8);
		ceilingCap.position.copy(anchor).add(new THREE.Vector3(0, 0.06, 0));
		if (!pulling) {
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

		if (pulling) {
			lightDirection.copy(aimTarget).sub(position).normalize();
			currentLightDirection.lerp(lightDirection, 0.3).normalize();
		} else {
			lightDirection.copy(DOWN);
			currentLightDirection.lerp(lightDirection, 0.14).normalize();
		}
		lampQuaternion.setFromUnitVectors(DOWN, currentLightDirection);
		lampRoot.position.copy(position);
		lampRoot.quaternion.copy(lampQuaternion);

		beamStart.copy(position).addScaledVector(currentLightDirection, 0.34);
		beamDirection.copy(currentLightDirection).normalize();
		beam.position
			.copy(beamStart)
			.addScaledVector(beamDirection, beamLength * 0.5);
		beamQuaternion.setFromUnitVectors(DOWN, beamDirection);
		beam.quaternion.copy(beamQuaternion);
		beamEnd.copy(beamStart).addScaledVector(beamDirection, beamLength * 0.9);
		pool.position.copy(beamEnd);
	}

	function stepPhysics() {
		const velocity = temp
			.copy(position)
			.sub(previous)
			.multiplyScalar(pulling ? 0.985 : 0.9948);
		previous.copy(position);
		position.add(velocity).addScaledVector(gravity, fixedStep * fixedStep);

		if (pulling) {
			tempB.copy(aimTarget).sub(anchor).normalize();
			tempB.lerp(DOWN, 1 - pullStrength * 0.82).normalize();
			tempC.copy(tempB).multiplyScalar(ropeLength).add(anchor).sub(position);
			ropeDirection.copy(position).sub(anchor).normalize();
			tempC.addScaledVector(ropeDirection, -tempC.dot(ropeDirection));
			position.addScaledVector(tempC, 52 * fixedStep * fixedStep);
		}

		temp.copy(position).sub(anchor);
		if (temp.lengthSq() < 1e-8) temp.copy(DOWN);
		temp.normalize().multiplyScalar(ropeLength);
		position.copy(anchor).add(temp);
		if (pulling) stableFrames = 0;
		else if (position.distanceToSquared(previous) < 0.000000014)
			stableFrames += 1;
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
		if (isDark && settings.enabled && (pulling || stableFrames < 80)) {
			animationFrame = requestAnimationFrame(animate);
		}
	}

	function updatePointerTarget(event: PointerEvent) {
		const rect = layer.getBoundingClientRect();
		const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		const ny = 1 - ((event.clientY - rect.top) / rect.height) * 2;
		aimTarget.set(nx * halfWidth, ny * halfHeight, 0.8);
		const projected = projection.copy(position).project(camera);
		const distanceX = (nx - projected.x) * 0.75;
		const distanceY = ny - projected.y;
		pullStrength = THREE.MathUtils.smoothstep(
			Math.hypot(distanceX, distanceY),
			0.08,
			1.15,
		);
	}

	function pointerNearLamp(event: PointerEvent) {
		const rect = layer.getBoundingClientRect();
		projection.copy(position).project(camera);
		const x = rect.left + ((projection.x + 1) / 2) * rect.width;
		const y = rect.top + ((1 - projection.y) / 2) * rect.height;
		return Math.hypot(event.clientX - x, event.clientY - y) < 130;
	}

	function onPointerDown(event: PointerEvent) {
		if (!isDark || !settings.enabled || event.pointerType === "touch") return;
		if (event.button === 2 && pointerNearLamp(event)) {
			const nextColor = event.shiftKey ? "#8fdcff" : "#c79cff";
			setDarkModeSpotlightSettings({ color: nextColor });
			return;
		}
		if (event.button !== 0 || !pointerNearLamp(event)) return;
		updatePointerTarget(event);
		pulling = true;
		pullPointerId = event.pointerId;
		lastPointerTime = performance.now();
		lastPointerTarget.copy(aimTarget);
		pointerVelocity.set(0, 0, 0);
		wake();
	}

	function onPointerMove(event: PointerEvent) {
		if (!pulling || event.pointerId !== pullPointerId) return;
		updatePointerTarget(event);
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

	function resetMotion() {
		pulling = false;
		pullPointerId = -1;
		pullStrength = 0;
		position.copy(anchor).addScaledVector(DOWN, ropeLength);
		previous.copy(position);
		currentLightDirection.copy(DOWN);
		wake();
	}

	function syncTheme() {
		isDark = document.documentElement.classList.contains("dark");
		applySettings(settings);
		if (!isDark) renderer.clear();
	}

	function syncSettings(event: Event) {
		const next = (event as CustomEvent<DarkModeSpotlightSettings>).detail;
		if (!next || typeof next !== "object") return;
		settings = { ...settings, ...next };
		applySettings(settings);
	}

	function onDoubleClick(event: MouseEvent) {
		if (pointerNearLamp(event as PointerEvent)) resetMotion();
	}

	function onContextMenu(event: MouseEvent) {
		if (pointerNearLamp(event as PointerEvent)) event.preventDefault();
	}

	const observer = new MutationObserver(syncTheme);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});
	window.addEventListener(DARK_MODE_SPOTLIGHT_CHANGE_EVENT, syncSettings);
	window.addEventListener("pointerdown", onPointerDown, { passive: true });
	window.addEventListener("pointermove", onPointerMove, { passive: true });
	window.addEventListener("pointerup", onPointerUp);
	window.addEventListener("pointercancel", onPointerUp);
	window.addEventListener("resize", resize, { passive: true });
	window.addEventListener("dblclick", onDoubleClick);
	window.addEventListener("contextmenu", onContextMenu);

	resize();
	syncTheme();
	applySettings(settings);
	wake();

	return () => {
		disposed = true;
		if (animationFrame) cancelAnimationFrame(animationFrame);
		observer.disconnect();
		window.removeEventListener(DARK_MODE_SPOTLIGHT_CHANGE_EVENT, syncSettings);
		window.removeEventListener("pointerdown", onPointerDown);
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
		window.removeEventListener("pointercancel", onPointerUp);
		window.removeEventListener("resize", resize);
		window.removeEventListener("dblclick", onDoubleClick);
		window.removeEventListener("contextmenu", onContextMenu);
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
	class:is-disabled={!isDark || !settings.enabled}
	style={`--spotlight-color: ${settings.color}; --spotlight-range: ${settings.range};`}
	aria-hidden="true"
>
	<canvas bind:this={canvas} class="dark-mode-spotlight__canvas"></canvas>
	<div class="dark-mode-spotlight__wash"></div>
	<div class="dark-mode-spotlight__vignette"></div>
</div>

<style>
	.dark-mode-spotlight {
		position: fixed;
		inset: 0;
		z-index: 6;
		overflow: hidden;
		pointer-events: none;
		isolation: isolate;
		opacity: 1;
		transition: opacity 420ms ease;
	}

	.dark-mode-spotlight.is-disabled {
		opacity: 0;
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
		z-index: 2;
	}

	.dark-mode-spotlight__wash {
		z-index: 1;
		background:
			radial-gradient(
				ellipse at 50% 84%,
				color-mix(in srgb, var(--spotlight-color) 12%, transparent),
				transparent calc(27% + (100 - var(--spotlight-range)) * 0.08%)
			),
			radial-gradient(
				ellipse at 50% 12%,
				color-mix(in srgb, var(--spotlight-color) 5%, transparent),
				transparent 54%
			);
		filter: blur(1.5rem);
		mix-blend-mode: screen;
		opacity: 0.9;
		transition: background 260ms ease;
	}

	.dark-mode-spotlight__vignette {
		z-index: 3;
		background: radial-gradient(ellipse at center, transparent 42%, rgb(0 0 0 / 20%) 100%);
		mix-blend-mode: multiply;
		opacity: 0.72;
	}

	@media (max-width: 700px) {
		.dark-mode-spotlight__wash {
			opacity: 0.72;
		}

		.dark-mode-spotlight__vignette {
			opacity: 0.5;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.dark-mode-spotlight {
			transition: none;
		}
	}
</style>
