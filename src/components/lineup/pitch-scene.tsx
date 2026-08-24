"use client";

/**
 * The pitch, in metres, seen from behind our own goal with the side attacking
 * up the screen. Everything static (turf, chalk, goals) is a handful of draw
 * calls; every player is a disc with a readiness ring and an HTML label.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { Pick } from "@/lib/lineup";
import type { ReadinessKey } from "@/lib/readiness";

import { opaque, type SceneTokens } from "@/components/three/tokens";

const LENGTH = 105;
const WIDTH = 68;
const HALF_L = LENGTH / 2;
const HALF_W = WIDTH / 2;

function readinessColour(t: SceneTokens, key: ReadinessKey): string {
  switch (key) {
    case "steady":
      return t.fit;
    case "pushing":
    case "undercooked":
      return t.doubt;
    case "red":
      return t.out;
    default:
      return t.cold;
  }
}

/** Turf stripes baked into one texture: one draw call for the whole surface. */
function useTurfTexture(t: SceneTokens) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 1024;
    const ctx = c.getContext("2d")!;
    const stripes = 12;
    for (let i = 0; i < stripes; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? t.turf : t.turf2;
      ctx.fillRect(0, (i * c.height) / stripes, c.width, c.height / stripes + 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [t.turf, t.turf2]);
}

/** All the chalk in one merged geometry. */
function useChalkGeometry() {
  return useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    const line = (x: number, z: number, w: number, d: number) => {
      const g = new THREE.BoxGeometry(w, 0.06, d);
      g.translate(x, 0.03, z);
      parts.push(g);
    };
    const T = 0.14;
    // touchlines + goal lines
    line(-HALF_W, 0, T, LENGTH);
    line(HALF_W, 0, T, LENGTH);
    line(0, -HALF_L, WIDTH, T);
    line(0, HALF_L, WIDTH, T);
    line(0, 0, WIDTH, T);
    // boxes at both ends
    for (const s of [-1, 1]) {
      const goalLine = s * HALF_L;
      // penalty area 40.3 x 16.5
      line(0, goalLine - s * 16.5, 40.3, T);
      line(-20.15, goalLine - s * 8.25, T, 16.5);
      line(20.15, goalLine - s * 8.25, T, 16.5);
      // six-yard 18.3 x 5.5
      line(0, goalLine - s * 5.5, 18.3, T);
      line(-9.15, goalLine - s * 2.75, T, 5.5);
      line(9.15, goalLine - s * 2.75, T, 5.5);
      // penalty spot
      const spot = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12);
      spot.translate(0, 0.03, goalLine - s * 11);
      parts.push(spot);
    }
    // centre circle + spot
    const ring = new THREE.RingGeometry(9.15 - T / 2, 9.15 + T / 2, 64);
    ring.rotateX(-Math.PI / 2);
    ring.translate(0, 0.04, 0);
    parts.push(ring);
    const spot = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12);
    spot.translate(0, 0.03, 0);
    parts.push(spot);
    return mergeGeometries(parts, false)!;
  }, []);
}

/** Two goals, six posts, one draw. */
function useGoalGeometry() {
  return useMemo(() => {
    const parts: THREE.BufferGeometry[] = [];
    for (const s of [-1, 1]) {
      const z = s * (HALF_L + 0.06);
      for (const x of [-3.66, 3.66]) {
        const post = new THREE.CylinderGeometry(0.06, 0.06, 2.44, 8);
        post.translate(x, 1.22, z);
        parts.push(post);
      }
      const bar = new THREE.CylinderGeometry(0.06, 0.06, 7.32, 8);
      bar.rotateZ(Math.PI / 2);
      bar.translate(0, 2.44, z);
      parts.push(bar);
    }
    return mergeGeometries(parts, false)!;
  }, []);
}

function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 112, -70);
    camera.lookAt(0, 0, -10);
  }, [camera]);
  return null;
}

type MarkerProps = {
  pick: Pick;
  index: number;
  t: SceneTokens;
  selected: boolean;
  hovered: boolean;
  reduced: boolean;
  onHover: (i: number | null) => void;
  onSelect: (i: number) => void;
};

