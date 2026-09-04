"use client";

/**
 * The pitch, in metres, seen from behind our own goal with the side attacking
 * up the screen. The turf is grown once in a canvas (see grass.ts) and lit by
 * four floodlights; the camera holds an elevated map view that sways very
 * slowly and can be orbited within limits. Every player on the pitch is a
 * shirt token keyed by player, so when he moves slot the token travels.
 *
 * Dragging is owned by the room. The scene reports which slot the pointer is
 * over while a drag is live and moves a dragged token under the pointer.
 */
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { SquadRow } from "@/lib/data";
import type { Formation } from "@/lib/lineup";
import type { ReadinessKey } from "@/lib/readiness";

import { opaque, type SceneTokens } from "@/components/three/tokens";
import { growTurf } from "./grass";
import { APRON_L, APRON_W, HALF_L, HALF_W, chalkGeometry, goalGeometry, netGeometry, slotToWorld } from "./pitch-geometry";

export type DragSource = { kind: "list"; playerId: string } | { kind: "slot"; index: number };

export type PitchSceneProps = {
  formation: Formation;
  xiIds: (string | null)[];
  byId: Map<string, SquadRow>;
  tokens: SceneTokens;
  reduced: boolean;
  selected: number | null;
  hovered: number | null;
  /** live drag, if any; the scene follows `pointer` and reports the slot under it */
  drag: DragSource | null;
  pointer: React.MutableRefObject<{ x: number; y: number }>;
  dragOver: number | null;
  onDragOver: (i: number | null) => void;
  onDragStart: (source: DragSource, e: PointerEvent) => void;
  onHover: (i: number | null) => void;
  onSelect: (i: number) => void;
  onClear: () => void;
};

const SLOT_RADIUS = 11;

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

/* ── the ground ────────────────────────────────────────────────────────── */

function Turf({ t }: { t: SceneTokens }) {
  const maps = useMemo(() => {
    // the lit stripe is the turf token lifted toward the sky; the dark stripe is the turf itself
    const lit = new THREE.Color(opaque(t.turf2)).lerp(new THREE.Color(opaque(t.ink)), 0.1);
    const grown = growTurf({ light: `#${lit.getHexString()}`, dark: t.turf, width: 1024, height: 1536, stripes: 16, crossStripes: 10, cross: 0.16 });
    const mk = (c: HTMLCanvasElement, srgb: boolean) => {
      const tex = new THREE.CanvasTexture(c);
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
      return tex;
    };
    return { color: mk(grown.color, true), roughness: mk(grown.roughness, false), normal: mk(grown.normal, false) };
  }, [t.turf, t.turf2, t.ink]);
  useEffect(() => () => {
    maps.color.dispose();
    maps.roughness.dispose();
    maps.normal.dispose();
  }, [maps]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[APRON_W, APRON_L]} />
      <meshStandardMaterial
        map={maps.color}
        roughnessMap={maps.roughness}
        normalMap={maps.normal}
        normalScale={new THREE.Vector2(0.4, 0.4)}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

function Statics({ t }: { t: SceneTokens }) {
  const chalk = useMemo(() => chalkGeometry(), []);
  const goals = useMemo(() => goalGeometry(), []);
  const nets = useMemo(() => netGeometry(), []);
  return (
    <>
      <mesh geometry={chalk} receiveShadow>
        <meshStandardMaterial color={opaque(t.chalk)} roughness={0.9} />
      </mesh>
      <mesh geometry={goals} castShadow>
        <meshStandardMaterial color={opaque(t.ink)} roughness={0.35} metalness={0.1} />
      </mesh>
      <lineSegments geometry={nets}>
        <lineBasicMaterial color={opaque(t.ink)} transparent opacity={0.28} />
      </lineSegments>
    </>
  );
}

/* ── the lamps ─────────────────────────────────────────────────────────── */

function Floodlights({ t }: { t: SceneTokens }) {
  const corners: [number, number, number][] = [
    [-52, 42, -74],
    [52, 42, -74],
    [-52, 42, 74],
    [52, 42, 74],
  ];
  return (
    <>
      <hemisphereLight args={[opaque(t.ink), opaque(t.turf), 0.55]} />
      {corners.map((p, i) => (
        <spotLight
          key={i}
          position={p}
          target-position={[0, 0, 0]}
          intensity={i === 0 ? 6400 : 4400}
          angle={0.72}
          penumbra={0.9}
          decay={1.6}
          distance={260}
          color={opaque(t.ink)}
          castShadow={i === 0}
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.00015}
          shadow-normalBias={0.03}
          shadow-camera-near={20}
          shadow-camera-far={200}
        />
      ))}
    </>
  );
}

/* ── the camera ────────────────────────────────────────────────────────── */

