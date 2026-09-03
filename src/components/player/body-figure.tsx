"use client";

/**
 * The clay athlete in three.js: one continuous surface, painted per region by
 * what has happened to that region this season. Hover (or focus a chip) lights
 * one region and nothing else. Drag turns him; the front/back buttons turn him
 * for you. Every motion starts from where he is now and can be interrupted.
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Html, Lightformer } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { Injury } from "@/lib/types";

import { opaque, type SceneTokens } from "@/components/three/tokens";
import { PARTS, partKey, type Part } from "./body-geometry";
import { buildBodyMesh, type BodyMesh } from "./body-mesh";
import { REGION_LABEL, daysOut, formatMonthYear } from "./labels";

/** Cumulative days out drives the tint. Three steps, so a knock never reads like a cruciate. */
export function tintStep(days: number): 0 | 1 | 2 | 3 {
  if (days <= 0) return 0;
  if (days < 14) return 1;
  if (days < 42) return 2;
  return 3;
}
const TINT = [0, 0.35, 0.6, 0.85];

export type Mark = {
  key: string;
  part: Part;
  own: Injury[];
  current: Injury | null;
  step: 0 | 1 | 2 | 3;
  days: number;
};

/**
 * Injuries that belong to one part. A `central` injury on a two-sided region
 * marks both sides rather than disappearing.
 */
export function marksFor(injuries: Injury[], asOf: string): Mark[] {
  return PARTS.map((part) => {
    const own = part.region
      ? injuries.filter(
          (i) =>
            i.body_region === part.region &&
            (i.side === part.side || i.side === "central" || part.side === "central"),
        )
      : [];
    const current = own.find((i) => i.resolved_on === null) ?? null;
    const days = own.reduce((t, i) => t + daysOut(i, asOf), 0);
    return { key: partKey(part), part, own, current, step: tintStep(days), days };
  });
}

/** A palette in linear colour, built once per token set. */
function usePalette(t: SceneTokens) {
  return useMemo(
    () => ({
      skin: new THREE.Color(opaque(t.skin)),
      skinHi: new THREE.Color(opaque(t.skinHi)),
      out: new THREE.Color(opaque(t.out)),
      ink: new THREE.Color(opaque(t.ink)),
    }),
    [t],
  );
}

function Figure({
  mesh,
  marks,
  t,
  hovered,
  reduced,
  asOf,
  onHover,
}: {
  mesh: BodyMesh;
  marks: Map<string, Mark>;
  t: SceneTokens;
  hovered: string | null;
  reduced: boolean;
  asOf: string;
  onHover: (key: string | null) => void;
}) {
  const pal = usePalette(t);
  const meshRef = useRef<THREE.Mesh>(null);

  // rest colour per part, from the season: skin, or skin pulled toward red by days out
  const rest = useMemo(
    () =>
      mesh.parts.map((p) => {
        const m = marks.get(p.key);
        if (!m || m.own.length === 0) return pal.skin.clone();
        if (m.current) return pal.out.clone();
        return pal.skin.clone().lerp(pal.out, TINT[m.step]);
      }),
    [mesh, marks, pal],
  );
  const live = useMemo(() => mesh.parts.map((p) => (marks.get(p.key)?.own.length ?? 0) > 0), [mesh, marks]);
  const current = useMemo(() => mesh.parts.map((p) => Boolean(marks.get(p.key)?.current)), [mesh, marks]);

  // the colour each part is showing right now; glides toward its target every frame
  const shown = useMemo(() => rest.map((c) => c.clone()), [rest]);
  // the first frame after a change paints every part, whether or not anything has moved
  const painted = useRef(false);
  useEffect(() => {
    painted.current = false;
  }, [rest]);
  const target = useMemo(() => new THREE.Color(), []);
  const hot = useMemo(() => pal.out.clone().lerp(pal.ink, 0.3), [pal]);

  useFrame(({ clock }, dt) => {
    const geom = meshRef.current?.geometry;
    if (!geom) return;
    const colour = geom.getAttribute("color") as THREE.BufferAttribute;
    const arr = colour.array as Float32Array;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 14);
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4);
    let dirty = false;
    for (let p = 0; p < mesh.parts.length; p += 1) {
      const isHover = hovered === mesh.parts[p].key;
      if (isHover) target.copy(live[p] ? rest[p] : pal.skinHi).lerp(pal.skinHi, live[p] ? 0.35 : 1);
      else if (current[p]) target.copy(rest[p]).lerp(hot, 0.35 * pulse);
      else target.copy(rest[p]);
      const c = shown[p];
      const still = Math.abs(c.r - target.r) + Math.abs(c.g - target.g) + Math.abs(c.b - target.b) < 0.002;
      if (still && painted.current) continue;
      c.lerp(target, k);
      const verts = mesh.partVerts[p];
      for (let i = 0; i < verts.length; i += 1) {
        const o = verts[i] * 3;
        arr[o] = c.r;
        arr[o + 1] = c.g;
        arr[o + 2] = c.b;
      }
      dirty = true;
    }
    if (dirty) colour.needsUpdate = true;
    painted.current = true;
  });

  const partAt = (e: ThreeEvent<PointerEvent>) => {
    const a = e.face?.a;
    if (a === undefined) return null;
    return mesh.parts[mesh.vertexPart[a]];
  };

  const hoveredPart = hovered ? mesh.parts.find((p) => p.key === hovered) ?? null : null;
  const hoveredMark = hovered ? marks.get(hovered) ?? null : null;
  const label = hoveredPart?.region ? REGION_LABEL[hoveredPart.region] : "";
  const sideNote = hoveredPart && hoveredPart.side !== "central" ? ` · ${hoveredPart.side}` : "";

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={mesh.geometry}
        onPointerMove={(e) => {
          e.stopPropagation();
          const p = partAt(e);
          const key = p?.region ? p.key : null;
          if (key !== hovered) onHover(key);
          document.body.style.cursor = key && (marks.get(key)?.own.length ?? 0) > 0 ? "pointer" : "default";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "";
        }}
      >
        <meshPhysicalMaterial
          vertexColors
          roughness={0.46}
          metalness={0}
          clearcoat={0.55}
          clearcoatRoughness={0.32}
          envMapIntensity={1.35}
        />
      </mesh>
      {hoveredPart && hoveredMark && hoveredPart.region ? (
        <Html position={hoveredPart.centre} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div
            role="tooltip"
            className="min-w-44 max-w-60 -translate-x-1/2 -translate-y-[calc(100%+14px)] border border-line-strong bg-panel px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
          >
            <p className="whitespace-nowrap text-[12px] font-bold lowercase text-ink">
              {label}
              <span className="font-normal text-ink-dim">{sideNote}</span>
            </p>
            {hoveredMark.own.length === 0 ? (
              <p className="mt-1 text-[11px] text-ink-dim">no injuries this season</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {hoveredMark.own.map((i) => (
                  <li key={i.id} className="num text-[11px] leading-tight text-ink-dim">
                    {i.severity} · {formatMonthYear(i.occurred_on)} · {daysOut(i, asOf)} days
                    {i.resolved_on === null ? <span className="text-out"> · ongoing</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Html>
      ) : null}
    </>
  );
}

function Rig({
  yawTarget,
  reduced,
  children,
}: {
  yawTarget: React.MutableRefObject<number>;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 1.02, 4.1);
    camera.lookAt(0, 0.9, 0);
  }, [camera]);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (reduced) {
      g.rotation.y = yawTarget.current;
      return;
    }
    // critically damped: response ~0.35s, no overshoot, from the live value
    const k = 1 - Math.exp(-dt * 9);
    g.rotation.y += (yawTarget.current - g.rotation.y) * k;
  });
  return <group ref={group}>{children}</group>;
}

