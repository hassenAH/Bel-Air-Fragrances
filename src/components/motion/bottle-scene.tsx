"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor, Sparkles, useGLTF } from "@react-three/drei";
import { HERO_BG } from "@/lib/config";

const MODEL_URL = "/models/parfum.glb";
const DRACO_URL = "/draco/"; // decoder is served from /public, no CDN needed

useGLTF.preload(MODEL_URL, DRACO_URL);

// Blender stores colours in linear space; three's Color(hex) is sRGB. Convert explicitly.
const lin = (r: number, g: number, b: number) =>
  new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);

// Blender units -> scene units (the GLB was scaled so the whole bottle is 2.6 tall).
const UNIT = 0.29375;

/** The label plate has no texture in the supplied file: map it flat (x,y -> u,v) and draw the brand on it. */
function brandLabel(mesh: THREE.Mesh, brand: string) {
  const geo = mesh.geometry as THREE.BufferGeometry;
  const pos = geo.attributes.position;
  geo.computeBoundingBox();
  const b = geo.boundingBox!;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - b.min.x) / (b.max.x - b.min.x || 1);
    uv[i * 2 + 1] = (pos.getY(i) - b.min.y) / (b.max.y - b.min.y || 1);
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f6f0e4";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "#1c1917";
  ctx.lineWidth = 8;
  ctx.strokeRect(22, 22, 468, 468);
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, 440, 440);
  ctx.fillStyle = "#1c1917";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Any brand name: wrap into lines and shrink the type until the block fits inside the frame.
  const words = brand.toUpperCase().split(/\s+/).filter(Boolean);
  const maxWidth = 400;
  let size = 72;
  let lines: string[] = [];
  for (; size >= 30; size -= 4) {
    ctx.font = `500 ${size}px Georgia, serif`;
    lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (!line || ctx.measureText(test).width <= maxWidth) line = test;
      else {
        lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    const fits = lines.every((l) => ctx.measureText(l).width <= maxWidth) && lines.length * size * 1.18 <= 250;
    if (fits) break;
  }
  const lineHeight = size * 1.18;
  lines.forEach((l, i) => ctx.fillText(l, 256, 235 + (i - (lines.length - 1) / 2) * lineHeight, maxWidth));
  ctx.font = "26px Georgia, serif";
  ctx.fillStyle = "#6b5b3e";
  ctx.fillText("EAU DE PARFUM", 256, 420);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  mesh.material = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 });
}

/**
 * Materials recreated from the Cycles node trees in the supplied .blend:
 *  - Glass: refraction IOR 1.4-1.5 (+ dispersion), amber volume absorption (0.80, 0.71, 0.40) density 2.5
 *  - Liquid: Principled colour (1.0, 0.533, 0.0), roughness 0, IOR 1.5
 *  - Gold: Voronoi-driven ramps; mean colour (0.82, 0.28, 0.003), metallic ~0.9, roughness ~0.18
 *  - Plastic (spray tip): black, glossy
 */
function makeMaterials(lite: boolean) {
  // Lite mode (slow devices): plain see-through glass instead of refractive "transmission",
  // which needs an extra render pass of the whole scene every frame.
  const glass = lite
    ? new THREE.MeshPhysicalMaterial({
        color: "#fff6e6",
        transparent: true,
        opacity: 0.22,
        roughness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 2,
        depthWrite: false,
      })
    : new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        transmission: 1,
        ior: 1.5,
        roughness: 0,
        thickness: 0.3,
        dispersion: 0.4,
        attenuationColor: lin(0.801, 0.706, 0.401),
        attenuationDistance: (1 / 2.5) * UNIT * 2, // absorption density 2.5 per Blender unit
        envMapIntensity: 1.6,
      });
  // three.js transmissive materials can't see each other, so the liquid inside the glass is
  // drawn opaque (with the same colour and a glossy coat) and shows through the glass shell.
  const liquid = new THREE.MeshPhysicalMaterial({
    color: lin(1.0, 0.533, 0.0),
    roughness: 0,
    ior: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0,
    emissive: lin(0.55, 0.2, 0.0),
    emissiveIntensity: 0.6,
    envMapIntensity: 1.2,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: lin(0.824, 0.275, 0.003),
    metalness: 0.9,
    roughness: 0.18,
    envMapIntensity: 1.8,
  });
  const plastic = new THREE.MeshStandardMaterial({
    color: lin(0.005, 0.005, 0.005),
    roughness: 0.35,
    envMapIntensity: 1,
  });
  const tube = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    transparent: true,
    opacity: 0.3,
    roughness: 0.1,
    depthWrite: false,
  });
  return { glass, liquid, gold, plastic, tube };
}

