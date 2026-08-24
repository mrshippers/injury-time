"use client";

/**
 * The figure in three.js: one smooth mesh per part, coloured by what has
 * happened to that part this season. Hover (or focus a chip) lights one
 * region and nothing else. Drag turns him; the front/back buttons turn him
 * for you. Every motion starts from where he is now and can be interrupted.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { Injury } from "@/lib/types";

import { opaque, type SceneTokens } from "@/components/three/tokens";
import { PARTS, partKey, type Part, type Shape } from "./body-geometry";
import { REGION_LABEL, daysOut, formatMonthYear } from "./labels";

/** Cumulative days out drives the tint. Three steps, so a knock never reads like a cruciate. */
export function tintStep(days: number): 0 | 1 | 2 | 3 {
  if (days <= 0) return 0;
  if (days < 14) return 1;
  if (days < 42) return 2;
  return 3;
}
const TINT = [0, 0.35, 0.6, 0.85];

/** Front or back half of a capsule, lathed so the flat face is exactly on z = 0. */
function halfCapsule(r: number, len: number, face: "front" | "back"): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const seg = 10;
  for (let i = 0; i <= seg; i += 1) {
    const a = -Math.PI / 2 + (i / seg) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * r, -len / 2 + Math.sin(a) * r));
  }
  for (let i = 0; i <= seg; i += 1) {
    const a = (i / seg) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(a) * r, len / 2 + Math.sin(a) * r));
  }
  // lathe sweeps +x through +z to -x for phi 0..PI; rotate so it faces +z or -z
  const g = new THREE.LatheGeometry(pts, 28, 0, Math.PI);
  g.rotateY(face === "front" ? -Math.PI / 2 : Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function geometryFor(s: Shape): THREE.BufferGeometry {
  switch (s.kind) {
    case "sphere": {
      const g = new THREE.SphereGeometry(s.r, 40, 28);
      if (s.scale) g.scale(...s.scale);
      return g;
    }
    case "capsule": {
      const g = new THREE.CapsuleGeometry(s.r, s.len, 8, 28);
      if (s.tilt) {
        g.rotateX(s.tilt[0]);
        g.rotateY(s.tilt[1]);
        g.rotateZ(s.tilt[2]);
      }
      return g;
    }
    case "half": {
      const g = halfCapsule(s.r, s.len, s.face);
      if (s.scale) g.scale(...s.scale);
      return g;
    }
  }
}

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

function PartMesh({
  mark,
  t,
  hovered,
  reduced,
  asOf,
  onHover,
}: {
  mark: Mark;
  t: SceneTokens;
  hovered: boolean;
  reduced: boolean;
  asOf: string;
  onHover: (key: string | null) => void;
}) {
  const geometry = useMemo(() => geometryFor(mark.part.shape), [mark.part.shape]);
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const live = mark.own.length > 0;

  const { current: liveInjury, step } = mark;
  const base = useMemo(() => {
    const skin = new THREE.Color(opaque(t.skin));
    if (liveInjury) return new THREE.Color(opaque(t.out));
    if (step > 0) return skin.clone().lerp(new THREE.Color(opaque(t.out)), TINT[step]);
    return skin;
  }, [t, liveInjury, step]);
  const hi = useMemo(() => new THREE.Color(opaque(t.skinHi)), [t]);
  const mint = useMemo(() => new THREE.Color(opaque(t.mint)), [t]);
  const out = useMemo(() => new THREE.Color(opaque(t.out)), [t]);

  // colour and emissive glide toward their targets every frame: a hover that
  // ends halfway through just turns around, no snap either way
  useFrame(({ clock }, dt) => {
    const m = material.current;
    if (!m) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 16);
    const targetColour = hovered ? (live ? base.clone().lerp(hi, 0.35) : hi) : base;
    m.color.lerp(targetColour, k);
    const pulse = mark.current && !reduced ? 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.6)) : mark.current ? 0.35 : 0;
    const targetEm = hovered ? 0.45 : pulse;
    m.emissive.lerp(hovered ? (live ? out : mint) : out, k);
    m.emissiveIntensity += (targetEm - m.emissiveIntensity) * k;
  });

  const [x, y, z] = mark.part.pos;
  const label = mark.part.region ? REGION_LABEL[mark.part.region] : "";
  const sideNote = mark.part.side !== "central" ? ` · ${mark.part.side}` : "";

  return (
    <mesh
      geometry={geometry}
      position={[x, y, z]}
      castShadow
      onPointerOver={(e) => {
        if (!mark.part.region) return;
        e.stopPropagation();
        onHover(mark.key);
        document.body.style.cursor = live ? "pointer" : "default";
      }}
      onPointerOut={() => {
        onHover(null);
        document.body.style.cursor = "";
      }}
    >
      <meshStandardMaterial ref={material} color={base} roughness={0.55} metalness={0.0} emissive={out} emissiveIntensity={0} />
      {hovered && mark.part.region ? (
        <Html position={[0, 0, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div
            role="tooltip"
            className="min-w-44 max-w-60 -translate-x-1/2 -translate-y-[calc(100%+14px)] border border-line-strong bg-panel px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
          >
            <p className="whitespace-nowrap text-[12px] font-bold lowercase text-ink">
              {label}
              <span className="font-normal text-ink-dim">{sideNote}</span>
            </p>
            {mark.own.length === 0 ? (
              <p className="mt-1 text-[11px] text-ink-dim">no injuries this season</p>
            ) : (
              <ul className="mt-1.5 space-y-1">
                {mark.own.map((i) => (
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
    </mesh>
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
    camera.position.set(0, 1.05, 4.0);
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
  const marks = useMemo(() => marksFor(injuries, asOf), [injuries, asOf]);
  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }} camera={{ fov: 31, near: 0.1, far: 50 }}>
      {/* soft studio: a warm-ish key from the front-right, a cool rim from behind, sky fill */}
      <hemisphereLight args={[opaque(t.ink), opaque(t.pitch), 1.1]} />
      <directionalLight position={[2.2, 3.4, 3.0]} intensity={2.1} />
      <directionalLight position={[-3, 2.0, 1.5]} intensity={0.7} />
      <directionalLight position={[0, 2.2, -3.5]} intensity={1.2} color={opaque(t.mint)} />
      <Rig yawTarget={yawTarget} reduced={reduced}>
        {marks.map((m, i) => (
          <PartMesh key={`${m.key}-${i}`} mark={m} t={t} hovered={hovered === m.key} reduced={reduced} asOf={asOf} onHover={onHover} />
        ))}
        {/* a soft pool under the feet so he stands on something */}
        <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.42, 40]} />
          <meshBasicMaterial color={opaque(t.pitch)} transparent opacity={0.55} />
        </mesh>
      </Rig>
    </Canvas>
  );
}