function Rig({ reduced, busy }: { reduced: boolean; busy: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const dir = useRef(1);
  useEffect(() => {
    camera.position.set(0, 96, -104);
    camera.lookAt(0, 0, -4);
  }, [camera]);
  // a slow sway between the azimuth limits: the map breathes, the user is never fighting it
  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    if (reduced || busy) {
      c.autoRotate = false;
      return;
    }
    c.autoRotate = true;
    const a = c.getAzimuthalAngle();
    if (a > 0.22) dir.current = -1;
    if (a < -0.22) dir.current = 1;
    c.autoRotateSpeed = 0.09 * dir.current;
  });
  return (
    <OrbitControls
      ref={controls}
      target={[0, 0, -4]}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      minDistance={78}
      maxDistance={160}
      minPolarAngle={0.42}
      maxPolarAngle={1.02}
      minAzimuthAngle={-0.55}
      maxAzimuthAngle={0.55}
      rotateSpeed={0.5}
      zoomSpeed={0.6}
      enabled={!busy}
      makeDefault
    />
  );
}

/* ── drag probe: where on the ground is the pointer, and which slot is that ── */

function DragProbe({
  formation,
  drag,
  pointer,
  onDragOver,
  dragOver,
}: {
  formation: Formation;
  drag: DragSource | null;
  pointer: React.MutableRefObject<{ x: number; y: number }>;
  onDragOver: (i: number | null) => void;
  dragOver: number | null;
}) {
  const { camera, gl } = useThree();
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const ndc = useMemo(() => new THREE.Vector2(), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const last = useRef<number | null>(null);
  useFrame(() => {
    if (!drag) {
      last.current = null;
      return;
    }
    const rect = gl.domElement.getBoundingClientRect();
    const { x, y } = pointer.current;
    const inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (!inside) {
      if (dragOver !== null) onDragOver(null);
      last.current = null;
      return;
    }
    ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return;
    let best: number | null = null;
    let bestD = SLOT_RADIUS;
    formation.slots.forEach((s, i) => {
      const [sx, sz] = slotToWorld(s.x, s.depth);
      const d = Math.hypot(hit.x - sx, hit.z - sz);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    if (best !== last.current) {
      last.current = best;
      onDragOver(best);
    }
  });
  return null;
}

/* ── slots and tokens ──────────────────────────────────────────────────── */

function SlotMark({ slot, t, over, empty, reduced }: { slot: Formation["slots"][number]; t: SceneTokens; over: boolean; empty: boolean; reduced: boolean }) {
  const [x, z] = slotToWorld(slot.x, slot.depth);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const m = ring.current;
    if (!m) return;
    const target = over ? 1.25 : 1;
    const k = reduced ? 1 : 0.25;
    const s = m.scale.x + (target - m.scale.x) * k;
    m.scale.setScalar(s);
    const mat = m.material as THREE.MeshBasicMaterial;
    const pulse = over && !reduced ? 0.75 + 0.25 * Math.sin(clock.elapsedTime * 6) : over ? 1 : empty ? 0.5 : 0.18;
    mat.opacity += (pulse - mat.opacity) * k;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh ref={ring} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.6, 3.1, 48]} />
        <meshBasicMaterial color={over ? opaque(t.mint) : empty ? opaque(t.out) : opaque(t.chalk)} transparent opacity={0.2} toneMapped={false} />
      </mesh>
      {empty ? (
        <Html center position={[0, 0.2, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: "none", userSelect: "none" }}>
          <span className="num text-[10.5px] font-semibold tracking-[0.1em]" style={{ color: over ? t.mint : t.out }}>
            {slot.role}
          </span>
        </Html>
      ) : null}
    </group>
  );
}

type TokenProps = {
  row: SquadRow;
  slotIndex: number;
  slot: Formation["slots"][number];
  t: SceneTokens;
  selected: boolean;
  hovered: boolean;
  dragging: boolean;
  reduced: boolean;
  pointer: React.MutableRefObject<{ x: number; y: number }>;
  onHover: (i: number | null) => void;
  onSelect: (i: number) => void;
  onDragStart: (source: DragSource, e: PointerEvent) => void;
};