const MODEL_HEIGHT = 2.6; // the GLB is normalised to this height (see tools/convert-blend.py)
const MODEL_WIDTH = 1.6;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (x: number) => x * x * (3 - 2 * x);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/** Soft round gradient used for the golden halo and the floor shadow. */
function radialTexture(rgb: string, centerAlpha: number) {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${centerAlpha})`);
  g.addColorStop(0.45, `rgba(${rgb},${centerAlpha * 0.35})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * One bottle, two homes. The page has two empty "slots" (data-bottle-slot="hero" and "about").
 * Every frame this measures where they are on the PAGE and moves the bottle between them as the
 * visitor scrolls: it leaves the hero, spins once, lands in the About frame and then scrolls away
 * with it. Measuring live (not once) keeps it glued to the slots through animations and resizes.
 */
function Rig({
  brand,
  stageRef,
  onReady,
  level,
}: {
  brand: string;
  stageRef: RefObject<HTMLElement | null>;
  onReady: () => void;
  /** 0 = full quality, 1 = cheaper (no sparkles), 2 = lite (simple glass). Set by the performance monitor. */
  level: number;
}) {
  const { scene } = useGLTF(MODEL_URL, DRACO_URL);
  const lite = level >= 2;

  const { model, offset } = useMemo(() => {
    const clone = scene.clone(true);
    const mats = makeMaterials(lite);
    clone.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const name = (mesh.material as THREE.Material).name as keyof typeof mats | "label";
      if (name === "label") brandLabel(mesh, brand);
      else if (name in mats) mesh.material = mats[name];
    });
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    return { model: clone, offset: box.getCenter(new THREE.Vector3()).negate() };
  }, [scene, brand, lite]);

  const glowTex = useMemo(() => radialTexture("217,150,50", 0.75), []);
  const shadowTex = useMemo(() => radialTexture("60,40,20", 0.6), []);

  const root = useRef<THREE.Group>(null); // position + scale
  const spinner = useRef<THREE.Group>(null); // rotation
  const halo = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const sparkles = useRef<THREE.Group>(null);
  const slots = useRef<{ hero: HTMLElement | null; about: HTMLElement | null }>({ hero: null, about: null });
  const pointer = useRef({ x: 0, y: 0 });
  const yaw = useRef(0);
  const clock = useRef(0);
  const intro = useRef(0);

  useEffect(() => {
    onReady();
  }, [onReady]);

  // The canvas never receives pointer events (it sits behind the page text), so track the mouse on the window.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    clock.current += dt;
    const stage = stageRef.current;
    const group = root.current;
    const spin = spinner.current;
    if (!stage || !group || !spin) return;

    if (!slots.current.hero) slots.current.hero = stage.querySelector<HTMLElement>('[data-bottle-slot="hero"]');
    if (!slots.current.about) slots.current.about = stage.querySelector<HTMLElement>('[data-bottle-slot="about"]');
    const heroEl = slots.current.hero;
    if (!heroEl) return;
    const aboutEl = slots.current.about ?? heroEl; // no About slot: the bottle just stays in the hero

    // Where things are, in pixels. Page space = viewport position + scroll.
    const canvasRect = state.gl.domElement.getBoundingClientRect();
    const sy = window.scrollY;
    const vh = window.innerHeight;
    const hr = heroEl.getBoundingClientRect();
    const ar = aboutEl.getBoundingClientRect();
    const hx = hr.left + hr.width / 2;
    const hy = hr.top + hr.height / 2 + sy;
    const ax = ar.left + ar.width / 2;
    const ay = ar.top + ar.height / 2 + sy;

    // Travel progress: starts as soon as you scroll, ends when the About frame is mid-screen.
    const start = Math.max(0, hy - vh * 0.6);
    const end = Math.max(start + 250, ay - vh * 0.5);
    const t = clamp01((sy - start) / (end - start));
    const te = easeInOut(t);

    // Position (in page space, so it lands exactly on the slot and then scrolls away with it).
    const px = THREE.MathUtils.lerp(hx, ax, te);
    const py = THREE.MathUtils.lerp(hy, ay, te) - sy;
    const cam = state.camera as THREE.PerspectiveCamera;
    const visibleH = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z;
    const wpp = visibleH / state.size.height; // world units per CSS pixel at the bottle's depth
    const cx = px - canvasRect.left;
    const cy = py - canvasRect.top;
    group.position.set((cx - state.size.width / 2) * wpp, -(cy - state.size.height / 2) * wpp, 0);

    // Size: fill ~86% of whichever slot it is in, blended along the way, with a small fly-by "pop".
    const fit = (r: DOMRect) => Math.min((r.height * 0.86) / MODEL_HEIGHT, (r.width * 0.9) / MODEL_WIDTH) * wpp;
    intro.current = Math.min(1, intro.current + dt / 1.2);
    const introE = 1 - Math.pow(1 - intro.current, 3);
    const scale = THREE.MathUtils.lerp(fit(hr), fit(ar), te) * (1 + 0.16 * Math.sin(Math.PI * t)) * (0.86 + 0.14 * introE);
    group.scale.setScalar(Math.max(scale, 0.0001));

    // Rotation: gentle sway in the hero, one full turn in flight, a calm three-quarter pose in the frame.
    const swayHero = Math.sin(clock.current * 0.55) * 0.5;
    const swayAbout = -0.3 + Math.sin(clock.current * 0.6) * 0.16;
    const base = THREE.MathUtils.lerp(swayHero, swayAbout, te) + pointer.current.x * THREE.MathUtils.lerp(0.45, 0.25, te);
    yaw.current = THREE.MathUtils.damp(yaw.current, base + Math.PI * 2 * te, 5, dt);
    spin.rotation.set(
      THREE.MathUtils.damp(spin.rotation.x, -pointer.current.y * 0.12, 4, dt),
      yaw.current,
      Math.sin(Math.PI * t) * 0.22, // banks a little while flying
    );
    spin.position.y = Math.sin(clock.current * 1.2) * 0.04; // idle float

    // Arrival effects: golden halo and sparkles grow in as it lands.
    const arrive = smooth(clamp01((t - 0.65) / 0.35));
    const haloMat = halo.current?.material as THREE.MeshBasicMaterial | undefined;
    if (haloMat) haloMat.opacity = 0.9 * arrive;
    if (halo.current) halo.current.scale.setScalar(0.75 + 0.25 * arrive + Math.sin(clock.current * 1.4) * 0.02);
    sparkles.current?.scale.setScalar(Math.max(0.001, arrive));
    const shadowMat = shadow.current?.material as THREE.MeshBasicMaterial | undefined;
    if (shadowMat) shadowMat.opacity = 0.35 * introE;
  });

  return (
    <group ref={root}>
      <mesh ref={halo} position={[0, 0, -0.8]}>
        <planeGeometry args={[5.6, 5.6]} />
        <meshBasicMaterial map={glowTex} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={shadow} position={[0, -1.55, -0.3]} scale={[1.7, 0.26, 1]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial map={shadowTex} transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={sparkles} scale={0.001}>
        {level === 0 && <Sparkles count={70} scale={[2.6, 3.6, 1.8]} size={5} speed={0.35} opacity={1} color="#c8962e" />}
      </group>
      <group ref={spinner}>
        <primitive object={model} position={offset} />
      </group>
    </group>
  );
}