function Marker({ pick, index, t, selected, hovered, reduced, onHover, onSelect }: MarkerProps) {
  const group = useRef<THREE.Group>(null);
  const x = pick.slot.x * (HALF_W - 4);
  const z = -HALF_L + pick.slot.depth * LENGTH;
  const row = pick.row;
  const ring = row ? (pick.outOfPosition ? t.gold : readinessColour(t, row.readiness.key)) : t.out;
  const lift = hovered || selected ? 1.3 : 0;
  const scale = hovered ? 1.1 : 1;

  // Critically damped approach: no overshoot, always from the current value,
  // so a hover that ends mid-rise just turns around.
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (reduced) {
      g.position.y = lift;
      g.scale.setScalar(scale);
      return;
    }
    const k = 1 - Math.exp(-dt * 14);
    g.position.y += (lift - g.position.y) * k;
    const s = g.scale.x + (scale - g.scale.x) * k;
    g.scale.setScalar(s);
  });

  const surname = row ? row.player.name.split(" ").at(-1) : "?";

  return (
    <group position={[x, 0, z]}>
      {/* shadow puck on the turf, does not lift */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.3, 32]} />
        <meshBasicMaterial color={opaque(t.pitch)} transparent opacity={0.35} />
      </mesh>
      <group
        ref={group}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(index);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(index);
        }}
      >
        {/* the shirt: a light disc with the readiness ring around its rim */}
        <mesh position={[0, 0.35, 0]}>
          <cylinderGeometry args={[2.3, 2.3, 0.7, 48]} />
          <meshStandardMaterial
            color={row ? (selected ? t.mint : opaque(t.ink)) : opaque(t.pitch)}
            roughness={0.5}
            metalness={0.02}
            transparent={!row}
            opacity={row ? 1 : 0.55}
          />
        </mesh>
        <mesh position={[0, 0.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.85, 2.3, 48]} />
          <meshBasicMaterial color={selected ? t.mint : ring} toneMapped={false} />
        </mesh>
        <Html center position={[0, 0.75, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: "none", userSelect: "none" }}>
          <span
            className="num block text-[13px] font-bold leading-none"
            style={{ color: row ? opaque(t.pitch) : t.out }}
          >
            {row ? (row.player.squad_number ?? "") : "?"}
          </span>
        </Html>
        <Html center position={[0, 0.2, -4.2]} zIndexRange={[10, 0]} style={{ pointerEvents: "none", userSelect: "none" }}>
          <div className="flex flex-col items-center whitespace-nowrap">
            <span
              className="text-[11px] font-semibold leading-none tracking-[0.03em]"
              style={{ color: selected ? t.mint : t.ink, textShadow: `0 1px 4px ${opaque(t.pitch)}, 0 0 8px ${opaque(t.pitch)}` }}
            >
              {surname}
            </span>
            {hovered && row ? (
              <span
                className="num mt-1 rounded-[2px] border px-1.5 py-[3px] text-[10px] font-semibold tracking-[0.08em]"
                style={{ color: ring, borderColor: ring, background: opaque(t.panel) }}
              >
                {pick.outOfPosition ? `${row.player.position} · ` : ""}
                {row.readiness.word.toUpperCase()}
              </span>
            ) : null}
          </div>
        </Html>
      </group>
    </group>
  );
}

export type PitchSceneProps = {
  picks: Pick[];
  tokens: SceneTokens;
  selected: number | null;
  hovered: number | null;
  reduced: boolean;
  onHover: (i: number | null) => void;
  onSelect: (i: number) => void;
  onClear: () => void;
};

function Statics({ t }: { t: SceneTokens }) {
  const turf = useTurfTexture(t);
  const chalk = useChalkGeometry();
  const goals = useGoalGeometry();
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WIDTH + 8, LENGTH + 10]} />
        <meshStandardMaterial map={turf} roughness={0.95} />
      </mesh>
      <mesh geometry={chalk}>
        <meshBasicMaterial color={opaque(t.chalk)} transparent opacity={0.75} toneMapped={false} />
      </mesh>
      <mesh geometry={goals}>
        <meshStandardMaterial color={opaque(t.ink)} roughness={0.4} />
      </mesh>
    </>
  );
}

export default function PitchScene({ picks, tokens: t, selected, hovered, reduced, onHover, onSelect, onClear }: PitchSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 40, near: 1, far: 400 }}
      style={{ background: "transparent" }}
      onPointerMissed={onClear}
    >
      <CameraRig />
      <hemisphereLight args={[opaque(t.ink), opaque(t.turf), 0.55]} />
      <directionalLight position={[-30, 60, -20]} intensity={1.1} />
      <fog attach="fog" args={[opaque(t.pitch), 110, 190]} />
      <Statics t={t} />
      {picks.map((p, i) => (
        <Marker
          key={i}
          pick={p}
          index={i}
          t={t}
          selected={selected === i}
          hovered={hovered === i}
          reduced={reduced}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
    </Canvas>
  );
}
