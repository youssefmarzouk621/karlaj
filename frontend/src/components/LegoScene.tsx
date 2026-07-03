"use client";

import { useRef, useMemo, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

const GRID = 16;
const STUD_RADIUS = 0.35;
const STUD_HEIGHT = 0.18;
const BRICK_HEIGHT = 0.32;
const GAP = 0.02;

const SCENE_COLORS = [
  "#C4533A", "#D4634A", "#E8A84C", "#B45429",
  "#8A8580", "#F5F0EB", "#2A2A2A", "#5C3D2E",
  "#1A1A1A", "#3A3A3A", "#6B4D3A", "#D49A6A",
  "#4A3228", "#7A5C48", "#C08060", "#E0C0A0",
  "#322018", "#F0D8C0", "#A07050", "#503828",
];

interface BrickData {
  x: number;
  z: number;
  w: number;
  d: number;
  color: string;
  delay: number;
}

function generateBricks(): BrickData[] {
  const bricks: BrickData[] = [];
  const covered = Array.from({ length: GRID }, () => Array(GRID).fill(false));

  const colorGrid = Array.from({ length: GRID }, (_, r) =>
    Array.from({ length: GRID }, (_, c) => {
      const cx = c / GRID;
      const cy = r / GRID;
      const dist = Math.sqrt((cx - 0.45) ** 2 + (cy - 0.45) ** 2);

      if (dist < 0.12) return SCENE_COLORS[2];
      if (dist < 0.25) return SCENE_COLORS[0];
      if (dist < 0.38) return SCENE_COLORS[3];

      const ring = Math.floor(dist * 8);
      const angle = Math.atan2(cy - 0.45, cx - 0.45);
      const sector = Math.floor((angle + Math.PI) / (Math.PI / 4));
      const idx = (ring * 3 + sector * 2) % SCENE_COLORS.length;
      return SCENE_COLORS[idx];
    })
  );

  const sizes = [
    { w: 4, d: 2 }, { w: 2, d: 4 },
    { w: 3, d: 2 }, { w: 2, d: 3 },
    { w: 2, d: 2 },
    { w: 4, d: 1 }, { w: 1, d: 4 },
    { w: 3, d: 1 }, { w: 1, d: 3 },
    { w: 2, d: 1 }, { w: 1, d: 2 },
    { w: 1, d: 1 },
  ];

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (covered[r][c]) continue;
      const color = colorGrid[r][c];

      let placed = false;
      const shuffled = [...sizes].sort(() => Math.random() - 0.5);
      for (const { w, d } of shuffled) {
        if (c + w > GRID || r + d > GRID) continue;
        let fits = true;
        for (let dr = 0; dr < d && fits; dr++)
          for (let dc = 0; dc < w && fits; dc++)
            if (covered[r + dr][c + dc] || colorGrid[r + dr][c + dc] !== color)
              fits = false;

        if (fits) {
          for (let dr = 0; dr < d; dr++)
            for (let dc = 0; dc < w; dc++)
              covered[r + dr][c + dc] = true;

          const dist = Math.sqrt((c + w / 2 - GRID / 2) ** 2 + (r + d / 2 - GRID / 2) ** 2);
          bricks.push({
            x: c + w / 2 - GRID / 2, z: r + d / 2 - GRID / 2,
            w, d, color,
            delay: dist * 0.1 + Math.random() * 0.2,
          });
          placed = true;
          break;
        }
      }
      if (!placed) {
        covered[r][c] = true;
        const dist = Math.sqrt((c + 0.5 - GRID / 2) ** 2 + (r + 0.5 - GRID / 2) ** 2);
        bricks.push({
          x: c + 0.5 - GRID / 2, z: r + 0.5 - GRID / 2,
          w: 1, d: 1, color,
          delay: dist * 0.1 + Math.random() * 0.2,
        });
      }
    }
  }
  return bricks;
}

function Brick({ brick, animProgress }: { brick: BrickData; animProgress: number }) {
  const t = Math.max(0, Math.min(1, (animProgress - brick.delay) / 0.35));
  const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const currentY = THREE.MathUtils.lerp(5, BRICK_HEIGHT / 2, eased);
  const opacity = Math.min(1, t * 3);
  const scale = eased > 0 ? 1 : 0;

  return (
    <group position={[brick.x, currentY, brick.z]} scale={[scale, scale, scale]}>
      <mesh receiveShadow>
        <boxGeometry args={[brick.w - GAP, BRICK_HEIGHT, brick.d - GAP]} />
        <meshStandardMaterial
          color={brick.color}
          transparent opacity={opacity}
          roughness={0.35} metalness={0.05}
        />
      </mesh>
      {Array.from({ length: brick.w * brick.d }).map((_, i) => (
        <mesh
          key={i}
          position={[
            (i % brick.w) - (brick.w - 1) / 2,
            BRICK_HEIGHT / 2 + STUD_HEIGHT / 2,
            Math.floor(i / brick.w) - (brick.d - 1) / 2,
          ]}

        >
          <cylinderGeometry args={[STUD_RADIUS, STUD_RADIUS, STUD_HEIGHT, 16]} />
          <meshStandardMaterial
            color={brick.color}
            transparent opacity={opacity}
            roughness={0.35} metalness={0.05}
          />
        </mesh>
      ))}
    </group>
  );
}

function Baseplate() {
  return (
    <mesh receiveShadow position={[0, -0.05, 0]}>
      <boxGeometry args={[GRID + 0.4, 0.1, GRID + 0.4]} />
      <meshStandardMaterial color="#1A1A1A" roughness={0.8} />
    </mesh>
  );
}

function Scene() {
  const [progress, setProgress] = useState(0);
  const bricks = useMemo(() => generateBricks(), []);
  const maxDelay = useMemo(() => Math.max(...bricks.map((b) => b.delay)) + 0.4, [bricks]);

  useFrame((_, delta) => {
    setProgress((p) => Math.min(p + delta * 0.55, maxDelay + 0.5));
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[8, 12, 6]} intensity={1} />
      <directionalLight position={[-5, 6, -4]} intensity={0.2} color="#E8A84C" />
      <Baseplate />
      {bricks.map((brick, i) => (
        <Brick key={i} brick={brick} animProgress={progress} />
      ))}
    </>
  );
}

export default function LegoScene() {
  return (
    <div className="w-full h-full min-h-[400px]">
      <Canvas
        camera={{ position: [12, 10, 12], fov: 35 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#0F0F0F"]} />
        <fog attach="fog" args={["#0F0F0F", 22, 45]} />
        <Scene />
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.6}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.5}
        />
      </Canvas>
    </div>
  );
}
