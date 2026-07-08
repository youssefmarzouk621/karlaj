"use client";

import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { DrawPlacement } from "@/lib/drawMosaic";

interface Props {
  gridRows: number;
  gridCols: number;
  placements: DrawPlacement[];
  colorMap: Record<number, [number, number, number]>;
}

const BRICK_H = 1.0; // brick body height, in stud units
const STUD_R = 0.3;
const STUD_H = 0.28;

/**
 * Builds two InstancedMeshes (brick bodies + studs) from the placements. One
 * unit-cube geometry is scaled per instance for the bricks, and one short
 * cylinder is instanced once per covered stud, each tinted with its LEGO color.
 * Two draw calls total, so even a 96×96 mosaic (~9k studs) stays smooth.
 */
function useMosaicMeshes(
  rows: number,
  cols: number,
  placements: DrawPlacement[],
  colorMap: Record<number, [number, number, number]>
) {
  return useMemo(() => {
    const brickGeo = new THREE.BoxGeometry(1, 1, 1);
    const studGeo = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 14);
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0,
    });

    const studCount = placements.reduce(
      (n, p) => n + p.brick_width * p.brick_height,
      0
    );
    const brickMesh = new THREE.InstancedMesh(
      brickGeo,
      material,
      placements.length
    );
    const studMesh = new THREE.InstancedMesh(studGeo, material, studCount);

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let studIdx = 0;

    placements.forEach((p, i) => {
      const rgb = colorMap[p.color_id] ?? [190, 190, 190];
      color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);

      // Brick body: unit cube scaled to the brick, centered over its footprint.
      const bx = p.col - cols / 2 + p.brick_width / 2;
      const bz = p.row - rows / 2 + p.brick_height / 2;
      dummy.position.set(bx, BRICK_H / 2, bz);
      dummy.scale.set(p.brick_width, BRICK_H, p.brick_height);
      dummy.updateMatrix();
      brickMesh.setMatrixAt(i, dummy.matrix);
      brickMesh.setColorAt(i, color);

      // One stud per covered cell, sitting on top of the brick.
      dummy.scale.set(1, 1, 1);
      for (let dr = 0; dr < p.brick_height; dr++) {
        for (let dc = 0; dc < p.brick_width; dc++) {
          dummy.position.set(
            p.col - cols / 2 + dc + 0.5,
            BRICK_H + STUD_H / 2,
            p.row - rows / 2 + dr + 0.5
          );
          dummy.updateMatrix();
          studMesh.setMatrixAt(studIdx, dummy.matrix);
          studMesh.setColorAt(studIdx, color);
          studIdx++;
        }
      }
    });

    brickMesh.instanceMatrix.needsUpdate = true;
    studMesh.instanceMatrix.needsUpdate = true;
    if (brickMesh.instanceColor) brickMesh.instanceColor.needsUpdate = true;
    if (studMesh.instanceColor) studMesh.instanceColor.needsUpdate = true;

    return { brickMesh, studMesh, brickGeo, studGeo, material };
  }, [rows, cols, placements, colorMap]);
}

function Model(props: Props) {
  const { gridRows, gridCols, placements, colorMap } = props;
  const meshes = useMosaicMeshes(gridRows, gridCols, placements, colorMap);

  // Free GPU resources when the mosaic changes or the view unmounts.
  useEffect(() => {
    return () => {
      meshes.brickMesh.dispose();
      meshes.studMesh.dispose();
      meshes.brickGeo.dispose();
      meshes.studGeo.dispose();
      meshes.material.dispose();
    };
  }, [meshes]);

  return (
    <group>
      <primitive object={meshes.brickMesh} />
      <primitive object={meshes.studMesh} />
    </group>
  );
}

export default function Mosaic3D({
  gridRows,
  gridCols,
  placements,
  colorMap,
}: Props) {
  const maxDim = Math.max(gridRows, gridCols);

  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-xl border border-border-custom bg-gradient-to-b from-[#f4f5f8] to-[#e4e6ec] dark:from-[#1a1c22] dark:to-[#0e0f13]">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, maxDim * 0.85, maxDim * 1.05], fov: 34 }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight
          position={[maxDim, maxDim * 1.6, maxDim * 0.8]}
          intensity={1.5}
        />
        <directionalLight
          position={[-maxDim, maxDim * 0.8, -maxDim]}
          intensity={0.4}
        />
        <Model
          gridRows={gridRows}
          gridCols={gridCols}
          placements={placements}
          colorMap={colorMap}
        />
        <ContactShadows
          position={[0, -0.02, 0]}
          scale={maxDim * 1.6}
          opacity={0.35}
          blur={2.4}
          far={maxDim}
        />
        <OrbitControls
          makeDefault
          autoRotate
          autoRotateSpeed={0.7}
          enablePan={false}
          enableDamping
          minDistance={maxDim * 0.5}
          maxDistance={maxDim * 2.2}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>

      <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium text-white">
        Drag to rotate · scroll to zoom
      </span>
    </div>
  );
}
