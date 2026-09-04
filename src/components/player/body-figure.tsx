"use client";

/**
 * The athlete in three.js: the BodyApps base body, morphed to the player's
 * own measurements, painted per region by what has happened to that region
 * this season. Hover (or focus a chip) lights one region and nothing else.
 * Drag turns him; the front/back buttons turn him for you. Every motion
 * starts from where he is now and can be interrupted. If the asset cannot be
 * fetched the clay sculpt stands in, with the same regions.
 */
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Html, Lightformer } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { loadBodyAsset } from "@/lib/body/asset";
import { DEFAULT_ATHLETE, MORPHS, figureScale, influencesFor } from "@/lib/body/params";
import type { RegionMap } from "@/lib/body/regions";
import type { BodyParams, Injury } from "@/lib/types";

import { opaque, type SceneTokens } from "@/components/three/tokens";
import { PARTS, partKey, type Part } from "./body-geometry";
import { buildBodyMesh } from "./body-mesh";
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

/** What the figure is drawn from: the loaded body, or the sculpt if it never arrived. */
type Surface = { geometry: THREE.BufferGeometry; regions: RegionMap; parametric: boolean };

function useSurface(): Surface | null {
  const [surface, setSurface] = useState<Surface | null>(null);
  useEffect(() => {
    let on = true;
    loadBodyAsset()
      .then((a) => {
        if (on) setSurface({ geometry: a.geometry, regions: a.regions, parametric: true });
      })
      .catch(() => {
        if (!on) return;
        const m = buildBodyMesh();
        setSurface({
          geometry: m.geometry,
          regions: { vertexPart: m.vertexPart, parts: m.parts, partVerts: m.partVerts, vertexCount: m.vertexCount },
          parametric: false,
        });
      });
    return () => {
      on = false;
    };
  }, []);
  return surface;
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
  surface,
  marks,
  t,
  hovered,
  reduced,
  asOf,
  params,
  onHover,
}: {
  surface: Surface;
  marks: Map<string, Mark>;
  t: SceneTokens;
  hovered: string | null;
  reduced: boolean;
  asOf: string;
  params: BodyParams | null;
  onHover: (key: string | null) => void;
}) {
  const pal = usePalette(t);
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const { regions, geometry, parametric } = surface;

  // rest colour per part, from the season: skin, or skin pulled toward red by days out
  const rest = useMemo(
    () =>
      regions.parts.map((p) => {
        const m = marks.get(p.key);
        if (!m || m.own.length === 0) return pal.skin.clone();
        if (m.current) return pal.out.clone();
        return pal.skin.clone().lerp(pal.out, TINT[m.step]);
      }),
    [regions, marks, pal],
  );
  const live = useMemo(() => regions.parts.map((p) => (marks.get(p.key)?.own.length ?? 0) > 0), [regions, marks]);
  const current = useMemo(() => regions.parts.map((p) => Boolean(marks.get(p.key)?.current)), [regions, marks]);

  // the colour each part is showing right now; glides toward its target every frame
  const shown = useMemo(() => rest.map((c) => c.clone()), [rest]);
  const painted = useRef(false);
  useEffect(() => {
    painted.current = false;
  }, [rest, geometry]);
  const target = useMemo(() => new THREE.Color(), []);
  const hot = useMemo(() => pal.out.clone().lerp(pal.ink, 0.3), [pal]);

  // measurements: influences and the height scale glide too
  const influenceTarget = useMemo(() => (parametric ? influencesFor(params) : []), [parametric, params]);
  const scaleTarget = useMemo(() => (parametric ? figureScale(params) : 1), [parametric, params]);
  const scaleRest = useMemo(() => (parametric ? figureScale(DEFAULT_ATHLETE) : 1), [parametric]);

  useFrame(({ clock }, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const k = reduced ? 1 : 1 - Math.exp(-dt * 14);

    if (parametric) {
      if (!mesh.morphTargetInfluences || mesh.morphTargetInfluences.length !== MORPHS.length) mesh.updateMorphTargets();
      const inf = mesh.morphTargetInfluences;
      if (inf) {
        const km = reduced ? 1 : 1 - Math.exp(-dt * 10);
        for (let i = 0; i < inf.length; i += 1) inf[i] += (influenceTarget[i] - inf[i]) * km;
      }
      const g = groupRef.current;
      if (g) {
        const s = g.scale.x + (scaleTarget - g.scale.x) * (reduced ? 1 : 1 - Math.exp(-dt * 10));
        g.scale.setScalar(s);
      }
    }

    const colour = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    const arr = colour.array as Float32Array;
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4);
    let dirty = false;
    for (let p = 0; p < regions.parts.length; p += 1) {
      const isHover = hovered === regions.parts[p].key;
      if (isHover) target.copy(live[p] ? rest[p] : pal.skinHi).lerp(pal.skinHi, live[p] ? 0.35 : 1);
      else if (current[p]) target.copy(rest[p]).lerp(hot, 0.35 * pulse);
      else target.copy(rest[p]);
      const c = shown[p];
      const still = Math.abs(c.r - target.r) + Math.abs(c.g - target.g) + Math.abs(c.b - target.b) < 0.002;
      if (still && painted.current) continue;
      c.lerp(target, k);
      const verts = regions.partVerts[p];
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
    return regions.parts[regions.vertexPart[a]];
  };

  const hoveredPart = hovered ? regions.parts.find((p) => p.key === hovered) ?? null : null;
  const hoveredMark = hovered ? marks.get(hovered) ?? null : null;
  const label = hoveredPart?.region ? REGION_LABEL[hoveredPart.region] : "";
  const sideNote = hoveredPart && hoveredPart.side !== "central" ? ` · ${hoveredPart.side}` : "";
  // the sculpt's centres are in the 1.80 m frame; the group is scaled from the model's 1.60 m base
  const anchor = (c: [number, number, number]): [number, number, number] =>
    parametric ? [c[0] / scaleRest, c[1] / scaleRest, c[2] / scaleRest] : c;

  return (
    <group ref={groupRef} scale={parametric ? scaleRest : 1}>
      <mesh
        ref={(m) => {
          meshRef.current = m;
          // the renderer reads morphTargetInfluences on the very first draw
          // (a shadow pass can come before any frame callback), so the array
          // exists from the moment the mesh does
          if (m && geometry.morphAttributes.position && (!m.morphTargetInfluences || m.morphTargetInfluences.length === 0)) m.updateMorphTargets();
        }}
        geometry={geometry}
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
        <Html position={anchor(hoveredPart.centre)} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
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
    </group>
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
  params: BodyParams | null;
  onReady?: (parametric: boolean) => void;
  /** device pixel ratio range; a phone gets less */
  dpr?: [number, number];
};

export default function BodyFigure({ injuries, asOf, tokens: t, reduced, hovered, onHover, yawTarget, params, onReady, dpr = [1, 2] }: BodyFigureProps) {
  const marks = useMemo(() => {
    const byKey = new Map<string, Mark>();
    for (const m of marksFor(injuries, asOf)) if (!byKey.has(m.key)) byKey.set(m.key, m);
    return byKey;
  }, [injuries, asOf]);
  const surface = useSurface();
  useEffect(() => {
    if (surface) onReady?.(surface.parametric);
  }, [surface, onReady]);

  return (
    <Canvas dpr={dpr} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }} camera={{ fov: 30, near: 0.1, far: 50 }}>
      {/* a small studio, no files: one soft key, a fill, a mint rim, a turf bounce off the floor */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={3.2} position={[2.4, 3.4, 3.2]} scale={[3, 3, 1]} target={[0, 1, 0]} color={opaque(t.ink)} />
        <Lightformer form="rect" intensity={0.8} position={[-3.2, 1.6, 1.6]} scale={[2, 4, 1]} target={[0, 1, 0]} color={opaque(t.ink)} />
        <Lightformer form="ring" intensity={3.2} position={[0.4, 2.4, -4]} scale={2.4} target={[0, 1, 0]} color={opaque(t.mint)} />
        <Lightformer form="rect" intensity={0.4} position={[0, -2, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[6, 6, 1]} color={opaque(t.turf2)} />
      </Environment>
      <directionalLight position={[2.2, 3.4, 3.0]} intensity={1.1} color={opaque(t.ink)} />
      <Rig yawTarget={yawTarget} reduced={reduced}>
        {surface ? (
          <Figure surface={surface} marks={marks} t={t} hovered={hovered} reduced={reduced} asOf={asOf} params={params} onHover={onHover} />
        ) : null}
        <ContactShadows position={[0, 0.002, 0]} opacity={0.75} scale={1.7} blur={2.4} far={1.4} resolution={512} frames={surface ? 1 : 0} color={opaque(t.pitch)} />
      </Rig>
    </Canvas>
  );
}