function Token({ row, slotIndex, slot, t, selected, hovered, dragging, reduced, pointer, onHover, onSelect, onDragStart }: TokenProps) {
  const group = useRef<THREE.Group>(null);
  const { camera, gl } = useThree();
  const probe = useMemo(() => ({ ray: new THREE.Raycaster(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ndc: new THREE.Vector2(), hit: new THREE.Vector3() }), []);
  const [tx, tz] = slotToWorld(slot.x, slot.depth);
  const outOfPosition = row.player.position !== slot.role;
  const ring = outOfPosition ? t.gold : readinessColour(t, row.readiness.key);
  const first = useRef(true);
  const downAt = useRef<{ x: number; y: number } | null>(null);

  // critically damped approach on every axis: a token that is moved travels,
  // a hover that ends mid-rise turns around, a dropped token snaps home
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    let px = tx;
    let pz = tz;
    if (dragging) {
      const rect = gl.domElement.getBoundingClientRect();
      const { x, y } = pointer.current;
      probe.ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
      probe.ray.setFromCamera(probe.ndc, camera);
      if (probe.ray.ray.intersectPlane(probe.plane, probe.hit)) {
        px = probe.hit.x;
        pz = probe.hit.z;
      }
    }
    const lift = dragging ? 3.2 : hovered || selected ? 1.2 : 0;
    const scale = dragging ? 1.12 : hovered ? 1.08 : 1;
    if (first.current || reduced) {
      first.current = false;
      g.position.set(px, lift, pz);
      g.scale.setScalar(scale);
      return;
    }
    const k = 1 - Math.exp(-dt * (dragging ? 30 : 12));
    g.position.x += (px - g.position.x) * k;
    g.position.z += (pz - g.position.z) * k;
    g.position.y += (lift - g.position.y) * k;
    const s = g.scale.x + (scale - g.scale.x) * k;
    g.scale.setScalar(s);
  });

  const surname = row.player.name.split(" ").at(-1) ?? row.player.name;

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    downAt.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!downAt.current) return;
    const d = Math.hypot(e.clientX - downAt.current.x, e.clientY - downAt.current.y);
    if (d > 6) {
      downAt.current = null;
      onDragStart({ kind: "slot", index: slotIndex }, e.nativeEvent);
    }
  };
  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (downAt.current) {
      downAt.current = null;
      e.stopPropagation();
      onSelect(slotIndex);
    }
  };

  return (
    <group ref={group} position={[tx, 0, tz]}>
      <group
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(slotIndex);
          document.body.style.cursor = "grab";
        }}
        onPointerOut={() => {
          onHover(null);
          document.body.style.cursor = "";
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[2.2, 2.2, 0.8, 48]} />
          <meshStandardMaterial color={selected ? opaque(t.mint) : opaque(t.ink)} roughness={0.42} metalness={0.05} />
        </mesh>
        <mesh position={[0, 0.82, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.75, 2.2, 48]} />
          <meshBasicMaterial color={selected ? opaque(t.mint) : ring} toneMapped={false} />
        </mesh>
        <Html center position={[0, 0.85, 0]} zIndexRange={[10, 0]} style={{ pointerEvents: "none", userSelect: "none" }}>
          <span className="num block text-[13px] font-bold leading-none" style={{ color: opaque(t.pitch) }}>
            {row.player.squad_number ?? ""}
          </span>
        </Html>
        <Html center position={[0, 0.3, -4.4]} zIndexRange={[10, 0]} style={{ pointerEvents: "none", userSelect: "none" }}>
          <div className="flex flex-col items-center whitespace-nowrap">
            <span
              className="text-[11px] font-semibold leading-none tracking-[0.03em]"
              style={{ color: selected ? t.mint : t.ink, textShadow: `0 1px 4px ${opaque(t.pitch)}, 0 0 10px ${opaque(t.pitch)}` }}
            >
              {surname}
            </span>
            {hovered && !dragging ? (
              <span
                className="num mt-1 rounded-[2px] border px-1.5 py-[3px] text-[10px] font-semibold tracking-[0.08em]"
                style={{ color: ring, borderColor: ring, background: opaque(t.panel) }}
              >
                {outOfPosition ? `${row.player.position} · ` : ""}
                {row.readiness.word.toUpperCase()}
              </span>
            ) : null}
          </div>
        </Html>
      </group>
    </group>
  );
}

/* ── the scene ─────────────────────────────────────────────────────────── */

export default function PitchScene(props: PitchSceneProps) {
  const { formation, xiIds, byId, tokens: t, reduced, selected, hovered, drag, pointer, dragOver, onDragOver, onDragStart, onHover, onSelect, onClear } = props;
  const placed = useMemo(
    () =>
      xiIds
        .map((id, i) => (id && byId.get(id) ? { row: byId.get(id)!, index: i } : null))
        .filter((p): p is { row: SquadRow; index: number } => p !== null),
    [xiIds, byId],
  );

  return (
    <Canvas
      dpr={[1, 1.75]}
      shadows="soft"
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 36, near: 1, far: 500 }}
      style={{ background: "transparent", touchAction: "none" }}
      onPointerMissed={() => {
        if (!drag) onClear();
      }}
    >
      <Rig reduced={reduced} busy={drag !== null} />
      <Floodlights t={t} />
      <fog attach="fog" args={[opaque(t.pitch), 150, 260]} />
      <Turf t={t} />
      <Statics t={t} />
      <DragProbe formation={formation} drag={drag} pointer={pointer} onDragOver={onDragOver} dragOver={dragOver} />
      {formation.slots.map((slot, i) => (
        <SlotMark key={`slot-${i}`} slot={slot} t={t} over={drag !== null && dragOver === i} empty={!xiIds[i]} reduced={reduced} />
      ))}
      {placed.map(({ row, index }) => (
        <Token
          key={row.player.id}
          row={row}
          slotIndex={index}
          slot={formation.slots[index]}
          t={t}
          selected={selected === index}
          hovered={hovered === index}
          dragging={drag?.kind === "slot" && drag.index === index}
          reduced={reduced}
          pointer={pointer}
          onHover={onHover}
          onSelect={onSelect}
          onDragStart={onDragStart}
        />
      ))}
      {/* the ground catches shadow tokens throw and nothing else; HALF_W/HALF_L keep the apron honest */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <planeGeometry args={[HALF_W * 4, HALF_L * 4]} />
        <meshBasicMaterial />
      </mesh>
    </Canvas>
  );
}