export type BodyFigureProps = {
  injuries: Injury[];
  asOf: string;
  tokens: SceneTokens;
  reduced: boolean;
  hovered: string | null;
  onHover: (key: string | null) => void;
  yawTarget: React.MutableRefObject<number>;
};

export default function BodyFigure({ injuries, asOf, tokens: t, reduced, hovered, onHover, yawTarget }: BodyFigureProps) {
  const marks = useMemo(() => {
    const byKey = new Map<string, Mark>();
    for (const m of marksFor(injuries, asOf)) if (!byKey.has(m.key)) byKey.set(m.key, m);
    return byKey;
  }, [injuries, asOf]);
  // built once per mount: ~a quarter second of geometry, then it is just a mesh
  const mesh = useMemo(() => buildBodyMesh(), []);
  useEffect(() => () => mesh.geometry.dispose(), [mesh]);

  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }} camera={{ fov: 30, near: 0.1, far: 50 }}>
      {/* a small studio, no files: one soft key, a fill, a mint rim, a turf bounce off the floor */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3.2} position={[2.4, 3.4, 3.2]} scale={[3, 3, 1]} target={[0, 1, 0]} color={opaque(t.ink)} />
        <Lightformer form="rect" intensity={0.8} position={[-3.2, 1.6, 1.6]} scale={[2, 4, 1]} target={[0, 1, 0]} color={opaque(t.ink)} />
        <Lightformer form="ring" intensity={3.2} position={[0.4, 2.4, -4]} scale={2.4} target={[0, 1, 0]} color={opaque(t.mint)} />
        <Lightformer form="rect" intensity={0.4} position={[0, -2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[6, 6, 1]} color={opaque(t.turf2)} />
      </Environment>
      <directionalLight position={[2.2, 3.4, 3.0]} intensity={1.1} color={opaque(t.ink)} />
      <Rig yawTarget={yawTarget} reduced={reduced}>
        <Figure mesh={mesh} marks={marks} t={t} hovered={hovered} reduced={reduced} asOf={asOf} onHover={onHover} />
        <ContactShadows position={[0, 0.002, 0]} opacity={0.75} scale={1.7} blur={2.4} far={1.4} resolution={512} frames={1} color={opaque(t.pitch)} />
      </Rig>
    </Canvas>
  );
}
