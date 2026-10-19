// Validation for the Parts page's batched save, shared by the page (to explain
// why Save is blocked) and PUT /api/parts (so the rules hold server-side too).

export type PartKind = "BRICK" | "BASE" | "CONNECTOR";
/// How the plate looks from the front. ROUND (e.g. 4073) leaves the base
/// visible between pieces; every preview draws it that way.
export type PartShape = "SQUARE" | "ROUND";
export const PART_SHAPES: PartShape[] = ["SQUARE", "ROUND"];

export interface PartEdit {
  id: string;
  name: string;
  kind: PartKind;
  shape: PartShape;
  width: number;
  height: number;
  enabled: boolean;
  variable: number | null;
  weightGrams: number | null;
  /// For a BRICK: ids of the bases it fits on. Ignored for a BASE or CONNECTOR.
  compatibleBaseIds: string[];
}

const is1x1 = (p: { width: number; height: number }) => p.width === 1 && p.height === 1;

/// Returns the list of problems with a full set of parts; empty = valid.
///
/// - Exactly one 1x1 brick must be enabled. Any 1x1 works (square 3024, round
///   4073, ...): the generator treats whichever is enabled as its filler for
///   single leftover cells. With none, it silently falls back to the square
///   3024 even though it's disabled; with two, it silently keeps only one.
/// - At least one base must be enabled.
/// - Every enabled base must fit every enabled brick — so enabling a brick
///   (e.g. the round 1x1) requires one of its bases to be the enabled one.
export function validateParts(parts: PartEdit[]): string[] {
  const errors: string[] = [];
  const bricks = parts.filter((p) => p.kind === "BRICK" && p.enabled);
  const bases = parts.filter((p) => p.kind === "BASE" && p.enabled);

  const enabled1x1 = bricks.filter(is1x1);
  if (enabled1x1.length === 0) {
    errors.push("Enable one 1×1 part — the generator needs it to fill single leftover cells.");
  } else if (enabled1x1.length > 1) {
    errors.push(
      `Only one 1×1 part can be enabled (currently: ${enabled1x1.map((p) => p.name).join(", ")}).`
    );
  }

  if (bases.length === 0) {
    errors.push("Enable at least one base.");
  }
  for (const base of bases) {
    const misfits = bricks.filter((b) => !b.compatibleBaseIds.includes(base.id));
    if (misfits.length) {
      errors.push(`${base.name} doesn't fit: ${misfits.map((b) => b.name).join(", ")}.`);
    }
  }

  for (const p of parts) {
    if (p.variable !== null && (!Number.isFinite(p.variable) || p.variable < 0 || p.variable > 1)) {
      errors.push(`${p.name}: 1×1 cap must be between 0 and 1.`);
    }
    if (p.weightGrams !== null && (!Number.isFinite(p.weightGrams) || p.weightGrams < 0)) {
      errors.push(`${p.name}: g/piece must be 0 or more.`);
    }
  }
  return errors;
}
