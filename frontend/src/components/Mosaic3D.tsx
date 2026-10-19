"use client";

import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { DrawPlacement } from "@/lib/drawMosaic";
import { BASE_RGB, isRound } from "@/lib/paintMosaic";

interface Props {
  gridRows: number;
  gridCols: number;
  placements: DrawPlacement[];
  colorMap: Record<number, [number, number, number]>;
  /** Overrides the default framed 360px box (e.g. to fill a viewer panel). */
  className?: string;
}

const BRICK_H = 1.0; // brick body height, in stud units
const STUD_R = 0.3;
const STUD_H = 0.28;
const ROUND_R = 0.46; // round plate body radius (the base shows between pieces)
const BASE_H = 0.3; // base plate slab under round plates

/**
 * Builds InstancedMeshes from the placements: square brick bodies (a unit cube
 * scaled per instance), round plate bodies (one cylinder per covered stud),
 * and the studs (a short cylinder per covered stud), each tinted with its LEGO
 * color. Round plates also get a dark base slab underneath, since the base
 * shows between them. A handful of draw calls total, so even a 128-stud
 * mosaic stays smooth.
 */
function useMosaicMeshes(
  rows: number,
  cols: number,
  placements: DrawPlacement[],
  colorMap: Record<number, [number, number, number]>
) {
  return useMemo(() => {
    const brickGeo = new THREE.BoxGeometry(1, 1, 1);
    const roundGeo = new THREE.CylinderGeometry(ROUND_R, ROUND_R, BRICK_H, 20);
    const studGeo = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 14);
    const material = new THREE.MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0,
    });

    const squares = placements.filter((p) => !isRound(p));
    const rounds = placements.filter(isRound);
    const studCount = placements.reduce(
      (n, p) => n + p.brick_width * p.brick_height,
      0
    );
    const roundCount = rounds.reduce((n, p) => n + p.brick_width * p.brick_height, 0);
    const brickMesh = new THREE.InstancedMesh(brickGeo, material, squares.length);
    const roundMesh = new THREE.InstancedMesh(roundGeo, material, roundCount);
    const studMesh = new THREE.InstancedMesh(studGeo, material, studCount);

    // The base plate under round plates: one dark slab covering the grid.
    const baseGeo = new THREE.BoxGeometry(cols, BASE_H, rows);
    const baseMaterial = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 });
    baseMaterial.color.setRGB(BASE_RGB[0] / 255, BASE_RGB[1] / 255, BASE_RGB[2] / 255, THREE.SRGBColorSpace);
    const baseMesh = new THREE.Mesh(baseGeo, baseMaterial);
    baseMesh.position.set(0, -BASE_H / 2, 0);
    baseMesh.visible = rounds.length > 0;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let studIdx = 0;
    let squareIdx = 0;
    let roundIdx = 0;

    placements.forEach((p) => {
      const rgb = colorMap[p.color_id] ?? [190, 190, 190];
      color.setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, THREE.SRGBColorSpace);

      if (isRound(p)) {
        // Round plate body: one cylinder per covered stud.
        dummy.scale.set(1, 1, 1);
        for (let dr = 0; dr < p.brick_height; dr++) {
          for (let dc = 0; dc < p.brick_width; dc++) {
            dummy.position.set(
              p.col - cols / 2 + dc + 0.5,
              BRICK_H / 2,
              p.row - rows / 2 + dr + 0.5
            );
            dummy.updateMatrix();
            roundMesh.setMatrixAt(roundIdx, dummy.matrix);
            roundMesh.setColorAt(roundIdx, color);
            roundIdx++;
          }
        }
      } else {
        // Brick body: unit cube scaled to the brick, centered over its footprint.
        const bx = p.col - cols / 2 + p.brick_width / 2;
        const bz = p.row - rows / 2 + p.brick_height / 2;
        dummy.position.set(bx, BRICK_H / 2, bz);
        dummy.scale.set(p.brick_width, BRICK_H, p.brick_height);
        dummy.updateMatrix();
        brickMesh.setMatrixAt(squareIdx, dummy.matrix);
        brickMesh.setColorAt(squareIdx, color);
        squareIdx++;
      }

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

    for (const mesh of [brickMesh, roundMesh, studMesh]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    return {
      brickMesh,
      roundMesh,
      studMesh,
      baseMesh,
      geometries: [brickGeo, roundGeo, studGeo, baseGeo],
      materials: [material, baseMaterial],
    };
  }, [rows, cols, placements, colorMap]);
}

function Model(props: Props) {
  const { gridRows, gridCols, placements, colorMap } = props;
  const meshes = useMosaicMeshes(gridRows, gridCols, placements, colorMap);

  // Free GPU resources when the mosaic changes or the view unmounts.
  useEffect(() => {
    return () => {
      meshes.brickMesh.dispose();
      meshes.roundMesh.dispose();
      meshes.studMesh.dispose();
      meshes.geometries.forEach((g) => g.dispose());
      meshes.materials.forEach((m) => m.dispose());
    };
  }, [meshes]);

  return (
    <group>
      <primitive object={meshes.baseMesh} />
      <primitive object={meshes.brickMesh} />
      <primitive object={meshes.roundMesh} />
      <primitive object={meshes.studMesh} />
    </group>
  );
}

export default function Mosaic3D({
  gridRows,
  gridCols,
  placements,
  colorMap,
  className = "relative h-[360px] rounded-2xl border border-line bg-bg",
}: Props) {
  const maxDim = Math.max(gridRows, gridCols);
  // Round plates sit on a base slab; drop the shadow below it.
  const shadowY = placements.some(isRound) ? -BASE_H - 0.02 : -0.02;

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, maxDim * 0.92, maxDim * 0.68], fov: 34 }}
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
          position={[0, shadowY, 0]}
          scale={maxDim * 1.6}
          opacity={0.35}
          blur={2.4}
          far={maxDim}
        />
        <OrbitControls
          makeDefault
          autoRotate
          autoRotateSpeed={0.35}
          enablePan={false}
          enableDamping
          minDistance={maxDim * 0.5}
          maxDistance={maxDim * 2.2}
          minPolarAngle={0.15}
          maxPolarAngle={Math.PI / 2.05}
        />
      </Canvas>

      <span className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 backdrop-blur-[10px] border border-white/10 px-3.5 py-2 text-[13px] text-[#F2EEE7]">
        Drag to rotate · scroll to zoom
      </span>
    </div>
  );
}