export default function BottleScene({
  brand,
  active,
  onReady,
  stageRef,
}: {
  brand: string;
  active: boolean;
  onReady: () => void;
  stageRef: RefObject<HTMLElement | null>;
}) {
  // Quality adapts to the device: if frames are slow the monitor steps down (and never back up, to avoid flicker).
  // ?3d=lite in the address bar starts in the lightest mode (handy for testing).
  const [level, setLevel] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("3d") === "lite" ? 2 : 0,
  );
  const stepDown = useCallback(() => setLevel((l) => Math.min(2, l + 1)), []);

  return (
    <Canvas
      dpr={level === 0 ? [1, 1.5] : level === 1 ? 1 : 0.75}
      camera={{ position: [0, 0, 8], fov: 30 }}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.transmissionResolutionScale = 0.6; // glass samples a smaller buffer: much cheaper
      }}
      frameloop={active ? "always" : "never"}
      aria-label={`3D ${brand} perfume bottle`}
    >
      {/* Opaque, same colour as the stage: transmissive glass needs a real backdrop to refract. */}
      <color attach="background" args={[HERO_BG]} />
      {/* Procedural studio lighting: no HDR download needed. */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={5} position={[0, 4, 3]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={3} position={[-5, 0, 2]} rotation-y={Math.PI / 2} scale={[6, 4, 1]} />
        <Lightformer form="rect" intensity={3} position={[5, 1, 2]} rotation-y={-Math.PI / 2} scale={[6, 4, 1]} />
        <Lightformer form="ring" intensity={2} color="#ffd9a0" position={[0, 0, -4]} scale={4} />
      </Environment>
      <PerformanceMonitor onDecline={stepDown} />
      <Suspense fallback={null}>
        <Rig brand={brand} stageRef={stageRef} onReady={onReady} level={level} />
      </Suspense>
    </Canvas>
  );
}
