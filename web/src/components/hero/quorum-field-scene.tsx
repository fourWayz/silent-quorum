"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

// ---------------------------------------------------------------------
// The Quorum Field: every "signal" here represents one possible anonymous
// pledge. Nothing about their position or order carries meaning — real
// pledges have no order the protocol reveals (see ARCHITECTURE.md, I3).
// What IS meaningful, mapped 1:1 onto this animation's phases, is the
// actual protocol lifecycle: dormant field -> pledges accumulate -> the
// threshold boundary (the ring) grows denser -> the crossing pledge fires
// -> a stable lit state -> reset. This is illustrative motion, not live
// chain data — see the caption under the hero.
// ---------------------------------------------------------------------

const PHASE_DURATIONS = {
  dormant: 1.8,
  accumulating: 6.5,
  near: 1.6,
  ignition: 0.9,
  fired: 2.6,
  fade: 1.6
} as const;

type Phase = keyof typeof PHASE_DURATIONS;
const PHASE_ORDER: Phase[] = ["dormant", "accumulating", "near", "ignition", "fired", "fade"];
const TOTAL_CYCLE = PHASE_ORDER.reduce((s, p) => s + PHASE_DURATIONS[p], 0);

function fibonacciSphere(count: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    points.push(new THREE.Vector3(x, y, z).multiplyScalar(radius * (0.92 + Math.random() * 0.16)));
  }
  return points;
}

const DORMANT_COLOR = new THREE.Color("#2b313a");
const SIGNAL_COLOR = new THREE.Color("#34caa4");
const IGNITION_COLOR = new THREE.Color("#f2a53d");

function Field({ count }: { count: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const clock = useRef(0);
  const positions = useMemo(() => fibonacciSphere(count, 3.1), [count]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const { pointer } = useThree();

  useFrame((_, delta) => {
    clock.current = (clock.current + delta) % TOTAL_CYCLE;
    let t = clock.current;
    let phase: Phase = "dormant";
    for (const p of PHASE_ORDER) {
      if (t < PHASE_DURATIONS[p]) {
        phase = p;
        break;
      }
      t -= PHASE_DURATIONS[p];
    }
    const progress = t / PHASE_DURATIONS[phase];

    const threshold = Math.floor(count * 0.62);
    let activeCount = 0;
    let ringIntensity = 0.08;
    let ringColor = DORMANT_COLOR;
    let flash = 0;

    if (phase === "dormant") {
      activeCount = 0;
      ringIntensity = 0.08;
    } else if (phase === "accumulating") {
      activeCount = Math.floor(progress * threshold);
      ringIntensity = 0.1 + progress * 0.35;
    } else if (phase === "near") {
      activeCount = threshold;
      ringIntensity = 0.5 + Math.sin(progress * Math.PI * 6) * 0.15 + 0.2;
      ringColor = SIGNAL_COLOR;
    } else if (phase === "ignition") {
      activeCount = count;
      flash = 1 - progress;
      ringIntensity = 1.4;
      ringColor = IGNITION_COLOR;
    } else if (phase === "fired") {
      activeCount = count;
      ringIntensity = 0.85;
      ringColor = SIGNAL_COLOR;
    } else if (phase === "fade") {
      activeCount = Math.floor((1 - progress) * count);
      ringIntensity = 0.85 * (1 - progress) + 0.08 * progress;
      ringColor = SIGNAL_COLOR;
    }

    const mesh = meshRef.current;
    if (mesh) {
      positions.forEach((pos, i) => {
        const isActive = i < activeCount;
        const scale = isActive ? 1 : 0.55;
        dummy.position.copy(pos);
        dummy.scale.setScalar(scale * (isActive ? 1 : 0.9));
        dummy.lookAt(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        if (phase === "ignition") {
          tmpColor.copy(SIGNAL_COLOR).lerp(IGNITION_COLOR, flash);
        } else {
          tmpColor.copy(isActive ? SIGNAL_COLOR : DORMANT_COLOR);
        }
        mesh.setColorAt(i, tmpColor);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.color.copy(ringColor);
      mat.opacity = Math.min(ringIntensity, 1);
      const s = 1 + ringIntensity * 0.12 + (phase === "ignition" ? flash * 0.5 : 0);
      ringRef.current.scale.setScalar(s);
    }

    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.045;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        pointer.y * 0.12,
        0.02
      );
      groupRef.current.rotation.y += pointer.x * 0.00025;
    }
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <icosahedronGeometry args={[0.045, 0]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2.4, 0, 0]}>
        <torusGeometry args={[1.85, 0.006, 8, 128]} />
        <meshBasicMaterial transparent opacity={0.15} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function QuorumFieldScene({ dense = true }: { dense?: boolean }) {
  const count = dense ? 260 : 110;
  return (
    <Canvas
      dpr={[1, 1.6]}
      camera={{ position: [0, 0, 7.2], fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <Field count={count} />
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.85} luminanceThreshold={0.15} luminanceSmoothing={0.35} mipmapBlur radius={0.6} />
      </EffectComposer>
    </Canvas>
  );
}
